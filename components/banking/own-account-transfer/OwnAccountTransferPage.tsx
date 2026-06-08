"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import {
    isSpecialViewSettingField,
    useViewSetting,
    ViewSettingPopover,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DEFAULT_AREA_ID, SCREEN_IDS } from "@/lib/viewSettingScreens";

import EngineNotInstalledDialog from "./EngineNotInstalledDialog";
import EngineStatusBanner from "./EngineStatusBanner";
import EngineUnsupportedOsDialog from "./EngineUnsupportedOsDialog";
import OwnAccountTransferComposerDialog from "./OwnAccountTransferComposerDialog";
import NxisasSecondaryAuthPreview from "./preview/NxisasSecondaryAuthPreview";
import SourceAccountsTable from "./SourceAccountsTable";
import SourceAccountsTableFooter from "./SourceAccountsTableFooter";
import {
    SOURCE_ACCOUNTS_COLUMN_REGISTRY,
    SOURCE_ACCOUNTS_FIELD_LABEL_KEYS,
} from "./source-accounts-columns";
import { useNxisasEngine } from "./hooks/use-nxisas-engine";
import { useOwnAccountTransfer } from "./hooks/use-own-account-transfer";
import { hasSavedBankCert } from "@/lib/nxisas/jexjs-adapter";
import type { OwnAccountSourceRow } from "./types";

/**
 * Display-name fallback for the 5 OAT allow-list banks. The source-row
 * response carries the bank name resolved via `BANK_INFM` for every
 * row the tenant has — but a bank that's allow-listed and has no
 * account at this tenant has no row to mine, so the popover would fall
 * back to the raw `BANK_CD` (e.g. "11704003") — visible glitch on the
 * dropdown.
 *
 * <p>The five OAT banks are wire-stable per
 * {@code OwnAccountTransferConstants.ALLOWED_BANK_CDS_DEFAULT}; their
 * `BANK_INFM.RPRS_BANK_NM` values are equally stable in the registry.
 * Mapping them client-side avoids a second network round-trip for
 * something every page needs at first paint. If a row IS present for
 * a bank, the row's `bank_nm` still wins (it could carry a localized
 * override the registry hasn't picked up).
 */
const OAT_BANK_NAMES: Record<string, string> = {
    "11704088": "Shinhan(Vietnam)",
    "11704003": "IBK(Vietnam)",
    "11704004": "Vietcom Bank",
    "11704001": "Vietin Bank",
    "11704020": "Woori(Vietnam)",
};

/** Width override for the bank dropdown — the global
 *  `--w-wb-filter-bank` (105px) is sized for the short legacy "All
 *  Banks" label and clips Vietnamese names like "Shinhan(Vietnam)" /
 *  "Woori(Vietnam)". OAT needs ~180px to render the longest allow-list
 *  name + chevron without truncation. Applied to both the trigger and
 *  the popover so they stay aligned. */
const BANK_FILTER_WIDTH_CLASS = "w-[180px]";

/**
 * Fallback column set for the View Setting popover and the first paint.
 * Mirrors the V180 `SYS_SCR_OPTION_WECMS` seed for screenId
 * {@code own-account-transfer} / area {@code default}. Used until the
 * backend response resolves so the popover can open without a flash of
 * empty content.
 */
const FALLBACK_VS_COLUMNS: ViewSettingItem[] = [
    { field_id: "BANK_CD",          field_nm: "Bank",         disp_ord: 1,  disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "260px", sort_yn: "Y" },
    { field_id: "ACCT_NICK_NM",     field_nm: "Account",      disp_ord: 2,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "260px", sort_yn: "Y" },
    { field_id: "BAL",              field_nm: "Balance",      disp_ord: 3,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "AVI_BAL",          field_nm: "Available",    disp_ord: 4,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "ACCT_BAL_LST_STS", field_nm: "Last Refresh", disp_ord: 5,  disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "ETC",              field_nm: "Action",       disp_ord: 99, disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "140px", sort_yn: "N" },
];

