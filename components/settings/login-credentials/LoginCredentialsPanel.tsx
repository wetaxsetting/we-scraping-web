"use client";

import { useCallback, useState, type ReactNode } from "react";

import { useDialog } from "@/components/shared/dialog";
import AuditLogsDialog, {
    type AuditLogRow,
} from "@/components/shared/popups/AuditLogsDialog";
import EditLoginIdPasswordDialog from "@/components/shared/popups/EditLoginIdPasswordDialog";
import GdtCredentialsDialog from "@/components/shared/popups/GdtCredentialsDialog";
import LoginIdPasswordDialog from "@/components/shared/popups/LoginIdPasswordDialog";
import RevealPasswordConfirmDialog from "@/components/shared/popups/RevealPasswordConfirmDialog";
import LoginCredentialsRowMenu from "./LoginCredentialsRowMenu";
import RegisteredLoginCredentialsDialog, {
    type RegisteredCredentialEntry,
} from "@/components/shared/popups/RegisteredLoginCredentialsDialog";
import SelectBankAccountsDialog from "@/components/shared/popups/SelectBankAccountsDialog";
import {
    mapScrapedToBankRow,
    type BankAccountRow,
} from "@/components/shared/popups/selectBankAccountsMockData";
import SelectBankDialog from "@/components/shared/popups/SelectBankDialog";
import SelectLoginInstitutionDialog from "@/components/shared/popups/SelectLoginInstitutionDialog";
import {
    BANK_CD_TO_HERO_LOGO_PATH,
    resolveBankLogoUrl,
    type BankOption,
} from "@/components/shared/popups/selectBankBanks";
import BankBrandLogo from "@/components/settings/bank-account/BankBrandLogo";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTranslation } from "@/lib/i18n";
import { lookupScrapingResultMessage } from "@/lib/i18n/scrapingResultCodes";
import { useApiData } from "@/lib/api/useApiData";
import { ApiCallError } from "@/lib/api/banking";
import {
    createBankLoginCredential,
    createGdtLoginCredential,
    deleteLoginCredential,
    fetchLoginCredentialAuditLogs,
    fetchLoginCredentialBanks,
    fetchLoginCredentials,
    revealLoginCredential,
    updateBankLoginCredential,
    updateGdtLoginCredential,
    verifyBankPasswordUpdate,
    type LoginCredentialKind,
} from "@/lib/api/loginCredentials";
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
    mapLoginCredentialAuditList,
    mapLoginCredentialList,
} from "@/lib/api/mappers";

import LoginCredentialsTable from "./LoginCredentialsTable";
import { buildRegisteredCredentialEntries } from "./registeredCredentials";
import type { LoginCredentialRow } from "./types";
import { CaptchaDialog } from "@/app/(dashboard)/banking/credentials/CaptchaDialog";
import { OtpDialog } from "@/app/(dashboard)/banking/credentials/OtpDialog";
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";

/**
 * Server-sourced row shape — extends the panel's
 * {@link LoginCredentialRow} with the wire identifiers we need to fire
 * Delete / Reveal / Audit Logs against the right backend row. The
 * shape is what {@link mapLoginCredentialList} produces.
 */
type ServerLoginCredentialRow = LoginCredentialRow & {
    apiType:  LoginCredentialKind;
    apiSeqNo: number;
    /** Original BANK_CD for BANK rows (null for GDT). Carried so the
     *  Registered chain's "Add Login" knows which bank to POST under. */
    bankCd:   string | null;
};

/**
 * Discriminated union for the *child* popups that stack on top of the
 * Registered Login Credentials dialog.
 *
 * Stack semantics — match legacy `wecms.vn/fnsh_0001_001.act`:
 *
 *   Settings popup
 *     └─ Registered Login Credentials   ← stays mounted whenever the
 *                                         user is somewhere in this chain
 *         └─ Login ID/PW   |   Select Bank   |   Confirmation
 *                          (mutually exclusive among themselves)
 *
 * The three children are mutually exclusive — opening one closes any
 * other child — but none of them unmount Registered. Closing a child
 * returns the user to Registered, not to the bare Settings popup.
 *
 *   - login-id-pw          → Figma 1081:25293
 *   - select-bank          → Figma 1081:25861 (replaces login-id-pw on
 *                                               "Choose another bank")
 *   - select-bank-accounts → Figma 1081:25485 (opens after a successful
 *                                               Login click in login-id-pw)
 *   - edit-login-id-pw     → Figma 2781:23399 (opens from the pencil
 *                                               icon on a Registered row)
 *   - confirmation         → Figma 9198:7071  (eye-slash on a hidden password)
 */
type RegisteredChild =
    | { kind: "login-id-pw" }
    | { kind: "select-bank" }
    | { kind: "select-bank-accounts" }
    | { kind: "edit-login-id-pw"; entry: RegisteredCredentialEntry }
    | { kind: "confirmation"; entry: RegisteredCredentialEntry };

/**
 * Discriminated union for the Add-credentials flow opened from the
 * panel-header "Add" button. Mirrors `RegisteredChild` in shape — at
 * any moment exactly one popup in the chain is mounted, transitions
 * are atomic single-setState swaps, and the parent panel owns the
 * state so the popups stay reusable.
 *
 *   Add button
 *     └─ Select-a-login-institution   (Figma 1797:20561)
 *         ├─ Bank branch:
 *         │   └─ Select Bank          (Figma 1081:25861)
 *         │       └─ Login ID/PW       (Figma 1081:25293)
 *         │           └─ Select Bank Accounts (Figma 1081:25485)
 *         │               └─ Save → success dialog → close all
 *         └─ GDT branch:
 *             └─ GDT credentials       (Figma 2344:21946)
 *                 └─ Next → success dialog → close all
 *
 * Forward-arrows are atomic swaps. Cancel on any step ends the
 * entire flow back to the panel (no stack rewind). Login ID/PW's
 * "Choose another bank" rewinds to Select Bank; Select Bank Accounts'
 * Back rewinds to Login ID/PW.
 */
type AddChild =
    | { kind: "institution" }
    | { kind: "bank" }
    | { kind: "login-id-pw" }
    | { kind: "select-bank-accounts" }
    | { kind: "gdt" };

/**
 * Login Credentials panel — Settings popup submenu (Figma 999:21715).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description on the left, "Add" primary button
 *                   plus gear icon (bordered) on the right.
 *   [Table]       — single scroll region (vertical + horizontal as needed).
 *                   Each row carries one or more (loginId, password) pairs.
 *                   Clicking the Login ID/PW cell opens a floating popover
 *                   listing every account with an eye toggle for the
 *                   masked password.
 *
 * Popup state model — TWO independent slots:
 *
 *   `registeredRow`   the Registered Login Credentials parent. Stays
 *                     mounted as long as the user is inside the
 *                     Registered → child chain.
 *   `registeredChild` which child (if any) is stacked on top of
 *                     Registered. Mutually exclusive across the three
 *                     child kinds; switching is a single setState call.
 *
 * Audit Logs is a SEPARATE flow — opens from the table's Audit Logs
 * link, not from inside the Registered chain — and keeps its own
 * boolean state.
 */

/**
 * Translate a single NXISAS-scraped account into the
 * {@link BankAccountRow} shape consumed by
 * {@code <SelectBankAccountsDialog>}. Mirrors the legacy
 * {@code fnsh_0101_001_r001} → {@code select_bank_accounts_popup.funcRenderTable}
 * mapping (comm_0218_nxisas.ts:585). VAS Code / VAS Account Name /
 * Account Type / Account Nickname / Account Details are left blank —
 * those are user-editable fields the dialog renders as empty inputs
 * for the user to fill before Save.
 */
/**
 * Render the hero bank logo for a popup body — real legacy wordmark
 * when a {@code BANK_CD} has a registered hero asset (see V122 +
 * {@link BANK_CD_TO_HERO_LOGO_PATH}); falls back to the
 * {@link BankBrandLogo} text placeholder otherwise. Used by the
 * Select Bank Accounts and Registered Credentials dialogs so the
 * brand identity matches the live JEX system.
 */
function renderBankHeroLogo(
    bankCd: string | null | undefined,
    bankName: string,
): ReactNode {
    if (bankCd && BANK_CD_TO_HERO_LOGO_PATH[bankCd]) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={BANK_CD_TO_HERO_LOGO_PATH[bankCd]}
                alt={bankName}
                className="max-h-12 max-w-[220px] object-contain"
            />
        );
    }
    return <BankBrandLogo bankName={bankName} />;
}


