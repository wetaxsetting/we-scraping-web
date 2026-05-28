"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";

import { CaptchaDialog } from "@/app/(dashboard)/banking/credentials/CaptchaDialog";
import { OtpDialog } from "@/app/(dashboard)/banking/credentials/OtpDialog";
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";
import { useDialog } from "@/components/shared/dialog";
import AuditLogsDialog, {
    type AuditLogRow,
} from "@/components/shared/popups/AuditLogsDialog";
import LoginIdPasswordDialog from "@/components/shared/popups/LoginIdPasswordDialog";
import SelectBankAccountsDialog from "@/components/shared/popups/SelectBankAccountsDialog";
import {
    mapScrapedToBankRow,
    type BankAccountRow as ScrapedBankAccountRow,
} from "@/components/shared/popups/selectBankAccountsMockData";
import SelectBankDialog from "@/components/shared/popups/SelectBankDialog";
import {
    BANK_CD_TO_HERO_LOGO_PATH,
    resolveBankLogoUrl,
    type BankOption,
} from "@/components/shared/popups/selectBankBanks";
import {
    isSpecialViewSettingField,
    useViewSetting,
    ViewSettingPopover,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import { useTranslation } from "@/lib/i18n";
import { lookupScrapingResultMessage } from "@/lib/i18n/scrapingResultCodes";

import { fetchBankAccounts } from "@/lib/api/bankAccount";
import {
    registerAccounts,
    startScrape,
    submitScrapeCaptcha,
    submitScrapeOtp,
    submitScrapeQna,
    type ApiQnaQuestion,
    type ApiScrapeSessionResponse,
} from "@/lib/api/bankCredentials";
import {
    createBankLoginCredential,
    deleteLoginCredential,
    fetchLoginCredentialBanks,
} from "@/lib/api/loginCredentials";
import { mapBankAccountList } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import BankAccountTable, {
    BANK_ACCOUNT_FIELD_LABEL_KEY,
    type BankAccountFieldId,
} from "./BankAccountTable";
import BankBrandLogo from "./BankBrandLogo";
import EditBankAccountDialog from "./EditBankAccountDialog";
import PermissionDialog, { type PermissionKind } from "./PermissionDialog";
import type { BankAccountRow } from "./types";

/**
 * Bank Account panel — Settings popup submenu (Figma 142:18741).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description on the left, list-action icon
 *                   button on the right.
 *   [Table]       — single scroll region: vertical for tall row sets,
 *                   horizontal because the column set is wider than the
 *                   modal content area.
 *   [Add button]  — pinned BELOW the scroll region as a full-width
 *                   bordered "+ Add" row.
 *
 * Static UI: clicking the list icon opens the shared <ViewSettingPopover>
 * (Figma 142:19692) seeded with local mock items — Save / Reset are
 * no-ops on this static panel; the popover still surfaces the standard
 * confirmation + success dialogs so the chrome reads identical to the
 * main-page popover. CLAUDE.md §13 requires the shared component for any
 * View Setting surface; backend wiring (`useViewSetting` hook + Flyway
 * seed) lands when the settings API is ported.
 */
/**
 * Discriminated union for the popup currently visible in the +Add chain.
 * `null` keeps the chain closed — all three popups are mutually exclusive
 * children of the Settings modal, so they swap atomically rather than
 * stack on top of each other (CLAUDE.md §"Modal stacking convention" —
 * sibling-child pattern, all at level 2).
 */
type AddBankStep =
    | { kind: "select-bank" }
    | { kind: "login-id-pw" }
    | { kind: "select-bank-accounts" };

/**
 * Mirror of the V127 `SYS_SCR_OPTION_WECMS` seed for screenId
 * `bank-account` / area `default`. Used only as the column set while
 * the API resolves on first paint so the table doesn't flash empty.
 * The authoritative config still comes from the backend via
 * `useViewSetting`.
 */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",              field_nm: "Select row",            disp_ord: 0,  disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "38px",  sort_yn: "N" },
    { field_id: "BANK",                  field_nm: "Accounts",              disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "ACCOUNT_NICKNAME",      field_nm: "Account Nickname",      disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "DESCRIPTION",           field_nm: "Description",           disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "ACCOUNT_TYPE",          field_nm: "Account Type",          disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "MATURITY_DATE",         field_nm: "Maturity Date",         disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "140px", sort_yn: "Y" },
    { field_id: "VAS_CODE",              field_nm: "VAS Code",              disp_ord: 6,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "120px", sort_yn: "Y" },
    { field_id: "VAS_NAME",              field_nm: "VAS",                   disp_ord: 7,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "200px", sort_yn: "Y" },
    { field_id: "VIEW_PERMISSION",       field_nm: "View Permission",       disp_ord: 8,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "WITHDRAWAL_PERMISSION", field_nm: "Withdrawal Permission", disp_ord: 9,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
    { field_id: "AUDIT_LOGS",            field_nm: "Audit Logs",            disp_ord: 10, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "N" },
];

export default function BankAccountPanel() {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    /**
     * View Setting state — `bank-account` / `default` screen.
     * Save / Reset round-trip through `/api/v1/screen-options/...`.
     */
    const vs = useViewSetting(SCREEN_IDS.SETTINGS_BANK_ACCOUNT, DEFAULT_AREA_ID);

    /** Common-sort state — `default → ASC → DESC → default` cycle keyed
     *  by View Setting FIELD_IDs. Spread into the API call below. */
    const sort = useTableSort();

    /** Refresh key — bumped after a successful Edit so `useApiData`
     *  refetches and the table reflects the change. */
    const [refreshKey, setRefreshKey] = useState(0);

    /**
     * Live bank-account list — `GET /api/v1/settings/bank-account`.
     * Re-fires whenever the user changes the sort or saves an edit.
     */
    const {
        data: bankAccountRows,
        error: listError,
        loading: listLoading,
    } = useApiData(
        async () =>
            mapBankAccountList(
                await fetchBankAccounts(sort.sortParams ?? {}),
            ),
        [sort.sortField, sort.sortDirection, refreshKey],
    );
    const rows = bankAccountRows ?? [];

    /* Smooth the list-loading indicator so fast cached responses don't
     * flash the notice on/off. The data view stays driven by
     * `bankAccountRows`; only the gating boolean is held sticky. */
    const stickyListLoading = useStickyLoading(listLoading);

    /* Loading / empty notice — mirrors the Purpose / ERP Transaction
     * History pattern. Show the loading text on the first fetch (no
     * latched data yet); show "No Data Found" only after the request
     * settles with zero rows. Keeping the table header visible during
     * loading so the layout doesn't shift. */
    const showLoadingNotice = stickyListLoading && !bankAccountRows && !listError;
    const showEmptyNotice = !stickyListLoading && !showLoadingNotice && rows.length === 0;

    /** Live items, with the FALLBACK_COLUMNS fallback while the API
     *  resolves on first paint. */
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;

    /** Columns the table renders — visible (`use_yn === "Y"`) and not a
     *  special row (CHECKBOX / ETC). The BankAccount panel does not
     *  render a row-selection checkbox column, so CHECKBOX is filtered
     *  out here even though the seed carries it (admin-controlled). */
    const visibleColumns = liveItems
        .filter(
            (it) =>
                it.use_yn === "Y" && !isSpecialViewSettingField(it.field_id),
        )
        .sort((a, b) => a.disp_ord - b.disp_ord);

    /**
     * Anchor rect of the icon button at the moment the popover opened.
     */
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    /** Working draft for the popover — seeded from live items on open. */
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[]>([]);

    /**
     * Row currently being edited via the Edit Bank Account dialog
     * (Figma 142:21385). `null` keeps the dialog closed; setting a row
     * opens it seeded with that row's values. The dialog itself is
     * static-UI — Save / Back / overlay-click all just clear this state.
     */
    const [editingAccount, setEditingAccount] = useState<BankAccountRow | null>(null);

    /**
     * Which permission dialog is open, if any. Carries both the kind
     * (View vs Withdrawal) and the bank-account row that triggered the
     * popup so the dialog can fetch the per-account roster via the
     * `(bankCd, acctNo)` path params. `null` keeps both popups closed.
     */
    const [permissionTarget, setPermissionTarget] = useState<
        { kind: PermissionKind; row: BankAccountRow } | null
    >(null);

    /**
     * Whether the Audit Logs dialog is open. Static-UI: the dialog
     * shows the same mock log rows regardless of which row triggered
     * it — once the API lands, swap to `auditLogsRow: BankAccountRow`
     * so the dialog can fetch per-account history.
     */
    const [auditLogsOpen, setAuditLogsOpen] = useState(false);

    /**
     * +Add chain state — mirrors the Login Credentials Add flow exactly
     * (Figma 1081:25861 → 1081:25293 → 1081:25485). Three popups, only
     * one mounted at a time:
     *
     *   Select Bank → Login ID/PW → Select Bank Accounts → success dialog
     *
     * All three popups are level-2 children of the Settings modal and
     * swap atomically (sibling pattern) so neither flickers off-screen
     * alongside its replacement. The selected bank survives across the
     * chain so the downstream popups can render the bank's brand logo.
     *
     * Static-UI: Next on Select Bank advances to Login ID/PW; Login on
     * Login ID/PW advances to Select Bank Accounts; Save on Select
     * Bank Accounts opens the shared system success dialog and any
     * dismissal collapses the entire chain back to the panel.
     */
    const [addStep, setAddStep] = useState<AddBankStep | null>(null);
    const [addBankSearchValue, setAddBankSearchValue] = useState("");
    const [addSelectedBank, setAddSelectedBank] = useState<BankOption | null>(null);

    function openAddBank() {
        setAddBankSearchValue("");
        setAddSelectedBank(null);
        // Kick off the live-banks fetch so the Select Bank picker
        // shows real BANK_CD values (not the static seed).
        ensureLiveBanks();
        setAddStep({ kind: "select-bank" });
    }

    function closeAddChain() {
        setAddStep(null);
        setAddSelectedBank(null);
        setAddBankSearchValue("");
        setScrapedAccounts(null);
        setRegistrationCredentialSeqNo(null);
    }

    /** Mutation in flight — disables Save / Add buttons so the same
     *  request can't fire twice. Matches LoginCredentialsPanel. */
    const [mutationInFlight, setMutationInFlight] = useState(false);

    /** Translate an error from any mutation into a localised dialog
     *  carrying the backend status code. */
    const showMutationError = useCallback(
        (err: unknown) => {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message =
                err instanceof ApiCallError ? err.message : t("dialog.error");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        },
        [dialog, t],
    );

    /** Live bank registry for the Select Bank picker. Fetched on
     *  first Add-chain open so real BANK_CD values flow to NXISAS. */
    const [liveBanks, setLiveBanks] = useState<BankOption[] | null>(null);

    const ensureLiveBanks = useCallback(() => {
        if (liveBanks !== null) return;
        fetchLoginCredentialBanks()
            .then((res) => {
                const palette = [
                    "#0046AD", "#A21F2A", "#F5A623", "#0A3F8F",
                    "#0073C6", "#C8102E", "#E1232E", "#0083B0",
                    "#1A8754", "#7B1FA2", "#00838F", "#5D4037",
                ];
                const mapped: BankOption[] = res.items.map((row, i) => ({
                    id:      row.bank_cd,
                    name:    row.bank_nm,
                    color:   palette[i % palette.length],
                    initial: (row.bank_nm.trim().charAt(0) || "?").toUpperCase(),
                    logoUrl: resolveBankLogoUrl(row.bank_cd, locale),
                }));
                setLiveBanks(mapped);
            })
            .catch(() => {
                /* Transport failure — falls back to static seed inside the picker. */
            });
    }, [liveBanks, locale]);

    /** NXISAS scrape session for the active Add chain. Same shape as
     *  LoginCredentialsPanel. */
    const [scrapeSession, setScrapeSession] = useState<{
        sessionId:          string;
        challengePrompt:    string | null;
        kind:               "OTP" | "QNA" | "CAPTCHA";
        qnaQuestions:       ApiQnaQuestion[];
        captchaImage:       string | null;
        captchaImageFormat: string | null;
        bankName:           string;
        loginId:            string;
        credentialSeqNo:    number;
    } | null>(null);

    /** Accounts returned by the most recent successful scrape. */
    const [scrapedAccounts, setScrapedAccounts] = useState<ScrapedBankAccountRow[] | null>(null);

    /** SEQ_NO of the credential the user just scraped against. */
    const [registrationCredentialSeqNo, setRegistrationCredentialSeqNo] = useState<number | null>(null);

    /** Apply a scrape result. Mirrors LoginCredentialsPanel.applyScrapeResult. */
    const applyScrapeResult = useCallback(
        (
            res: ApiScrapeSessionResponse,
            credentialSeqNo: number,
            ctx?: { bankName: string; loginId: string },
        ) => {
            const bankName = ctx?.bankName ?? scrapeSession?.bankName ?? "";
            const loginId  = ctx?.loginId  ?? scrapeSession?.loginId  ?? "";

            if (res.status === "COMPLETED") {
                setScrapeSession(null);
                const rows = (res.accounts ?? []).map(mapScrapedToBankRow);
                setScrapedAccounts(rows);
                setRegistrationCredentialSeqNo(credentialSeqNo);
                setAddStep({ kind: "select-bank-accounts" });
                return;
            }
            if (res.status === "OTP_REQUIRED") {
                setScrapeSession({
                    sessionId:          res.session_id ?? "",
                    challengePrompt:    res.challenge_prompt,
                    kind:               "OTP",
                    qnaQuestions:       [],
                    captchaImage:       null,
                    captchaImageFormat: null,
                    bankName,
                    loginId,
                    credentialSeqNo,
                });
                return;
            }
            if (res.status === "QNA_REQUIRED") {
                setScrapeSession({
                    sessionId:          res.session_id ?? "",
                    challengePrompt:    res.challenge_prompt,
                    kind:               "QNA",
                    qnaQuestions:       res.qna_questions ?? [],
                    captchaImage:       null,
                    captchaImageFormat: null,
                    bankName,
                    loginId,
                    credentialSeqNo,
                });
                return;
            }
            if (res.status === "CAPTCHA_REQUIRED") {
                setScrapeSession({
                    sessionId:          res.session_id ?? "",
                    challengePrompt:    res.challenge_prompt,
                    kind:               "CAPTCHA",
                    qnaQuestions:       [],
                    captchaImage:       res.captcha_image,
                    captchaImageFormat: res.captcha_image_format,
                    bankName,
                    loginId,
                    credentialSeqNo,
                });
                return;
            }
            // ERROR — drop the unverified credential and surface the
            // bank error. Refresh the panel list since the row may
            // have been written before the scrape rejected it.
            setScrapeSession(null);
            deleteLoginCredential("bank", credentialSeqNo).catch(() => {});
            setRefreshKey((n) => n + 1);
            // Prefer code-keyed i18n; gateway free-text is often Korean.
            const localized = lookupScrapingResultMessage(res.error_code, t);
            const errMessage =
                localized ??
                res.error_message ??
                res.error_code ??
                t("settings.login_credentials.bank_login.unknown_error");
            const errCode = res.error_code ?? "WBE_NXISAS";
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: errMessage,
                errorCode: errCode,
            });
        },
        [dialog, t, scrapeSession],
    );

    /** Persist the picked accounts via /accounts/register. */
    const persistPickedAccounts = useCallback(
        (pickedRows: ScrapedBankAccountRow[], onSuccess: () => void) => {
            if (mutationInFlight) return;
            const seqNo = registrationCredentialSeqNo;
            if (seqNo == null || !pickedRows.length) return;
            setMutationInFlight(true);
            registerAccounts({
                credential_seq_no: seqNo,
                accounts: pickedRows.map((r) => ({
                    account_no:       r.accountNo,
                    currency:         r.currency,
                    acct_type_cd:     r.accountType || null,
                    account_nickname: r.accountNickname || null,
                    account_details:  r.accountDetails || null,
                })),
            })
                .then(() => {
                    dialog.open({
                        type: "success",
                        title: t("dialog.success"),
                        description: t(
                            "settings.login_credentials.select_bank_accounts.save_success",
                        ),
                        onConfirm: onSuccess,
                        onClose: onSuccess,
                    });
                })
                .catch(showMutationError)
                .finally(() => setMutationInFlight(false));
        },
        [
            mutationInFlight,
            registrationCredentialSeqNo,
            dialog,
            t,
            showMutationError,
        ],
    );

    function handleOpenViewSetting(rect: DOMRect) {
        // Seed the popover's working draft from the current live items
        // so cancel reliably discards local edits (matches the main-page
        // contract).
        //
        // Bank Account intentionally surfaces the BANK column as
        // toggleable on this screen (product decision 2026-05-14 —
        // see V151). The V127 sys default still ships FIX_YN='Y' until
        // V151 lands locally; until then, override the flag client-side
        // so the Account checkbox is always enabled regardless of the
        // backend Flyway state.
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
        const unlocked = seed.map((it) =>
            it.field_id === "BANK" ? { ...it, fix_yn: "N" as const } : it,
        );
        setVsDraft(unlocked);
        setVsAnchor(rect);
    }

    function closeViewSetting() {
        setVsAnchor(null);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — title + description left, icon-only action button right.
               pt-14 drops the row below the shell's absolute Esc/X group
               (top-4 right-4) so the icon button can sit at the natural
               px-8 right edge without overlapping the close affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.bank_account.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.bank_account.description")}
                    </p>
                </div>
                {/* Bare icon button — matches the canonical style used by
                   <PageActionButtons> on the main pages: no border, no
                   shadow, no card wrapper; just rounded-md p-1 + a hover
                   tint. Captures its DOMRect to anchor the popover. */}
                <button
                    type="button"
                    aria-label={t("view_setting.aria.list_button")}
                    onClick={(e) =>
                        handleOpenViewSetting(
                            e.currentTarget.getBoundingClientRect(),
                        )
                    }
                    className="flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-list.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                </button>
            </div>

            {/* Scroll region — owns BOTH axes. Vertical scroll keeps the
               header sticky; horizontal scroll covers the wider column
               set. Padding lives on the inner wrapper so the scrollbar
               sits flush with the modal edges. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <div className="flex h-full min-w-min flex-col">
                        <BankAccountTable
                            rows={rows}
                            columns={visibleColumns}
                            activeSortField={sort.sortField}
                            activeSortDirection={sort.sortDirection}
                            onSort={sort.toggleSort}
                            onAccountClick={setEditingAccount}
                            onViewPermissionClick={(row) =>
                                setPermissionTarget({ kind: "view", row })
                            }
                            onWithdrawalPermissionClick={(row) =>
                                setPermissionTarget({ kind: "withdrawal", row })
                            }
                            onAuditLogsClick={() => setAuditLogsOpen(true)}
                        />
                        {(showLoadingNotice || showEmptyNotice) && (
                            <div
                                className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6"
                                role="status"
                            >
                                {showLoadingNotice
                                    ? t("settings.bank_account.list.loading")
                                    : t("settings.bank_account.list.empty")}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed bottom — "+ Add" button (Figma 142:19306). The Figma
               spec uses the project's standard outline-button: rounded-md
               + default-button shadow stack (no dashed border), 14px
               medium label, 16px plus icon. Sits OUTSIDE the scroll
               container so it stays visible no matter how many rows the
               table contains. */}
            <div className="shrink-0 px-8 py-3">
                <button
                    type="button"
                    onClick={openAddBank}
                    className="flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.bank_account.add")}
                </button>
            </div>

            {/* Select Bank popup — Figma 1081:25861. Sits at
               stackLevel=2 (direct child of Settings modal). Driven by
               the live banks registry so real BANK_CD values flow to
               NXISAS — falls back to the static seed when the fetch
               is still in flight or errored. */}
            {addStep?.kind === "select-bank" && (
                <SelectBankDialog
                    stackLevel={2}
                    value={addBankSearchValue}
                    onChange={setAddBankSearchValue}
                    onSelect={setAddSelectedBank}
                    nextDisabled={!addSelectedBank}
                    onNext={() => setAddStep({ kind: "login-id-pw" })}
                    onCancel={closeAddChain}
                    banks={liveBanks ?? undefined}
                />
            )}

            {/* Login ID/PW popup — Figma 1081:25293. Same NXISAS
               two-phase commit as the Login Credentials Add flow:
               (1) POST /api/v1/login-credentials/bank → BANK_CERT_INFO
                   row created (encrypted + audit-logged server-side).
               (2) POST /api/v1/banking/scraping/account-list → real
                   NXISAS LOGIN. Branches on the response:
                     COMPLETED → Select Bank Accounts step.
                     OTP/QNA/CAPTCHA_REQUIRED → challenge dialog stacks.
                     ERROR → delete the unverified row, surface code.
               The delete-on-error step prevents the panel from
               surfacing a credential that can't actually log in. */}
            {addStep?.kind === "login-id-pw" && addSelectedBank && (
                <LoginIdPasswordDialog
                    key={`add-login-${addSelectedBank.id}`}
                    stackLevel={2}
                    bankName={addSelectedBank.name}
                    bankCd={addSelectedBank.id}
                    bankLogo={
                        BANK_CD_TO_HERO_LOGO_PATH[addSelectedBank.id]
                            ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                      src={BANK_CD_TO_HERO_LOGO_PATH[addSelectedBank.id]}
                                      alt={addSelectedBank.name}
                                      className="max-h-12 max-w-[220px] object-contain"
                                  />
                              )
                            : <BankBrandLogo bankName={addSelectedBank.name} />
                    }
                    onChooseAnotherBank={() => {
                        setAddBankSearchValue("");
                        setAddSelectedBank(null);
                        ensureLiveBanks();
                        setAddStep({ kind: "select-bank" });
                    }}
                    loginDisabled={mutationInFlight}
                    onLogin={async (values) => {
                        // Capture stable references at click time so
                        // the async chain isn't subject to a later
                        // state flip (cancel mid-scrape would null out
                        // addSelectedBank between renders).
                        const bank = addSelectedBank;
                        if (mutationInFlight || !bank) return;
                        setMutationInFlight(true);
                        // Step 1 — create credential. Fail-fast: if the
                        // POST errors, no row was written, no cleanup
                        // needed.
                        let created;
                        try {
                            created = await createBankLoginCredential({
                                bank_cd:          bank.id,
                                login_id:         values.id,
                                password:         values.password,
                                nxisas_gb_seq_no: values.nxisasGbSeqNo,
                                extra:            values.extra || undefined,
                                login_type:       values.loginType || undefined,
                            });
                        } catch (err) {
                            showMutationError(err);
                            setMutationInFlight(false);
                            return;
                        }
                        // Step 2 — start scrape. ONLY this call's failure
                        // should trigger the unverified-credential delete.
                        // ANY exception thrown by applyScrapeResult (which
                        // is invoked below, outside this try) must NOT
                        // delete the credential — the row was already
                        // verified by the time we read the response.
                        let scrape: ApiScrapeSessionResponse;
                        try {
                            scrape = await startScrape(String(created.seq_no));
                        } catch (err) {
                            try {
                                await deleteLoginCredential(
                                    "bank",
                                    created.seq_no,
                                );
                            } catch {
                                /* swallow cleanup error */
                            }
                            setRefreshKey((n) => n + 1);
                            showMutationError(err);
                            setMutationInFlight(false);
                            return;
                        }
                        // Step 3 — dispatch the scrape result. Wrapped
                        // in try/finally so:
                        //  - mutationInFlight ALWAYS clears (otherwise
                        //    the dialog stays in its loading state and
                        //    the Cancel / Login buttons stay disabled).
                        //  - The exception still propagates (NOT a
                        //    silent swallow) so render errors surface
                        //    in the console and any error boundary.
                        //  - We DO NOT call deleteLoginCredential here
                        //    on exception — the credential was already
                        //    verified, so tearing it down would lose
                        //    the user's work.
                        try {
                            applyScrapeResult(
                                scrape,
                                created.seq_no,
                                {
                                    bankName: bank.name,
                                    loginId:  values.id,
                                },
                            );
                        } catch (err) {
                            // Render / state-update error after a verified
                            // scrape. Surface as an error dialog rather
                            // than crashing the panel silently. The
                            // credential + ACCT_MSTR registrations land
                            // separately via the Select Bank Accounts
                            // dialog's Save, so a transition error here
                            // leaves the user able to retry.
                            // eslint-disable-next-line no-console
                            console.error("applyScrapeResult threw", err);
                            showMutationError(err);
                        } finally {
                            setMutationInFlight(false);
                        }
                    }}
                    onCancel={closeAddChain}
                />
            )}

            {/* Select Bank Accounts popup — Figma 1081:25485. Seeded
               with the live scraped account rows. Save POSTs to
               /api/v1/banking/accounts/register; success refreshes
               the Bank Account list and collapses the chain. */}
            {addStep?.kind === "select-bank-accounts" && addSelectedBank && (
                <SelectBankAccountsDialog
                    key={`add-bank-accounts-${addSelectedBank.id}`}
                    stackLevel={2}
                    bankName={addSelectedBank.name}
                    bankLogo={
                        BANK_CD_TO_HERO_LOGO_PATH[addSelectedBank.id]
                            ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                      src={BANK_CD_TO_HERO_LOGO_PATH[addSelectedBank.id]}
                                      alt={addSelectedBank.name}
                                      className="max-h-12 max-w-[220px] object-contain"
                                  />
                              )
                            : <BankBrandLogo bankName={addSelectedBank.name} />
                    }
                    rows={scrapedAccounts ?? []}
                    onBack={() => setAddStep({ kind: "login-id-pw" })}
                    saveDisabled={mutationInFlight}
                    onSave={(pickedRows) => {
                        persistPickedAccounts(pickedRows, () => {
                            closeAddChain();
                            setRefreshKey((n) => n + 1);
                        });
                    }}
                />
            )}

            {/* Challenge dialog dispatch — OTP / QNA / CAPTCHA stack at
               stackLevel=4 over the Login ID/PW dialog (which sits at
               stackLevel=2 here since it's a direct child of Settings).
               Mirrors LoginCredentialsPanel's dispatch block. */}
            {scrapeSession && (() => {
                const session = scrapeSession;
                const cleanupOnAbandon = () => {
                    // Add flow always deletes the unverified credential
                    // when the user abandons the challenge — the row
                    // was created seconds ago and never confirmed.
                    deleteLoginCredential("bank", session.credentialSeqNo)
                        .catch(() => {});
                    setRefreshKey((n) => n + 1);
                    setScrapeSession(null);
                };
                const handleSubmitError = (err: unknown) => {
                    cleanupOnAbandon();
                    showMutationError(err);
                };

                if (session.kind === "QNA") {
                    return (
                        <QnaDialog
                            bankName={session.bankName}
                            loginId={session.loginId}
                            questions={session.qnaQuestions}
                            onSubmit={async (payload) => {
                                try {
                                    const res = await submitScrapeQna(
                                        session.sessionId,
                                        payload,
                                    );
                                    applyScrapeResult(res, session.credentialSeqNo);
                                } catch (err) {
                                    handleSubmitError(err);
                                }
                            }}
                            onCancel={cleanupOnAbandon}
                        />
                    );
                }
                if (session.kind === "CAPTCHA") {
                    return (
                        <CaptchaDialog
                            image={session.captchaImage}
                            format={session.captchaImageFormat}
                            onSubmit={async (value) => {
                                try {
                                    const res = await submitScrapeCaptcha(
                                        session.sessionId,
                                        value,
                                    );
                                    applyScrapeResult(res, session.credentialSeqNo);
                                } catch (err) {
                                    handleSubmitError(err);
                                }
                            }}
                            onCancel={cleanupOnAbandon}
                        />
                    );
                }
                // OTP
                return (
                    <OtpDialog
                        prompt={session.challengePrompt}
                        onSubmit={async (value) => {
                            try {
                                const res = await submitScrapeOtp(
                                    session.sessionId,
                                    value,
                                );
                                applyScrapeResult(res, session.credentialSeqNo);
                            } catch (err) {
                                handleSubmitError(err);
                            }
                        }}
                        onCancel={cleanupOnAbandon}
                    />
                );
            })()}

            {/* Edit Bank Account dialog — Figma 142:21385. Opens when the
               user clicks an account-name link in the table. Conditional
               mount + `key` re-seed the form state from the clicked row
               — switching from row A to row B remounts the dialog rather
               than leaking row A's draft into row B. */}
            {editingAccount && (
                <EditBankAccountDialog
                    key={editingAccount.id}
                    account={editingAccount}
                    onClose={() => setEditingAccount(null)}
                    onSaved={() => setRefreshKey((k) => k + 1)}
                />
            )}

            {/* View / Withdrawal Permission dialogs — Figma 166:24840 /
               166:25059. Single shared component, parameterised by
               `kind` + the triggering row. Conditional mount + `key`
               re-seeds the dialog state when the user opens a
               different (kind, row) pair so View's draft never leaks
               into Withdrawal and vice versa. */}
            {permissionTarget && (
                <PermissionDialog
                    key={`${permissionTarget.kind}-${permissionTarget.row.id}`}
                    kind={permissionTarget.kind}
                    bankCd={permissionTarget.row.bankCd}
                    acctNo={permissionTarget.row.accountNumber}
                    onClose={() => setPermissionTarget(null)}
                    onSaved={() => setRefreshKey((k) => k + 1)}
                />
            )}

            {/* Audit Logs dialog — Figma 166:25291. Conditional mount so
               the inner dialog state resets cleanly between opens.
               Live audit rows depend on a Bank Account history
               endpoint that hasn't shipped yet — until it does, the
               dialog renders an empty body rather than fabricated
               fixtures. The previous {@code mockAuditLogs} seed was
               retired 2026-05-26. */}
            {auditLogsOpen && (
                <AuditLogsDialog
                    title={t("settings.bank_account.audit_logs.title")}
                    description={t("settings.bank_account.audit_logs.description")}
                    rows={[] as AuditLogRow[]}
                    onClose={() => setAuditLogsOpen(false)}
                />
            )}

            {/* Shared View Setting popover — Figma 142:19692.
               Static-UI handlers: Save snapshots the draft (no API), Reset
               restores defaults locally. The popover still walks through
               its built-in confirmation + success dialogs so the visual
               chrome matches the main-page popover. */}
            {vsAnchor && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={setVsDraft}
                    getLabel={(item) => {
                        const key =
                            BANK_ACCOUNT_FIELD_LABEL_KEY[
                                item.field_id as BankAccountFieldId
                            ];
                        return key ? t(key) : item.field_nm;
                    }}
                    onSave={async () => {
                        try {
                            await vs.save(vsDraft);
                        } catch {
                            // Hook rolls back local items + surfaces
                            // the error; the popover's own success
                            // dialog stays suppressed.
                        }
                        closeViewSetting();
                    }}
                    onReset={async () => {
                        try {
                            const fresh = await vs.reset();
                            setVsDraft(fresh);
                        } catch {
                            // Leave the draft unchanged on failure —
                            // the user can retry from the popover.
                        }
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </div>
    );
}