/**
 * Banking > Own Account Transfer source-account picker page. The
 * client wrapper (see {@link OwnAccountTransferClient}) is thin — it
 * mounts this page once the dashboard auth guard has resolved.
 *
 * Page composition:
 *   - PageHeader + View Setting icon
 *   - Engine status banner (hidden when ready)
 *   - Bank filter
 *   - Source-account table + totals footer (Approval Box pattern)
 *   - Client-side pagination (PAGE_SIZE_OPTIONS shared constant)
 *   - Composer dialog (mounted only while open)
 */
export default function OwnAccountTransferPage() {
    const { t } = useTranslation();

    // DEV-only NXiSAS secondary-auth modal preview gate. Activated by
    // `?preview=nxisas` in the URL — mounts a floating trigger panel
    // (bottom-right) that lets reviewers open each of the 5 mock
    // engine modals (OTP / Security Question / CAPTCHA / Bank
    // Credentials / Transfer Confirm) without invoking the real
    // engine. Isolated from production flow: no engine calls, no
    // Spring calls, no side effects. Off by default — URL must
    // explicitly opt in.
    //
    // The preview modals share the SAME chrome the real popup-bridge
    // will use in Phase B, so what testers validate here is what
    // ships when the cert harness lands.
    const [previewActive, setPreviewActive] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        setPreviewActive(params.get("preview") === "nxisas");
    }, []);

    // Filter state — null = "all allowed banks" (server coerces
    // unsupported values per OQ-3 PO 2026-05-18).
    const [bankFilter, setBankFilter] = useState<string | null>(null);

    // Composer dialog — mounts when the user clicks Transfer on a row.
    // Holds the row so the dialog can seed Step-1's From-Bank chip + the
    // target loader. `null` keeps the dialog closed.
    const [composerSource, setComposerSource] = useState<OwnAccountSourceRow | null>(null);

    // Option-A deep-link context. The canonical menu route
    // (`/banking/transfer-own-accounts`) navigates here with the clicked
    // account in `?sourceAccountNo=` so we can preselect it and launch the
    // real transfer flow. Read once on mount via URLSearchParams (same
    // pattern as the `?preview=nxisas` gate above — no useSearchParams /
    // Suspense boundary needed). `acctNo` is the only stable key shared by
    // the list row and the source row (the list's `id` is `acct_seq_no`,
    // which `/source-accounts` rows don't carry).
    const [incomingSourceAcctNo, setIncomingSourceAcctNo] = useState<string | null>(null);
    // Latches once we've acted on the deep-link (opened the composer, or
    // determined the account is unknown) so a re-render / dialog-close never
    // re-triggers it.
    const deepLinkConsumedRef = useRef(false);
    useEffect(() => {
        if (typeof window === "undefined") return;
        const acctNo = new URLSearchParams(window.location.search).get(
            "sourceAccountNo",
        );
        setIncomingSourceAcctNo(acctNo && acctNo.trim() ? acctNo.trim() : null);
    }, []);

    // Common-sort state (CLAUDE.md §13a). Cycle is default → ASC →
    // DESC → default; the wire `FIELD_ID` is the View Setting key (e.g.
    // `BAL`, `BANK_CD`). The hook owns the cycle so headers stay
    // declarative.
    const sort = useTableSort();

    const engine = useNxisasEngine();
    const data   = useOwnAccountTransfer({ bankCd: bankFilter, sort: sort.sortParams });

    // Engine "not installed" surface — Figma 271:7388. The dialog opens
    // automatically as soon as the probe resolves not_installed; the
    // user may dismiss it (X icon) to keep browsing the source list,
    // and a subsequent retry that flips the status back to "ready"
    // (or any other non-not-installed state) clears the gate.
    // `installPromptDismissed` is the local "user closed it" latch so
    // the dialog doesn't re-mount on every render while the engine
    // remains not_installed.
    const [installPromptDismissed, setInstallPromptDismissed] = useState(false);
    useEffect(() => {
        // Re-arm the prompt as soon as the engine reports any other
        // state — if a retry later flips us back to not_installed the
        // user gets the dialog again.
        if (engine.status !== "not_installed") setInstallPromptDismissed(false);
    }, [engine.status]);
    const showInstallPrompt = engine.status === "not_installed" && !installPromptDismissed;

    // Engine "unsupported OS" surface — Figma 272:7700. Sibling to the
    // not-installed dialog: same chrome, distinct CTA (no installer
    // exists for macOS / Linux so the dialog is acknowledge-only). The
    // local `unsupportedOsDismissed` latch matches the not_installed
    // pattern so the modal re-arms when the engine status changes.
    const [unsupportedOsDismissed, setUnsupportedOsDismissed] = useState(false);
    useEffect(() => {
        if (engine.status !== "unsupported_os") setUnsupportedOsDismissed(false);
    }, [engine.status]);
    const showUnsupportedOsPrompt =
        engine.status === "unsupported_os" && !unsupportedOsDismissed;

    /* Sticky-wrap the source-list loading flag so the centered
     * "Loading…" message holds visible for the minimum-visibility
     * window. The hook flips `loading` true on every bankCd / sort
     * refetch; sticky lets the user see the gate even on a fast
     * cached response. Empty/data swap happens once the gate is
     * fully off. */
    const stickyLoading = useStickyLoading(data.loading);

    // View Setting — same wiring pattern Transaction History uses.
    const vs = useViewSetting(SCREEN_IDS.OWN_ACCOUNT_TRANSFER, DEFAULT_AREA_ID);
    const [vsDraft,  setVsDraft]  = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    const openViewSetting = (anchorRect: DOMRect) => {
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_VS_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    };
    const closeViewSetting = () => {
        setVsAnchor(null);
        setVsDraft(null);
    };

    // Visible columns from View Setting, ordered by DISP_ORD. Until the
    // backend resolves we render against FALLBACK_VS_COLUMNS so the
    // table doesn't flash empty. Filter out columns the registry
    // doesn't know about so the row-mapper never iterates an unknown
    // FIELD_ID (defensive against drift between seed and frontend).
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_VS_COLUMNS;
    const visibleColumns: ViewSettingItem[] = useMemo(
        () => liveItems
            .filter((it) => it.use_yn === "Y" && SOURCE_ACCOUNTS_COLUMN_REGISTRY[it.field_id])
            .slice()
            .sort((a, b) => a.disp_ord - b.disp_ord),
        [liveItems],
    );

    // Client-side pagination over the full filtered source list
    // (server returns "all" for the chosen bank — OQ-2 client-paged).
    const pg = usePagination<OwnAccountSourceRow>({ items: data.sources });

    // Row-bound Transfer click → open the composer. Engine readiness is
    // already enforced by the table (button is disabled while the engine
    // hasn't reported `ready`), so we don't double-check here.
    const onTransferClick = (row: OwnAccountSourceRow) => {
        setComposerSource(row);
    };

    // Bank filter options. Source list ships the canonical allow-list
    // each call; we render the popover from that, with a "All banks"
    // sentinel at the top. Bank display names come from rows when
    // available; otherwise fall back to {@link OAT_BANK_NAMES} (the
    // wire-stable BANK_INFM names for the 5 allow-listed banks). The
    // raw BANK_CD is only ever shown if a future bank slips into the
    // allow-list without a BANK_INFM row + without an account row.
    const bankNameByCd = useMemo(() => {
        const m = new Map<string, string>();
        for (const row of data.sources) m.set(row.bankCd, row.bankNm);
        return m;
    }, [data.sources]);

    // Bank-level Login-Credentials availability. A bank "has credentials"
    // when ANY of its source rows resolves a saved bank cert
    // (`hasSavedBankCert` = bankCertSeq + loginID + loginPWD, surfaced
    // from the BANK_CERT_INFO join). When the user deletes the bank's
    // Login Credentials, the join goes null for every account of that
    // bank, so the whole bank drops out of this set and all its rows'
    // scraping-dependent actions (Transfer / Update Balance) are
    // disabled — the accounts themselves still show (they live in Bank
    // Account Management). Keyed by BANK_CD, never by account number.
    const banksWithCredentials = useMemo(() => {
        const s = new Set<string>();
        for (const row of data.sources) {
            if (hasSavedBankCert(row)) s.add(row.bankCd);
        }
        return s;
    }, [data.sources]);

    // Option-A preselect + launch. Once the source list has loaded, find the
    // deep-linked account and open the composer for it — but only when it is
    // genuinely transfer-eligible, using the EXACT same guard the per-row
    // Transfer button uses (`canTransfer` + engine `ready` + the bank still
    // has saved Login Credentials). This reuses the existing
    // `setComposerSource` entry point, so the NXiSAS execution logic is
    // unchanged. Falls through silently when the account is unknown / not in
    // the OAT-eligible (VND-only) source list, or not yet eligible — i.e. the
    // page behaves exactly like a direct visit. Fires at most once.
    useEffect(() => {
        if (deepLinkConsumedRef.current) return;
        if (!incomingSourceAcctNo) return;
        if (data.sources.length === 0) return; // source list still loading
        const match = data.sources.find((r) => r.acctNo === incomingSourceAcctNo);
        if (!match) {
            // Unknown / non-VND / stale account → behave exactly as today.
            deepLinkConsumedRef.current = true;
            return;
        }
        const eligible =
            match.canTransfer &&
            engine.status === "ready" &&
            banksWithCredentials.has(match.bankCd);
        // Not eligible yet (e.g. engine still loading): stay armed so the
        // composer opens as soon as the row becomes actionable. If it never
        // becomes eligible the dialog never opens — identical to the disabled
        // Transfer button the user would otherwise see.
        if (!eligible) return;
        deepLinkConsumedRef.current = true;
        setComposerSource(match);
    }, [incomingSourceAcctNo, data.sources, engine.status, banksWithCredentials]);

    const resolveBankName = (cd: string): string =>
        bankNameByCd.get(cd) ?? OAT_BANK_NAMES[cd] ?? cd;

    const allBanksLabel = t("own_account_transfer.filter.all_banks");

    /** Selected bank's display label (or "All Banks" sentinel). Used by
     *  the FilterDropdown trigger. */
    const bankFilterValue =
        bankFilter == null ? allBanksLabel : resolveBankName(bankFilter);

    /** Bank-filter popover open state. Independent from the View
     *  Setting popover (different control, separate close handler). */
    const [bankFilterOpen, setBankFilterOpen] = useState(false);

    /** Options the popover renders. Order mirrors the server-provided
     *  `allowed_bank_cds` array — that array is the canonical per-tenant
     *  allow-list (5 banks for default, 1 for HAENGSUNG), so the popover
     *  always shows exactly what the tenant can use even when no rows
     *  for a given bank exist yet. */
    const bankOptions = useMemo(
        () =>
            data.allowedBankCds.map((cd) => ({
                cd,
                label: bankNameByCd.get(cd) ?? OAT_BANK_NAMES[cd] ?? cd,
            })),
        [data.allowedBankCds, bankNameByCd],
    );

    const handleBankSelect = (cd: string | null) => {
        setBankFilter(cd);
        pg.resetPage();
        setBankFilterOpen(false);
    };

    return (
        <>
            <PageLayout>
                <PageHeader title={t("own_account_transfer.title")}>
                    <button
                        type="button"
                        aria-label={t("common.open_list")}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                        onClick={(e) => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            openViewSetting(r);
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-list.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                    </button>
                </PageHeader>

                <EngineStatusBanner
                    status={engine.status}
                    vendor={engine.vendor}
                    version={engine.version}
                    onRetry={engine.retry}
                    className="mb-3"
                />

                <FilterRow>
                    <div className="relative">
                        <FilterDropdown
                            value={bankFilterValue}
                            onClick={() => setBankFilterOpen((o) => !o)}
                            ariaLabel={allBanksLabel}
                            className={BANK_FILTER_WIDTH_CLASS}
                        />
                        {bankFilterOpen && (
                            <BankFilterPopover
                                options={bankOptions}
                                selected={bankFilter}
                                allLabel={allBanksLabel}
                                onSelect={handleBankSelect}
                                onClose={() => setBankFilterOpen(false)}
                                widthClassName={BANK_FILTER_WIDTH_CLASS}
                            />
                        )}
                    </div>
                </FilterRow>

                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={
                        // Empty-state pattern — mirrors Banking >
                        // Transfer History (and Settings > VAS Account):
                        // render the table chrome (colgroup + sticky
                        // header + empty tbody) always, and surface a
                        // single sibling flex-1 div BELOW the table
                        // with the centered empty copy. Matches the
                        // live JEX behaviour — column headers never
                        // disappear; the body region just shows a
                        // centred text label.
                        <>
                            <SourceAccountsTable
                                rows={pg.paged}
                                visibleColumns={visibleColumns}
                                engineReady={engine.status === "ready"}
                                banksWithCredentials={banksWithCredentials}
                                onTransfer={onTransferClick}
                                sortField={sort.sortField}
                                sortDirection={sort.sortDirection}
                                onSort={sort.toggleSort}
                            />
                            {pg.paged.length === 0 ? (
                                <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                    {stickyLoading
                                        ? t("common.loading")
                                        : t("own_account_transfer.empty.no_data")}
                                </div>
                            ) : null}
                        </>
                    }
                    footer={
                        <SourceAccountsTableFooter
                            totals={data.totals}
                            visibleColumns={visibleColumns}
                            className="mt-auto"
                        />
                    }
                    pagination={
                        <Pagination
                            page={pg.page}
                            pageCount={pg.pageCount}
                            pageSize={pg.pageSize}
                            onPageChange={pg.setPage}
                            onPageSizeChange={pg.setPageSize}
                            totalLabel={t("common.showing_of", {
                                shown: String(pg.counts.shown),
                                total: String(pg.counts.total),
                            })}
                            className="shrink-0"
                        />
                    }
                />
            </PageLayout>

            {/* Composer dialog — opens when a per-row Transfer button is
                clicked. Drives Step-1 (form) → Step-2 (confirm) →
                engine scrape → POST /scraping-result → success/error
                dialog. Closes on Cancel / X / Esc and on successful
                submit. After a successful POST we reload the source
                list so the picker reflects the updated balance. */}
            <OwnAccountTransferComposerDialog
                source={composerSource}
                data={data}
                engine={engine}
                onClose={() => setComposerSource(null)}
                onRecorded={() => { void data.reload(); }}
            />

            {/* Engine-not-installed prompt — Figma 271:7388. Renders
                only while the engine probe reports `not_installed` and
                the user hasn't dismissed it this session. The Download
                button is an `<a href="/nxisas/file/NXiSAS.exe">` that
                fires the existing installer download — same path the
                legacy banner targets. */}
            <EngineNotInstalledDialog
                open={showInstallPrompt}
                onClose={() => setInstallPromptDismissed(true)}
            />

            {/* Engine-unsupported-OS prompt — Figma 272:7700. Sibling
                to the not-installed dialog above: same chrome, no
                Download CTA (the installer is Windows-only — there's
                nothing to install on macOS / Linux). Renders only
                while the probe reports `unsupported_os` and the user
                hasn't dismissed it. */}
            <EngineUnsupportedOsDialog
                open={showUnsupportedOsPrompt}
                onClose={() => setUnsupportedOsDismissed(true)}
            />

            {/* React-untouched sibling — kept as a stable mount the
                engine bundle could target in a future refactor patch.
                In the VERBATIM vendor bundle the engine renders its
                2nd-cert popups via `$('body').append(...)` (see
                `nxisas_v2.js:819, 856, 1191, 1610`), so today this
                div is decorative. Removing it would break nothing,
                but leaving it lets us patch the bundle later (or
                wire a React-side cert chooser) without touching this
                file. The bundle's `<body>` appends are reconciler-
                safe because Next.js mounts under `<body><div id=
                "__next">…</div></body>` and the `.layerCont` popups
                land as a sibling of `__next`, never inside it. */}
            <div id="nxisas-mount" aria-hidden="true" />

            {/* DEV preview mode — opens 5 mock engine modals via a
                floating trigger panel. Gated by `?preview=nxisas`
                so it's invisible in normal usage. Will become the
                Phase B popup-bridge once the cert harness lands. */}
            {previewActive ? <NxisasSecondaryAuthPreview /> : null}

            {/* View Setting popover. Hidden until the toolbar button
                opens it; closes on Cancel / Save / Reset. */}
            {vsAnchor && vsDraft ? (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={setVsDraft}
                    getLabel={(it) => {
                        if (isSpecialViewSettingField(it.field_id)) return it.field_nm;
                        const key = SOURCE_ACCOUNTS_FIELD_LABEL_KEYS[it.field_id];
                        return key ? t(key) : it.field_nm;
                    }}
                    onSave={async () => {
                        try {
                            await vs.save(vsDraft);
                        } finally {
                            closeViewSetting();
                        }
                    }}
                    onReset={async () => {
                        const next = await vs.reset();
                        setVsDraft(next.map((it) => ({ ...it })));
                    }}
                    onClose={closeViewSetting}
                />
            ) : null}
        </>
    );
}