export default function LoginCredentialsPanel() {
    const { t, locale } = useTranslation();
    const dialog = useDialog();
    const [openRowId, setOpenRowId] = useState<string | null>(null);
    const [registeredRow, setRegisteredRow] = useState<LoginCredentialRow | null>(null);
    const [registeredChild, setRegisteredChild] = useState<RegisteredChild | null>(null);
    /** When non-null the Audit Logs dialog is open for this specific
     *  server-sourced row. Triggers a fetch of that row's audit history;
     *  static mock rows (null) fall back to the legacy seed so the
     *  dialog still renders during initial-load / error states. */
    const [auditLogsFor, setAuditLogsFor] = useState<ServerLoginCredentialRow | null>(null);
    const [auditLogsOpen, setAuditLogsOpen] = useState(false);
    /** Bump on every successful mutation so {@link useApiData} re-runs
     *  the list loader (page-1 reset analogue). Mirrors the
     *  refresh-key pattern used by Contacts / Approval Line. */
    const [refreshTick, setRefreshTick] = useState(0);
    /** Mutation in flight — disables Add / Edit / GDT Save buttons so
     *  the same request can't fire twice. Reveal has its own flag. */
    const [mutationInFlight, setMutationInFlight] = useState(false);

    /** Translate an error from any mutation into a localised dialog
     *  carrying the backend status code. Used by every Save handler
     *  so the error chrome is consistent. */
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

    /** Live bank registry for the Select Bank picker, fetched from
     *  {@code GET /api/v1/login-credentials/banks} on first need.
     *  Falls back to the static {@code SELECT_BANK_LIST} inside
     *  {@code SelectBankDialog} when this is null (e.g. during initial
     *  load or transport error). Real {@code BANK_CD} values (e.g.
     *  {@code "11704088"}) so the downstream POST → NXISAS scrape
     *  targets the right bank adapter. */
    const [liveBanks, setLiveBanks] = useState<BankOption[] | null>(null);

    /**
     * One-time fetch of the bank registry on first Select-Bank open.
     * Maps the wire shape to {@link BankOption}; uses a stable palette
     * fallback for the icon background (the dialog renders the bank's
     * initial letter on a coloured chip).
     */
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
                    // Resolve the per-bank logo asset using the V122
                    // seed map; falls back to the coloured-initial
                    // chip inside the picker when no template matches.
                    logoUrl: resolveBankLogoUrl(row.bank_cd, locale),
                }));
                setLiveBanks(mapped);
            })
            .catch(() => {
                // Transport failure — leave liveBanks as null and the
                // dialog falls back to its static seed.
            });
    }, [liveBanks, locale]);

    /** NXISAS scrape session active for the just-created credential.
     *  When set, a challenge dialog (OtpDialog / QnaDialog) is open
     *  and we're waiting for the user to supply the response. Cleared
     *  on success / failure / cancel. */
    const [scrapeSession, setScrapeSession] = useState<{
        sessionId:        string;
        challengePrompt:  string | null;
        /** Which challenge dialog to render — drives the conditional
         *  mount below. {@code "OTP"} → OtpDialog; {@code "QNA"} →
         *  QnaDialog with the questions list; {@code "CAPTCHA"} →
         *  CaptchaDialog with the image. */
        kind:             "OTP" | "QNA" | "CAPTCHA";
        /** Bank-supplied question list for the QNA challenge. Empty
         *  array for non-QNA. */
        qnaQuestions:     ApiQnaQuestion[];
        /** Base64 image bytes for the CAPTCHA challenge. Null for
         *  non-CAPTCHA. */
        captchaImage:     string | null;
        /** MIME suffix for the CAPTCHA image ({@code "png"} /
         *  {@code "svg+xml"}). Null for non-CAPTCHA. */
        captchaImageFormat: string | null;
        /** Bank display name — shown in the QNA / CAPTCHA dialog
         *  header so the user knows which bank issued the challenge. */
        bankName:         string;
        /** Login ID the user just typed — shown read-only in the
         *  challenge dialog header so they can verify before answering. */
        loginId:          string;
        /** Whether an ERROR (bank rejection / wrong challenge response)
         *  should also delete the credential row. {@code true} for the
         *  Add flow (just-created row); {@code false} for Edit
         *  (pre-existing row the user shouldn't lose on a wrong
         *  password). Mirrors the ctx.deleteOnError that initiated
         *  the scrape. */
        deleteOnError:    boolean;
        /** Edit flow's pending new password — set when the scrape was
         *  kicked off via {@code verify-update}. On COMPLETED the
         *  panel calls {@code updateBankLoginCredential} with this
         *  value to actually persist the password (the verify step
         *  never touched the DB). Null for the Add flow, which
         *  persists at create-time. */
        pendingNewPassword: string | null;
        /** SeqNo of the credential being verified — if the user cancels
         *  the OTP or the scrape fails, we delete this row so the panel
         *  doesn't end up with an unverified credential lingering. */
        credentialSeqNo:  number;
    } | null>(null);

    /** Accounts returned by the most recent successful NXISAS scrape,
     *  pre-mapped into the row shape the Select Bank Accounts dialog
     *  consumes. Drives the dialog's `rows` prop so the user picks from
     *  the live bank list instead of the static mock. Cleared when the
     *  chain collapses; the dialog renders nothing while this is null
     *  (legacy parity — empty until the scrape finishes). */
    const [scrapedAccounts, setScrapedAccounts] = useState<BankAccountRow[] | null>(null);

    /** SEQ_NO of the credential the user just scraped against. Needed
     *  when the Select Bank Accounts dialog's Save handler POSTs to
     *  {@code /api/v1/banking/accounts/register} — the backend reads
     *  BANK_CD off this row, so the frontend never ships it. */
    const [registrationCredentialSeqNo, setRegistrationCredentialSeqNo] = useState<number | null>(null);

    /** Row the user clicked Edit on from the kebab menu. Drives the
     *  standalone Edit Login ID/PW dialog mount — distinct from the
     *  Registered chain's nested Edit dialog (which requires opening
     *  the Registered list first). The kebab Edit edits the FIRST
     *  account on the row directly; multi-account rows still go
     *  through Registered for now. */
    const [editRow, setEditRow] = useState<ServerLoginCredentialRow | null>(null);

    /**
     * Apply a scrape result. The flow has four terminal states:
     *  - COMPLETED → transition the caller's chain to the Select Bank
     *                Accounts step, seeded with the scraped account
     *                list. Mirrors legacy comm_0218_nxisas.ts:559-588
     *                where {@code .select_bank_accounts} opens after a
     *                successful LOGIN and {@code fnsh_0101_001_r001}'s
     *                response feeds the dialog table. The caller
     *                supplies {@code onAccountsReady} to perform the
     *                flow-specific transition (Add vs Registered).
     *  - OTP_REQUIRED → open OtpDialog, keep credentialSeqNo in state
     *  - ERROR → delete the unverified credential + show error dialog
     *  - CAPTCHA_REQUIRED / QNA_REQUIRED → out of scope; treat as error
     *
     * <p>The earlier "success dialog → collapse chain" behaviour on
     * COMPLETED was a regression — the legacy never skipped the account
     * picker. Success is only confirmed AFTER the user picks accounts
     * and Save persists into BANK_ACCT_REG_INFO.
     */
    const applyScrapeResult = useCallback(
        (
            res:               ApiScrapeSessionResponse,
            _credentialSeqNo:  number,
            onAccountsReady:   (rows: BankAccountRow[]) => void,
            ctx?:              {
                bankName:        string;
                loginId:         string;
                /** When the scrape ERRORs, should we delete the
                 *  credential row? Defaults to {@code true} — the Add
                 *  flow always wants this (the row was just created
                 *  and never verified). The Edit flow passes
                 *  {@code false} because the row predates this
                 *  attempt and the user shouldn't lose their saved
                 *  credential just because they typed a wrong new
                 *  password. */
                deleteOnError?:  boolean;
                /** Edit flow's pending password — see scrapeSession
                 *  doc above. {@code null} for Add. */
                pendingNewPassword?: string | null;
            },
        ) => {
            // Carry-through context for the challenge dialog header.
            // Chained challenges (e.g. QNA → OTP) call applyScrapeResult
            // without a ctx — fall back to the prior session's values so
            // the dialog still shows the right bank + login id.
            const bankName = ctx?.bankName ?? scrapeSession?.bankName ?? "";
            const loginId  = ctx?.loginId  ?? scrapeSession?.loginId  ?? "";
            // Chained challenges (OTP submit → applyScrapeResult, QNA →
            // OTP, etc.) reach this callback without a fresh ctx — carry
            // the original flag through the session so an Edit flow's
            // wrong OTP attempt doesn't suddenly delete the row.
            const deleteOnError =
                ctx?.deleteOnError ?? scrapeSession?.deleteOnError ?? true;
            // Edit flow's pending new password — carried through
            // chained challenges so the COMPLETED branch can persist
            // it. Null for Add (which persisted at create-time).
            const pendingNewPassword =
                ctx?.pendingNewPassword
                ?? scrapeSession?.pendingNewPassword
                ?? null;

            if (res.status === "COMPLETED") {
                setScrapeSession(null);
                const rows = (res.accounts ?? []).map(mapScrapedToBankRow);
                setScrapedAccounts(rows);
                // Pin the credential seqNo so the Select Bank Accounts
                // dialog's Save handler can POST it to /accounts/register
                // without re-deriving it from the (now-stale) scrapeSession.
                setRegistrationCredentialSeqNo(_credentialSeqNo);

                // Edit flow: bank verified the new password, NOW persist
                // it (the verify-update call earlier in the chain did
                // NOT touch the DB). Only after the PUT succeeds do we
                // refresh the list + fire the caller's onAccountsReady
                // callback so the user sees a coherent post-save state.
                if (pendingNewPassword != null) {
                    updateBankLoginCredential(_credentialSeqNo, {
                        password: pendingNewPassword,
                    })
                        .then(() => {
                            setRefreshTick((n) => n + 1);
                            onAccountsReady(rows);
                        })
                        .catch(showMutationError);
                    return;
                }

                setRefreshTick((n) => n + 1);
                onAccountsReady(rows);
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
                    deleteOnError,
                    pendingNewPassword,
                    credentialSeqNo:    _credentialSeqNo,
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
                    deleteOnError,
                    pendingNewPassword,
                    credentialSeqNo:    _credentialSeqNo,
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
                    deleteOnError,
                    pendingNewPassword,
                    credentialSeqNo:    _credentialSeqNo,
                });
                return;
            }
            // ERROR — bank rejected. For the Add flow, the credential
            // was created seconds ago and never confirmed against the
            // bank — delete it so the panel doesn't lie to the user
            // about having a working credential. For Edit
            // ({@code deleteOnError: false}), the row predates this
            // attempt — keep it so the user's existing credential
            // survives a wrong new-password entry; just refresh the
            // list and surface the error.
            setScrapeSession(null);
            if (deleteOnError) {
                deleteLoginCredential("bank", _credentialSeqNo)
                    .catch(() => {
                        // If cleanup fails, log it but proceed to
                        // show the user the bank-side error; the
                        // audit log will carry the leftover row.
                    });
            }
            setRefreshTick((n) => n + 1);
            // Prefer the localized message keyed by the gateway result
            // code (e.g. NXISAS 80010011 → fb_history.result.80010011).
            // The gateway ships its raw `error_message` in the bank's
            // native language (often Korean for Woori / Shinhan adapters),
            // which is wrong for non-KO users — only fall back to it
            // when the code isn't in our registry.
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
        [dialog, t, scrapeSession, showMutationError],
    );

    /**
     * Persist the picked rows under {@code ACCT_MSTR} via
     * {@code POST /api/v1/banking/accounts/register}. Shared by the
     * Add and Registered Select-Bank-Accounts flows — both call this
     * with the rows the user checked + a flow-specific
     * {@code onSuccess} callback that collapses the chain.
     *
     * <p>On success: opens the shared success dialog; OK / X / ESC /
     * backdrop click all run {@code onSuccess}, mirroring the legacy
     * "Account registration has been completed." popup. On error:
     * surfaces the backend {@code status.code} via the same error
     * funnel as every other mutation; the Select Bank Accounts dialog
     * stays open so the user can adjust their selection.
     */
    const persistPickedAccounts = useCallback(
        (pickedRows: BankAccountRow[], onSuccess: () => void) => {
            if (mutationInFlight) return;
            const seqNo = registrationCredentialSeqNo;
            if (seqNo == null) {
                // Defensive — the Save button shouldn't be reachable
                // without a scrape having stashed the seqNo. Surface
                // a clear error rather than silently failing.
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t(
                        "settings.login_credentials.bank_login.unknown_error",
                    ),
                    errorCode: "WBE_NXISAS",
                });
                return;
            }
            if (!pickedRows.length) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t(
                        "settings.login_credentials.bank_login.unknown_error",
                    ),
                    errorCode: "WBE_BANK_ACCOUNT_REGISTER_EMPTY",
                });
                return;
            }
            setMutationInFlight(true);
            registerAccounts({
                credential_seq_no: seqNo,
                accounts: pickedRows.map((r) => ({
                    account_no:        r.accountNo,
                    currency:          r.currency,
                    acct_type_cd:      r.accountType || null,
                    account_nickname:  r.accountNickname || null,
                    account_details:   r.accountDetails || null,
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

    /** Live credentials from the backend. While the first fetch is
     *  in flight (or on transport error) we render an empty list
     *  rather than the static mock seed — the mock used to show on
     *  tab-remount and confused users with phantom credentials that
     *  weren't theirs. The loading / error UX lives below the table. */
    const listState = useApiData(
        useCallback(
            () => fetchLoginCredentials().then(mapLoginCredentialList),
            [],
        ),
        [refreshTick],
    );
    const rows: ServerLoginCredentialRow[] = listState.data ?? [];

    /* Smooth the list-loading indicator: keep the loading text visible
     * for the sticky-loading window so a fast cached response doesn't
     * flash on/off below the table header. */
    const stickyListLoading = useStickyLoading(listState.loading);

    /** Defensive type-narrowing helper — every row now comes from
     *  the API and carries the wire fields. Returns false only for
     *  hypothetical malformed rows. */
    const isServerRow = (row: ServerLoginCredentialRow | LoginCredentialRow): row is ServerLoginCredentialRow =>
        "apiType" in row && "apiSeqNo" in row && (row as ServerLoginCredentialRow).apiSeqNo > 0;
    /** Open row-action menu (Figma 2236:30291) state. Stores the
     *  row id together with the kebab's bounding rect so the menu —
     *  rendered via portal at the panel level — can position itself
     *  with `position: fixed` based on the trigger. Single-menu-at-
     *  a-time: clicking row B's kebab while row A's menu is open
     *  closes A and opens B in a single setState. */
    const [openMenu, setOpenMenu] = useState<
        { rowId: string; rect: DOMRect } | null
    >(null);
    /** Active step in the Add-credentials flow opened from the
     *  panel-header Add button. `null` = flow is not active. Mirrors
     *  the `registeredChild` shape — single state slot, mutually
     *  exclusive children, atomic swaps. Distinct from the
     *  Registered chain so the two flows never collide on shared
     *  draft state. */
    const [addChild, setAddChild] = useState<AddChild | null>(null);
    /** Controlled value of the Select Bank dialog's search input
     *  inside the Add flow. */
    const [addBankSearchValue, setAddBankSearchValue] = useState("");
    /** Bank picked inside Select Bank during the Add flow — drives
     *  Next-enabled on Select Bank and surfaces in Login ID/PW +
     *  Select Bank Accounts as the institution identity. */
    const [addSelectedBank, setAddSelectedBank] = useState<BankOption | null>(
        null,
    );
    /** Controlled value of the password confirmation dialog's input. */
    const [confirmValue, setConfirmValue] = useState("");
    /** True while a reveal POST is in flight — disables the
     *  Confirmation dialog's Save / Enter so the user can't fire the
     *  same request twice. */
    const [revealInFlight, setRevealInFlight] = useState(false);
    /** Once decrypted, the plaintext password is keyed by the row's
     *  loginId so the still-open Registered popover can swap its
     *  masked placeholder for the real value. Cleared when the
     *  Registered chain unmounts. */
    const [revealedByLoginId, setRevealedByLoginId] = useState<Record<string, string>>({});
    /** Controlled value of the Select Bank dialog's search input. */
    const [bankSearchValue, setBankSearchValue] = useState("");
    /** Bank picked inside Select Bank — drives Next-enabled and is kept
     *  available for downstream popups (Login ID/PW) per the flow. Null
     *  while no row has been clicked. */
    const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);

    /** Server-sourced audit history for the currently-selected row.
     *  Loader is keyed on (apiType, apiSeqNo) so opening a different
     *  row's audit dialog re-fetches. When no server row is selected
     *  the loader skips the network call and returns the static seed. */
    const auditLogsState = useApiData<
        ReturnType<typeof mapLoginCredentialAuditList>
    >(
        useCallback(() => {
            if (!auditLogsFor) {
                // No server-side identity → render an empty history.
                // We previously seeded with the static mock here, but
                // that showed phantom rows on tab-remount.
                return Promise.resolve([]);
            }
            return fetchLoginCredentialAuditLogs(
                auditLogsFor.apiType,
                auditLogsFor.apiSeqNo,
            ).then(mapLoginCredentialAuditList);
        }, [auditLogsFor]),
        [auditLogsFor?.apiType, auditLogsFor?.apiSeqNo, auditLogsOpen],
    );

    // Pre-translate audit-log rows for the shared dialog. Server rows
    // ship pre-localised activity-detail strings (mapper passes
    // `audit_logs_actv_dtl` through verbatim); we still resolve the
    // legacy translation key for compatibility with the audit-log row
    // type's `activity` discriminator.
    const auditLogRows: AuditLogRow[] = (auditLogsState.data ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        time: row.time,
        user: row.user,
        // Server rows already carry a localised activity description in
        // `details`; the `activity` enum is just for legacy mock seed
        // rendering, so resolve it the same way and the server path
        // ends up with a stable label too.
        activity: t(`settings.login_credentials.audit_logs.activity.${row.activity}`),
        details: row.details,
    }));

    function closeRegistered() {
        // Closing the parent always tears down any child too — a stale
        // child without its parent would render as an orphan modal.
        // Also drop any decrypted passwords from memory — they should
        // not persist across row switches.
        setRegisteredRow(null);
        setRegisteredChild(null);
        setRevealedByLoginId({});
    }

    function closeChild() {
        setRegisteredChild(null);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — title + description sit alone on row 1 (Figma
               183:25777); the Add + gear toolbar sits on row 2,
               right-aligned, separated by gap-5 (Figma 183:25789).
               pt-14 drops the title row below the shell's absolute
               Esc/X group at top-4 right-4. */}
            <div className="flex shrink-0 flex-col gap-5 px-8 pb-5 pt-14">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.login_credentials.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.login_credentials.description")}
                    </p>
                </div>

                {/* Toolbar — primary "Add" button, right-aligned on
                   its own row per Figma 183:25789. Opens the
                   Select-a-login-institution popup as the first step
                   of the add-credentials flow. */}
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            setAddBankSearchValue("");
                            setAddSelectedBank(null);
                            // Warm the live bank registry — fetch only
                            // runs the first time per session.
                            ensureLiveBanks();
                            setAddChild({ kind: "institution" });
                        }}
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {t("settings.login_credentials.add")}
                    </button>
                </div>
            </div>

            {/* Scroll region — table body + thead share a single overflow
               wrapper. The thead is `sticky top-0` so it stays pinned
               while the body scrolls. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar h-full overflow-auto">
                    {/* Flex column (h-full) so the empty-state below the
                       sticky table header can take `flex-1` and center in
                       the remaining content area — reuses the VAS Account
                       empty-state pattern (CLAUDE.md §3a). */}
                    <div className="flex h-full min-w-[min-content] flex-col">
                    <LoginCredentialsTable
                        rows={rows}
                        openRowId={openRowId}
                        onOpenPopover={setOpenRowId}
                        onClosePopover={() => setOpenRowId(null)}
                        onInstitutionClick={(row) => {
                            // GDT routes to the Account Management
                            // popup (the same `<GdtCredentialsDialog>`
                            // the Add → Select Institution → GDT chain
                            // opens). Bank rows keep the Registered
                            // Login Credentials chain.
                            if (row.institution === "GDT") {
                                setAddChild({ kind: "gdt" });
                                return;
                            }
                            setRegisteredRow(row);
                            setRegisteredChild(null);
                        }}
                        onAuditLogsClick={(row) => {
                            // Capture the row so the dialog can fetch
                            // its server-side history; mock rows have
                            // no apiSeqNo so the dialog falls back to
                            // the legacy seed inside its loader.
                            if (isServerRow(row)) {
                                setAuditLogsFor(row);
                            } else {
                                setAuditLogsFor(null);
                            }
                            setAuditLogsOpen(true);
                        }}
                        openMenuRowId={openMenu?.rowId ?? null}
                        onRowMenuToggle={(rowId, rect) => {
                            // Atomic swap — clicking row B's kebab
                            // while row A's menu is open closes A and
                            // opens B in a single render. Clicking the
                            // same row's kebab again toggles closed.
                            setOpenMenu((prev) =>
                                prev?.rowId === rowId
                                    ? null
                                    : { rowId, rect },
                            );
                        }}
                    />
                    {/* Empty + loading + error states. `flex-1` so the
                       message fills the area below the sticky table
                       header and centers both axes — matches the VAS
                       Account empty-state (CLAUDE.md §3a). Each state
                       renders only when the live data is genuinely absent. */}
                    {rows.length === 0 && (
                        <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                            {stickyListLoading
                                ? t("common.loading")
                                : listState.error
                                  ? t("settings.login_credentials.load_error")
                                  : t("settings.login_credentials.empty")}
                        </div>
                    )}
                    </div>
                </div>
            </div>

            {/* Row-action menu — Figma 2236:30291. Rendered at the
               panel level (not inside the table cell) so it can portal
               to document.body and use position: fixed anchored to the
               kebab's bounding rect — escapes the table's scroll
               container without being clipped. The menu owns its own
               ESC + outside-click dismissal. */}
            {openMenu && (() => {
                const row = rows.find((r) => r.id === openMenu.rowId);
                if (!row) return null;
                return (
                    <LoginCredentialsRowMenu
                        anchorRect={openMenu.rect}
                        institution={row.institution}
                        onEdit={() => {
                            // GDT routes to the Account Management
                            // popup. Bank rows open the Edit Login
                            // ID/PW dialog directly (image 2 in the
                            // 2026-05-15 Figma — single account, ID
                            // read-only + New Password + Confirm).
                            // Multi-account rows still need the
                            // Registered list to pick which account
                            // — fall through to it when accounts > 1.
                            setOpenMenu(null);
                            if (row.institution === "GDT") {
                                setAddChild({ kind: "gdt" });
                                return;
                            }
                            if (!isServerRow(row)) {
                                // Static mock rows have no server
                                // identity; nothing meaningful to do.
                                return;
                            }
                            if (row.accounts.length > 1) {
                                // Multi-account → open Registered so
                                // the user can pick which login to edit.
                                setRegisteredRow(row);
                                setRegisteredChild(null);
                                return;
                            }
                            // Single-account → straight to Edit dialog.
                            setEditRow(row);
                        }}
                        onDelete={() => {
                            // Confirmation → DELETE → refresh. Static
                            // mock rows have no apiSeqNo so we skip
                            // the network call and just close the menu.
                            dialog.open({
                                type: "confirmation",
                                title: t("dialog.confirmation"),
                                description: t(
                                    "settings.login_credentials.delete_confirm",
                                ),
                                confirmText: t("dialog.continue"),
                                cancelText: t("dialog.cancel"),
                                onConfirm: () => {
                                    if (!isServerRow(row)) {
                                        // Static fallback row — no
                                        // server-side identity to act on.
                                        setOpenMenu(null);
                                        return;
                                    }
                                    deleteLoginCredential(row.apiType, row.apiSeqNo)
                                        .then(() => {
                                            setOpenMenu(null);
                                            setRefreshTick((n) => n + 1);
                                            dialog.open({
                                                type: "success",
                                                title: t("dialog.success"),
                                                description: t(
                                                    "settings.login_credentials.delete_success",
                                                ),
                                            });
                                        })
                                        .catch((err) => {
                                            setOpenMenu(null);
                                            const code = err instanceof ApiCallError ? err.code : "WBE9999";
                                            const message = err instanceof ApiCallError ? err.message : t("dialog.error");
                                            dialog.open({
                                                type: "error",
                                                title: t("dialog.error"),
                                                description: message,
                                                errorCode: code,
                                            });
                                        });
                                },
                            });
                        }}
                        onClose={() => setOpenMenu(null)}
                    />
                );
            })()}

            {/* Audit Logs dialog — Figma 3435:22565. Independent flow,
               opens from the table's Audit Logs link; not part of the
               Registered chain. */}
            {auditLogsOpen && (
                <AuditLogsDialog
                    title={t("settings.login_credentials.audit_logs.title")}
                    description={t("settings.login_credentials.audit_logs.description")}
                    rows={auditLogRows}
                    onClose={() => {
                        setAuditLogsOpen(false);
                        setAuditLogsFor(null);
                    }}
                />
            )}

            {/* Add-credentials flow — Figma chain Add button →
               Select-a-login-institution → Select Bank → Login ID/PW
               → Select Bank Accounts → Save → success → close all.
               Mirrors the Registered chain's downstream behaviour
               (each transition is a single atomic `setAddChild`
               swap so React commits unmount + mount in the same
               render — no flicker). Cancel on any step ends the
               whole flow and returns the user to the panel; Settings
               stays mounted regardless. */}

            {addChild?.kind === "institution" && (
                <SelectLoginInstitutionDialog
                    onCancel={() => setAddChild(null)}
                    onNext={(institutionId) => {
                        // Branch on the stable institution id so the
                        // chain is locale-independent. GDT collapses
                        // the bank-side multi-step chain into a
                        // single Account Management popup.
                        if (institutionId === "GDT") {
                            setAddChild({ kind: "gdt" });
                            return;
                        }
                        // Atomic swap to Select Bank — clear any
                        // bank draft from a previous run so the
                        // dropdown opens fresh.
                        setAddBankSearchValue("");
                        setAddSelectedBank(null);
                        setAddChild({ kind: "bank" });
                    }}
                />
            )}

            {/* GDT credentials popup — Figma 2344:21946. Sibling of
               the Bank-branch's Select Bank step (both follow the
               institution picker). Static UI: Next fires the shared
               success dialog and collapses the entire Add chain
               back to the panel; Cancel / X / ESC dismiss back to
               the panel without firing success. */}
            {addChild?.kind === "gdt" && (() => {
                // Find the tenant's existing GDT row (if any) so the
                // dialog acts as an upsert: POST when no row exists,
                // PUT against the existing seq_no otherwise. Mirrors
                // legacy `comm_0218_007_c001`'s upsert behaviour.
                const existingGdt = rows.find((r) => r.apiType === "gdt") ?? null;

                return (
                    <GdtCredentialsDialog
                        onCancel={() => setAddChild(null)}
                        nextDisabled={mutationInFlight}
                        onNext={(values) => {
                            if (mutationInFlight) return;
                            setMutationInFlight(true);
                            const collapseChain = () => {
                                setAddChild(null);
                                setAddSelectedBank(null);
                                setAddBankSearchValue("");
                                setRefreshTick((n) => n + 1);
                            };
                            const onSuccess = () => {
                                dialog.open({
                                    type: "success",
                                    title: t("dialog.success"),
                                    description: t(
                                        "settings.login_credentials.gdt.save_success",
                                    ),
                                    onConfirm: collapseChain,
                                    onClose: collapseChain,
                                });
                            };

                            const promise = existingGdt && existingGdt.apiSeqNo > 0
                                ? updateGdtLoginCredential(existingGdt.apiSeqNo, {
                                      login_id: values.userName,
                                      password: values.password,
                                  })
                                : createGdtLoginCredential({
                                      login_id: values.userName,
                                      password: values.password,
                                  }).then(() => undefined);

                            promise
                                .then(onSuccess)
                                .catch(showMutationError)
                                .finally(() => setMutationInFlight(false));
                        }}
                    />
                );
            })()}

            {addChild?.kind === "bank" && (
                <SelectBankDialog
                    value={addBankSearchValue}
                    onChange={setAddBankSearchValue}
                    onSelect={setAddSelectedBank}
                    nextDisabled={!addSelectedBank}
                    onNext={() => setAddChild({ kind: "login-id-pw" })}
                    onCancel={() => setAddChild(null)}
                    banks={liveBanks ?? undefined}
                />
            )}

            {addChild?.kind === "login-id-pw" && addSelectedBank && (
                <LoginIdPasswordDialog
                    key={`add-login-${addSelectedBank.id}`}
                    bankName={addSelectedBank.name}
                    bankCd={addSelectedBank.id}
                    bankLogo={renderBankHeroLogo(
                        addSelectedBank.id,
                        addSelectedBank.name,
                    )}
                    onChooseAnotherBank={() => {
                        // Rewind to Select Bank — drop the prior
                        // selection so the user can pick a different
                        // bank cleanly.
                        setAddBankSearchValue("");
                        setAddSelectedBank(null);
                        ensureLiveBanks();
                        setAddChild({ kind: "bank" });
                    }}
                    onLogin={(values) => {
                        // Two-phase commit:
                        //   1. POST /api/v1/login-credentials/bank →
                        //      row created (server-side AES-GCM
                        //      encryption, audit fan-out).
                        //   2. POST /api/v1/banking/scraping/account-list
                        //      with the new credentialSeqNo → real
                        //      NXISAS LOGIN against the bank. Branches
                        //      on the gateway response:
                        //        COMPLETED     → success + close chain
                        //        OTP_REQUIRED  → open OtpDialog, loop
                        //        ERROR / etc.  → delete the unverified
                        //                        row + show error
                        //
                        // The delete-on-error step keeps the panel from
                        // displaying a credential that doesn't actually
                        // log into the bank.
                        //
                        // NOTE on bank_cd: `BankOption.id` is the
                        // static picker's slug ("BIDV", "WOORI", ...).
                        // Real backend BANK_CDs (e.g. "11704020") live
                        // in BANK_INFM; until the picker is driven by
                        // the registry, the slug is the wire value.
                        if (mutationInFlight) return;
                        setMutationInFlight(true);
                        createBankLoginCredential({
                            bank_cd:           addSelectedBank.id,
                            login_id:          values.id,
                            password:          values.password,
                            nxisas_gb_seq_no:  values.nxisasGbSeqNo,
                            extra:             values.extra || undefined,
                            login_type:        values.loginType || undefined,
                        })
                            .then((created) => {
                                // Kick off the live bank-side verification.
                                // Hold off on refreshing the list — the
                                // credential is unverified until the
                                // scrape returns COMPLETED. The legacy
                                // panel never paints an unverified row
                                // either. If the scrape later branches
                                // to OTP_REQUIRED we refresh inside
                                // applyScrapeResult so the user can
                                // close the OTP dialog and see the
                                // pending row.
                                return startScrape(String(created.seq_no))
                                    .then((scrape) => {
                                        // No refresh here — the
                                        // credential is still
                                        // unverified until the scrape
                                        // reports COMPLETED. Showing
                                        // the row mid-challenge lies
                                        // to the user. applyScrapeResult
                                        // fires setRefreshTick itself
                                        // on COMPLETED; the cancel /
                                        // error paths run deleteLogin
                                        // + setRefreshTick before
                                        // surfacing the error.
                                        applyScrapeResult(
                                            scrape,
                                            created.seq_no,
                                            // On COMPLETED transition
                                            // to Select Bank Accounts
                                            // step (legacy parity) —
                                            // user picks rows there,
                                            // success collapses then.
                                            () => setAddChild({
                                                kind: "select-bank-accounts",
                                            }),
                                            {
                                                bankName: addSelectedBank.name,
                                                loginId:  values.id,
                                            },
                                        );
                                    })
                                    .catch(async (err) => {
                                        // Scrape rejected (WBE2093,
                                        // gateway 5xx, etc.) — the
                                        // credential is unverified and
                                        // must NOT appear in the list.
                                        // Await the delete BEFORE the
                                        // list refresh so the failed
                                        // row doesn't flash on-screen.
                                        try {
                                            await deleteLoginCredential(
                                                "bank",
                                                created.seq_no,
                                            );
                                        } catch {
                                            // If cleanup itself fails,
                                            // log and continue — the
                                            // user still needs to see
                                            // the scrape error below.
                                        }
                                        setRefreshTick((n) => n + 1);
                                        throw err;
                                    });
                            })
                            .catch(showMutationError)
                            .finally(() => setMutationInFlight(false));
                    }}
                    loginDisabled={mutationInFlight}
                    onCancel={() => setAddChild(null)}
                />
            )}

            {addChild?.kind === "select-bank-accounts" && addSelectedBank && (
                <SelectBankAccountsDialog
                    key={`add-bank-accounts-${addSelectedBank.id}`}
                    bankName={addSelectedBank.name}
                    bankLogo={renderBankHeroLogo(
                        addSelectedBank.id,
                        addSelectedBank.name,
                    )}
                    // Live accounts from the NXISAS scrape (legacy
                    // fnsh_0101_001_r001 parity). Empty array while
                    // null means the chain reached this step without
                    // a fresh scrape — the dialog renders an empty
                    // table rather than the static mock.
                    rows={scrapedAccounts ?? []}
                    onBack={() => setAddChild({ kind: "login-id-pw" })}
                    saveDisabled={mutationInFlight}
                    onSave={(pickedRows) => {
                        // POST to /accounts/register, then collapse the
                        // Add chain on success. Mirrors legacy
                        // fnsh_0101_001_c001 (comm_0218_nxisas.ts:1188).
                        const collapseChain = () => {
                            setAddChild(null);
                            setAddSelectedBank(null);
                            setAddBankSearchValue("");
                            setScrapedAccounts(null);
                            setRegistrationCredentialSeqNo(null);
                            setRefreshTick((n) => n + 1);
                        };
                        persistPickedAccounts(pickedRows, collapseChain);
                    }}
                />
            )}

            {/* Registered Login Credentials dialog — Figma 3881:22605.
               Stays mounted as the parent of the entire chain. `key`
               re-seeds the per-row password reveal state when switching
               from row A to row B. */}
            {registeredRow && (
                <RegisteredLoginCredentialsDialog
                    key={`registered-${registeredRow.id}`}
                    institutionName={registeredRow.institution}
                    logo={renderBankHeroLogo(
                        isServerRow(registeredRow) ? registeredRow.bankCd : null,
                        registeredRow.institution,
                    )}
                    entries={buildRegisteredCredentialEntries(registeredRow).map((entry) =>
                        // Patch in the decrypted password if the user
                        // has already revealed this loginId in this
                        // session. Other entries keep their masked
                        // placeholder until the user re-auths for them.
                        revealedByLoginId[entry.loginId]
                            ? { ...entry, password: revealedByLoginId[entry.loginId] }
                            : entry,
                    )}
                    onClose={closeRegistered}
                    onPasswordIconClick={(entry) => {
                        // Open Confirmation as a CHILD on top of
                        // Registered. Registered stays mounted behind.
                        setConfirmValue("");
                        setRegisteredChild({ kind: "confirmation", entry });
                    }}
                    onEdit={(entry) => {
                        // Open Edit Login ID/PW as a CHILD on top of
                        // Registered, seeded with the row's loginId for
                        // the read-only ID field. Registered stays
                        // mounted behind.
                        setRegisteredChild({
                            kind: "edit-login-id-pw",
                            entry,
                        });
                    }}
                    onAddLogin={() => {
                        // Open Login ID/PW as a CHILD on top of
                        // Registered. Registered stays mounted behind.
                        setRegisteredChild({ kind: "login-id-pw" });
                    }}
                    onRemove={(entry) => {
                        // Per-row red-minus button — legacy
                        // comm_0218_006.eventDeleteAcc. Confirm, then
                        // DELETE this single login credential (its
                        // ACCT_MSTR rows cascade server-side only when
                        // it's the last credential at the bank — see
                        // LoginCredentialsService.delete).
                        if (!isServerRow(registeredRow)) return;
                        const account = registeredRow.accounts.find(
                            (a) => a.loginId === entry.loginId,
                        );
                        if (typeof account?.seqNo !== "number") return;
                        const seqNo = account.seqNo;
                        dialog.open({
                            type: "confirmation",
                            title: t("dialog.confirmation"),
                            description: t(
                                "settings.login_credentials.delete_confirm",
                            ),
                            confirmText: t("dialog.continue"),
                            cancelText: t("dialog.cancel"),
                            onConfirm: () => {
                                if (mutationInFlight) return;
                                setMutationInFlight(true);
                                deleteLoginCredential(registeredRow.apiType, seqNo)
                                    .then(() => {
                                        setRefreshTick((n) => n + 1);
                                        // If the row had only this one
                                        // login, the Registered dialog
                                        // now has nothing to show —
                                        // collapse. Otherwise stay
                                        // open so the user can see the
                                        // remaining logins update.
                                        if (registeredRow.accounts.length <= 1) {
                                            closeRegistered();
                                        }
                                        dialog.open({
                                            type: "success",
                                            title: t("dialog.success"),
                                            description: t(
                                                "settings.login_credentials.delete_success",
                                            ),
                                        });
                                    })
                                    .catch(showMutationError)
                                    .finally(() => setMutationInFlight(false));
                            },
                        });
                    }}
                    onDisconnect={() => {
                        // Footer "Disconnect" — legacy
                        // comm_0218_006.eventDisconnect: loops over
                        // BANK_REC and deletes every credential at
                        // this institution. The server-side cascade
                        // wipes ACCT_MSTR rows for the bank when the
                        // final credential is removed, so the user's
                        // accounts disappear from Banking > Account
                        // Inquiry alongside the credential set.
                        if (!isServerRow(registeredRow)) return;
                        const seqNos = registeredRow.accounts
                            .map((a) => a.seqNo)
                            .filter((n): n is number => typeof n === "number");
                        if (seqNos.length === 0) return;
                        dialog.open({
                            type: "confirmation",
                            title: t("dialog.confirmation"),
                            description: t(
                                "settings.login_credentials.disconnect_confirm",
                            ),
                            confirmText: t("dialog.continue"),
                            cancelText: t("dialog.cancel"),
                            destructive: true,
                            onConfirm: () => {
                                if (mutationInFlight) return;
                                setMutationInFlight(true);
                                // Serial delete (matches the legacy loop).
                                // Parallel would race on the cascade
                                // count check on the server.
                                const apiType = registeredRow.apiType;
                                const runAll = seqNos.reduce<Promise<void>>(
                                    (chain, seqNo) =>
                                        chain.then(() =>
                                            deleteLoginCredential(apiType, seqNo),
                                        ),
                                    Promise.resolve(),
                                );
                                runAll
                                    .then(() => {
                                        setRefreshTick((n) => n + 1);
                                        closeRegistered();
                                        dialog.open({
                                            type: "success",
                                            title: t("dialog.success"),
                                            description: t(
                                                "settings.login_credentials.disconnect_success",
                                            ),
                                        });
                                    })
                                    .catch(showMutationError)
                                    .finally(() => setMutationInFlight(false));
                            },
                        });
                    }}
                />
            )}

            {/* Login ID/PW form popup — Figma 1081:25293. Renders as a
               child Radix dialog over Registered. Login auto-enables
               inside the dialog when all 3 fields are filled; clicking
               Login swaps the child to Select Bank Accounts (single
               atomic setState — same pattern as Choose another bank). */}
            {registeredRow && registeredChild?.kind === "login-id-pw" && (() => {
                // Registered chain's "Add Login" — adds a new
                // credential row under the same BANK_CD as the
                // currently-open Registered row. Needs a server row
                // (we read bank_cd off it) to POST against; if a
                // mock fallback row is somehow open, the Login button
                // stays disabled.
                const serverRow = isServerRow(registeredRow) ? registeredRow : null;
                // Allow the user to pick a different bank if they
                // navigated via Choose another bank — selectedBank
                // overrides the parent row's bank in that case.
                const targetBankCd =
                    selectedBank?.id ?? serverRow?.bankCd ?? null;

                return (
                    <LoginIdPasswordDialog
                        key={`add-login-${registeredRow.id}-${targetBankCd ?? "none"}`}
                        bankName={selectedBank?.name ?? registeredRow.institution}
                        bankCd={targetBankCd ?? undefined}
                        bankLogo={renderBankHeroLogo(
                            targetBankCd,
                            selectedBank?.name ?? registeredRow.institution,
                        )}
                        onChooseAnotherBank={() => {
                            // Replace the child WITH Select Bank — Registered
                            // stays mounted behind. Single setState call so
                            // the Login ID/PW unmount and Select Bank mount
                            // are atomic with respect to React's commit.
                            setBankSearchValue("");
                            setSelectedBank(null);
                            ensureLiveBanks();
                            setRegisteredChild({ kind: "select-bank" });
                        }}
                        loginDisabled={mutationInFlight || !targetBankCd}
                        onLogin={(values) => {
                            // Same two-phase commit as the Add flow:
                            // create the credential, then scrape against
                            // the bank to verify; delete on failure.
                            if (mutationInFlight || !targetBankCd) return;
                            setMutationInFlight(true);
                            createBankLoginCredential({
                                bank_cd:           targetBankCd,
                                login_id:          values.id,
                                password:          values.password,
                                nxisas_gb_seq_no:  values.nxisasGbSeqNo,
                                extra:             values.extra || undefined,
                                login_type:        values.loginType || undefined,
                            })
                                .then((created) => {
                                    // Defer the list refresh — same
                                    // reasoning as the Add flow above:
                                    // the credential is unverified
                                    // until the scrape returns
                                    // COMPLETED, so don't paint a
                                    // pending row that may need to be
                                    // deleted seconds later.
                                    return startScrape(String(created.seq_no))
                                        .then((scrape) => {
                                            // Same as Add flow above —
                                            // no eager refresh; the
                                            // credential stays hidden
                                            // until the challenge
                                            // completes (or the user
                                            // cancels + deletes).
                                            applyScrapeResult(
                                                scrape,
                                                created.seq_no,
                                                // Legacy parity —
                                                // transition to Select
                                                // Bank Accounts step.
                                                () => setRegisteredChild({
                                                    kind: "select-bank-accounts",
                                                }),
                                                {
                                                    bankName: selectedBank?.name
                                                        ?? registeredRow.institution,
                                                    loginId:  values.id,
                                                },
                                            );
                                        })
                                        .catch(async (err) => {
                                            // Await the delete BEFORE
                                            // refreshing so the failed
                                            // row never flashes.
                                            try {
                                                await deleteLoginCredential(
                                                    "bank",
                                                    created.seq_no,
                                                );
                                            } catch {
                                                // Cleanup failure is
                                                // swallowed — proceed
                                                // to surface the scrape
                                                // error to the user.
                                            }
                                            setRefreshTick((n) => n + 1);
                                            throw err;
                                        });
                                })
                                .catch(showMutationError)
                                .finally(() => setMutationInFlight(false));
                        }}
                        onCancel={closeChild}
                    />
                );
            })()}

            {/* Select Bank popup — Figma 1081:25861. Sibling child of
               Login ID/PW (mutually exclusive); both share Registered as
               the parent. Next swaps the child back to Login ID/PW —
               same atomic-setState pattern as the reverse transition,
               so neither popup ever flickers off-screen alongside its
               replacement. `selectedBank` is intentionally NOT cleared
               here so a future Login ID/PW pass can read it. */}
            {registeredRow && registeredChild?.kind === "select-bank" && (
                <SelectBankDialog
                    value={bankSearchValue}
                    onChange={setBankSearchValue}
                    onSelect={setSelectedBank}
                    nextDisabled={!selectedBank}
                    onNext={() => setRegisteredChild({ kind: "login-id-pw" })}
                    onCancel={closeChild}
                    banks={liveBanks ?? undefined}
                />
            )}

            {/* Select Bank Accounts popup — Figma 1081:25485. Sibling of
               Login ID/PW + Select Bank + Confirmation. Back swaps the
               child back to Login ID/PW (single atomic setState — Login
               ID/PW remounts via its `key` so the form fields are reset).
               Save fires the shared system success dialog; OK collapses
               the entire Registered chain back to the Login Credentials
               panel — the parent Settings modal is owned by the shell
               and stays mounted regardless. */}
            {registeredRow && registeredChild?.kind === "select-bank-accounts" && (
                <SelectBankAccountsDialog
                    key={`select-bank-accounts-${registeredRow.id}`}
                    bankName={selectedBank?.name ?? registeredRow.institution}
                    bankLogo={renderBankHeroLogo(
                        selectedBank?.id
                            ?? (isServerRow(registeredRow)
                                ? registeredRow.bankCd
                                : null),
                        selectedBank?.name ?? registeredRow.institution,
                    )}
                    // Live accounts from the NXISAS scrape (legacy
                    // fnsh_0101_001_r001 parity).
                    rows={scrapedAccounts ?? []}
                    onBack={() => setRegisteredChild({ kind: "login-id-pw" })}
                    saveDisabled={mutationInFlight}
                    onSave={(pickedRows) => {
                        // POST to /accounts/register, then tear down
                        // every popup in the Registered chain. Same
                        // collapse rules as the Add flow above; the
                        // Registered + parent row are also cleared so
                        // the user lands on the Login Credentials panel.
                        const collapseChain = () => {
                            setRegisteredChild(null);
                            setRegisteredRow(null);
                            setSelectedBank(null);
                            setBankSearchValue("");
                            setScrapedAccounts(null);
                            setRegistrationCredentialSeqNo(null);
                            setRefreshTick((n) => n + 1);
                        };
                        persistPickedAccounts(pickedRows, collapseChain);
                    }}
                />
            )}

            {/* Edit Login ID/PW popup — Figma 2781:23399. Sibling of
               Login ID/PW + Select Bank + Select Bank Accounts +
               Confirmation. The ID field is rendered read-only (gray)
               from the row's loginId; only the password fields are
               editable. Cancel + Save both close back to Registered.
               `key` re-seeds the form state when switching between
               rows so opening row B after row A doesn't carry row A's
               draft password. */}
            {registeredRow && registeredChild?.kind === "edit-login-id-pw" && (() => {
                // Find the server-side SEQ_NO + apiType for the entry
                // being edited so the PUT targets the right row. The
                // dialog edits the password only (the ID field is
                // read-only in the dialog markup); we forward both
                // form values for forward-compat with backend updates.
                const entry = registeredChild.entry;
                const serverRow = isServerRow(registeredRow) ? registeredRow : null;
                const account = registeredRow.accounts.find((a) => a.loginId === entry.loginId);
                // Lock Save while the verify call is in flight OR a
                // challenge dialog (Security Question / OTP / CAPTCHA) is
                // stacked on top awaiting the user — same gate as the
                // standalone kebab-edit path below.
                const canSubmit =
                    !!serverRow &&
                    typeof account?.seqNo === "number" &&
                    account.seqNo > 0 &&
                    !mutationInFlight &&
                    scrapeSession === null;

                return (
                    <EditLoginIdPasswordDialog
                        key={`edit-login-${entry.loginId}`}
                        idValue={entry.loginId}
                        onCancel={closeChild}
                        saveDisabled={!canSubmit}
                        onSave={(values) => {
                            if (!serverRow || typeof account?.seqNo !== "number") {
                                closeChild();
                                return;
                            }
                            const seqNo = account.seqNo;
                            setMutationInFlight(true);
                            // GDT rows don't run NXISAS — keep the simple
                            // update-and-done flow.
                            if (serverRow.apiType !== "bank") {
                                updateGdtLoginCredential(seqNo, {
                                    password: values.newPassword,
                                })
                                    .then(() => {
                                        closeChild();
                                        setRefreshTick((n) => n + 1);
                                        dialog.open({
                                            type: "success",
                                            title: t("dialog.success"),
                                            description: t(
                                                "settings.login_credentials.edit_success",
                                            ),
                                        });
                                    })
                                    .catch(showMutationError)
                                    .finally(() => setMutationInFlight(false));
                                return;
                            }
                            // Bank rows: VERIFY-FIRST. Run NXISAS LOGIN with
                            // the new password against the stored bank
                            // context — the verify-update call never touches
                            // the DB. Only after a final COMPLETED (and any
                            // Security Question / OTP / CAPTCHA challenge)
                            // does applyScrapeResult auto-persist via
                            // updateBankLoginCredential. On wrong-password /
                            // error the existing row stays untouched
                            // (deleteOnError:false — Edit, not Add). Same
                            // pattern as the standalone kebab-edit path.
                            verifyBankPasswordUpdate(seqNo, values.newPassword)
                                .then((scrape) => {
                                    applyScrapeResult(
                                        scrape,
                                        seqNo,
                                        () => {
                                            // COMPLETED — the PUT already ran
                                            // inside applyScrapeResult; close
                                            // the Edit child (back to
                                            // Registered) and surface success.
                                            closeChild();
                                            dialog.open({
                                                type: "success",
                                                title: t("dialog.success"),
                                                description: t(
                                                    "settings.login_credentials.edit_success",
                                                ),
                                            });
                                        },
                                        {
                                            bankName: registeredRow.institution,
                                            loginId: entry.loginId,
                                            deleteOnError: false,
                                            pendingNewPassword: values.newPassword,
                                        },
                                    );
                                })
                                .catch((err) => {
                                    // Verify threw at transport level — DB
                                    // never touched. Close + surface error.
                                    closeChild();
                                    showMutationError(err);
                                })
                                .finally(() => setMutationInFlight(false));
                        }}
                    />
                );
            })()}

            {/* Standalone Edit Login ID/PW dialog opened from the
               panel kebab menu (single-account rows). Distinct from
               the Registered chain's Edit because there's no parent
               Registered dialog mounted — opens at stackLevel={2}
               directly over the Settings shell. */}
            {editRow && (() => {
                const account = editRow.accounts[0];
                const seqNo = account?.seqNo;
                // saveDisabled stays true while EITHER the verify call
                // is in flight (mutationInFlight) OR a challenge dialog
                // is stacked on top awaiting the user's response
                // (scrapeSession non-null). Both states must keep the
                // loading bar visible + inputs locked + the dialog
                // mounted. The dialog only closes via the COMPLETED
                // callback or the explicit error / cancel paths.
                const scrapeInFlight = scrapeSession !== null;
                const canSubmit =
                    typeof seqNo === "number"
                    && seqNo > 0
                    && !mutationInFlight
                    && !scrapeInFlight;
                const closeEdit = () => setEditRow(null);
                return (
                    <EditLoginIdPasswordDialog
                        key={`kebab-edit-${editRow.id}`}
                        stackLevel={2}
                        idValue={account?.loginId ?? ""}
                        onCancel={closeEdit}
                        saveDisabled={!canSubmit}
                        onSave={(values) => {
                            if (typeof seqNo !== "number") {
                                closeEdit();
                                return;
                            }
                            const isBankRow = editRow.apiType === "bank";
                            setMutationInFlight(true);
                            // GDT rows don't run NXISAS — keep the
                            // simple update-and-done flow.
                            if (!isBankRow) {
                                updateGdtLoginCredential(seqNo, {
                                    password: values.newPassword,
                                })
                                    .then(() => {
                                        closeEdit();
                                        setRefreshTick((n) => n + 1);
                                        dialog.open({
                                            type: "success",
                                            title: t("dialog.success"),
                                            description: t(
                                                "settings.login_credentials.edit_success",
                                            ),
                                        });
                                    })
                                    .catch(showMutationError)
                                    .finally(() => setMutationInFlight(false));
                                return;
                            }
                            // Bank rows: VERIFY-FIRST. Run NXISAS LOGIN
                            // with the new password against the stored
                            // bank context — backend never touches the
                            // DB. Only after a final COMPLETED (and any
                            // required challenges) does applyScrapeResult
                            // auto-persist via updateBankLoginCredential.
                            // On any error / wrong-password outcome,
                            // the existing row stays untouched (old
                            // password intact, no schema mutation).
                            //
                            // The Edit dialog stays MOUNTED throughout
                            // the scrape — saveDisabled drives the
                            // indeterminate loading bar + locks the
                            // inputs. Challenge dialogs (OTP / QNA /
                            // CAPTCHA) stack on top at stackLevel={4}.
                            // The dialog only closes inside the
                            // onAccountsReady callback below (on a
                            // confirmed COMPLETED outcome) or via the
                            // error / cancel paths.
                            verifyBankPasswordUpdate(seqNo, values.newPassword)
                                .then((scrape) => {
                                    applyScrapeResult(
                                        scrape,
                                        seqNo,
                                        () => {
                                            // COMPLETED callback —
                                            // PUT already done inside
                                            // applyScrapeResult; close
                                            // the Edit dialog and
                                            // surface success.
                                            closeEdit();
                                            dialog.open({
                                                type: "success",
                                                title: t("dialog.success"),
                                                description: t(
                                                    "settings.login_credentials.edit_success",
                                                ),
                                            });
                                        },
                                        {
                                            bankName:           editRow.institution,
                                            loginId:            account?.loginId ?? "",
                                            // Edit ≠ Add: row pre-existed,
                                            // wrong-password ERROR must
                                            // NOT delete it.
                                            deleteOnError:      false,
                                            // Stash the typed password so
                                            // the COMPLETED branch of
                                            // applyScrapeResult can PUT
                                            // it after bank verification.
                                            pendingNewPassword: values.newPassword,
                                        },
                                    );
                                })
                                .catch((err) => {
                                    // Verify call itself threw at the
                                    // transport level (4xx/5xx). The DB
                                    // row was never touched. Close the
                                    // Edit dialog and surface the error.
                                    closeEdit();
                                    showMutationError(err);
                                })
                                .finally(() => setMutationInFlight(false));
                        }}
                    />
                );
            })()}

            {/* Password reveal confirmation popup — legacy
               {@code comm_0218_008} parity. Renders the simple
               Confirmation layer popup (title + Current password field +
               helper + Close/Save) — distinct from the Lock Screen
               identity card used by the global session-expiry surface.
               Static UI: Save stays disabled until the user types a
               password AND the row has a real {@code seqNo}, so closing
               returns the user to Registered with the row still masked. */}
            {registeredRow && registeredChild?.kind === "confirmation" && (() => {
                const entry = registeredChild.entry;
                // Find the matching account on the current row so we
                // know which SEQ_NO to reveal. Mock rows lack `seqNo`,
                // so on those the dialog stays in static-only mode
                // (Save no-ops, same as the legacy behaviour).
                const serverRow = isServerRow(registeredRow) ? registeredRow : null;
                const account = registeredRow.accounts.find((a) => a.loginId === entry.loginId);
                const canReveal =
                    !!serverRow &&
                    typeof account?.seqNo === "number" &&
                    account.seqNo > 0 &&
                    confirmValue.length > 0 &&
                    !revealInFlight;

                const handleReveal = () => {
                    if (!serverRow || typeof account?.seqNo !== "number") return;
                    setRevealInFlight(true);
                    revealLoginCredential(serverRow.apiType, account.seqNo, {
                        user_password: confirmValue,
                    })
                        .then((res) => {
                            // Stash the plaintext keyed by loginId — the
                            // popover patches it on next render.
                            const plain = res.password ?? "";
                            setRevealedByLoginId((prev) => ({
                                ...prev,
                                [entry.loginId]: plain,
                            }));
                            setConfirmValue("");
                            closeChild();
                            // Explicit success feedback — the common
                            // SystemDialog renders at z-[100], above the
                            // stacked Registered popup, so it isn't hidden.
                            // Refresh the list too (the revealed password
                            // is kept in revealedByLoginId across the
                            // refetch, so the row still shows it).
                            setRefreshTick((n) => n + 1);
                            dialog.open({
                                type: "success",
                                title: t("dialog.success"),
                                description: t(
                                    "settings.login_credentials.reveal_success",
                                ),
                            });
                        })
                        .catch((err) => {
                            const code =
                                err instanceof ApiCallError ? err.code : "WBE9999";
                            const message =
                                err instanceof ApiCallError
                                    ? err.message
                                    : t("dialog.error");
                            dialog.open({
                                type: "error",
                                title: t("dialog.error"),
                                description: message,
                                errorCode: code,
                            });
                        })
                        .finally(() => setRevealInFlight(false));
                };

                return (
                    <RevealPasswordConfirmDialog
                        title={t("settings.login_credentials.confirmation.title")}
                        label={t("settings.login_credentials.confirmation.label")}
                        requiredText={t("settings.login_credentials.confirmation.required")}
                        placeholder={t("settings.login_credentials.confirmation.placeholder")}
                        helper={t("settings.login_credentials.confirmation.helper")}
                        value={confirmValue}
                        onChange={setConfirmValue}
                        onClose={() => {
                            setConfirmValue("");
                            closeChild();
                        }}
                        onSave={handleReveal}
                        saveDisabled={!canReveal}
                    />
                );
            })()}

            {/* OTP dialog for the NXISAS scrape that runs immediately
               after creating a bank credential. The gateway returns
               OTP_REQUIRED when the bank challenges with a one-time
               code; we surface the prompt verbatim (the gateway
               localises in some adapters). Cancel deletes the
               unverified credential so the user isn't left with a row
               that doesn't really log into the bank. */}
            {scrapeSession && (() => {
                const session = scrapeSession;
                // On challenge completion, push the same flow we were
                // in (Add or Registered) to its select-bank-accounts
                // step. Whichever `*Child` is currently sitting on
                // `"login-id-pw"` is the active flow.
                const advanceToAccounts = () => {
                    if (registeredChild?.kind === "login-id-pw") {
                        setRegisteredChild({ kind: "select-bank-accounts" });
                    } else {
                        setAddChild({ kind: "select-bank-accounts" });
                    }
                };
                const cleanupOnAbandon = () => {
                    // Only delete the credential row when it was
                    // unverified to begin with (Add flow). For Edit
                    // (deleteOnError: false), the row predates the
                    // challenge — cancelling the OTP / QNA / CAPTCHA
                    // dialog should leave the existing credential
                    // intact and just close the challenge.
                    if (session.deleteOnError) {
                        deleteLoginCredential("bank", session.credentialSeqNo)
                            .catch(() => {});
                    }
                    setRefreshTick((n) => n + 1);
                    setScrapeSession(null);
                };
                const handleSubmitError = async (err: unknown) => {
                    // Challenge POST threw at transport level (4xx/5xx)
                    // — drop the unverified credential and surface.
                    cleanupOnAbandon();
                    showMutationError(err);
                };

                if (session.kind === "QNA") {
                    const handleQnaSubmit = async (payload: {
                        hidden_value: string;
                        question:     string;
                        answer:       string;
                    }) => {
                        try {
                            const res = await submitScrapeQna(
                                session.sessionId,
                                payload,
                            );
                            applyScrapeResult(
                                res,
                                session.credentialSeqNo,
                                advanceToAccounts,
                            );
                        } catch (err) {
                            handleSubmitError(err);
                        }
                    };
                    return (
                        <QnaDialog
                            bankName={session.bankName}
                            loginId={session.loginId}
                            questions={session.qnaQuestions}
                            onSubmit={handleQnaSubmit}
                            onCancel={cleanupOnAbandon}
                        />
                    );
                }

                if (session.kind === "CAPTCHA") {
                    const handleCaptchaSubmit = async (value: string) => {
                        try {
                            const res = await submitScrapeCaptcha(
                                session.sessionId,
                                value,
                            );
                            applyScrapeResult(
                                res,
                                session.credentialSeqNo,
                                advanceToAccounts,
                            );
                        } catch (err) {
                            handleSubmitError(err);
                        }
                    };
                    return (
                        <CaptchaDialog
                            image={session.captchaImage}
                            format={session.captchaImageFormat}
                            onSubmit={handleCaptchaSubmit}
                            onCancel={cleanupOnAbandon}
                        />
                    );
                }

                // OTP (default)
                const handleOtpSubmit = async (value: string) => {
                    try {
                        const res = await submitScrapeOtp(session.sessionId, value);
                        applyScrapeResult(res, session.credentialSeqNo, advanceToAccounts);
                    } catch (err) {
                        handleSubmitError(err);
                    }
                };
                return (
                    <OtpDialog
                        prompt={session.challengePrompt}
                        onSubmit={handleOtpSubmit}
                        onCancel={cleanupOnAbandon}
                    />
                );
            })()}
        </div>
    );
}