/**
 * Bank-filter popover anchored under the {@link FilterDropdown} trigger.
 * Mirrors the BankFilterPopover pattern in
 * {@code components/shared/AccountInquiryPage.tsx} so the look matches
 * Banking &gt; Account Inquiry's bank chooser exactly — same dimensions,
 * same hover token, same "selected" highlight.
 *
 * <p>API shape differs from AccountInquiry's variant: that one passes
 * display-name strings (and stores the name as state); this one passes
 * {@code { cd, label }} pairs so the page can keep {@code bankFilter}
 * as the canonical {@code BANK_CD} code (the wire param) while the
 * popover renders human-readable names. {@code cd === null} is the
 * "All Banks" sentinel — the popover renders it as the first row, and
 * {@code onSelect(null)} resets the filter.
 */
function BankFilterPopover({
    options,
    selected,
    allLabel,
    onSelect,
    onClose,
    widthClassName,
}: {
    options: Array<{ cd: string; label: string }>;
    selected: string | null;
    allLabel: string;
    onSelect: (cd: string | null) => void;
    onClose: () => void;
    /** Tailwind width utility matching the trigger so the popover lines
     *  up under it (e.g. {@code "w-[180px]"}). */
    widthClassName: string;
}) {
    const ref = useRef<HTMLUListElement>(null);

    // Outside-click closes. Deferred to the next microtask so the
    // mousedown that opened the popover doesn't immediately close it
    // (the trigger button lives outside the <ul>, so without the defer
    // the same click that toggled `bankFilterOpen` would fire here).
    useEffect(() => {
        let cancelled = false;
        const t = window.setTimeout(() => {
            if (cancelled) return;
            document.addEventListener("mousedown", onDocClick);
        }, 0);
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        return () => {
            cancelled = true;
            window.clearTimeout(t);
            document.removeEventListener("mousedown", onDocClick);
        };
    }, [onClose]);

    return (
        <ul
            ref={ref}
            role="listbox"
            className={cn(
                "custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card",
                widthClassName,
            )}
        >
            <li
                role="option"
                aria-selected={selected === null}
                onClick={() => onSelect(null)}
                className={cn(
                    "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium hover:bg-wb-bg-active",
                    selected === null ? "text-brand" : "text-wb-ntrl-8",
                )}
            >
                {allLabel}
            </li>
            {options.map((opt) => (
                <li
                    key={opt.cd}
                    role="option"
                    aria-selected={selected === opt.cd}
                    onClick={() => onSelect(opt.cd)}
                    className={cn(
                        "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium hover:bg-wb-bg-active",
                        selected === opt.cd ? "text-brand" : "text-wb-ntrl-8",
                    )}
                >
                    {opt.label}
                </li>
            ))}
        </ul>
    );
}
