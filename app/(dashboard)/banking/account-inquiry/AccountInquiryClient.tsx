"use client";

import { useCallback, useEffect, useState } from "react";

import AccountInquiryPage, {
    type BankOption,
    type ServerPagingControl,
} from "@/components/shared/AccountInquiryPage";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTableSort } from "@/hooks/useTableSort";
import { useTranslation } from "@/lib/i18n";
import {
    downloadAccountInquiryFcyReport,
    downloadAccountInquiryReport,
    fetchAccounts,
} from "@/lib/api/banking";
import { mapCurrencyTotal } from "@/lib/api/currencyTotal";
import { mapAccountRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import type { ScreenId } from "@/lib/viewSettingScreens";

type Props = {
    /** Page mode — the page's STATIC currency scope. The actual wire
     *  param sent to the backend is derived: when {@link multiCurrencyMode}
     *  is enabled and the user has narrowed via the in-page currency
     *  dropdown, wire becomes that concrete CCY (`USD`, `KRW`, …);
     *  otherwise it equals this prop. */
    currency: "VND" | "FCY" | "ALL";
    titleKey?: string;
    /** Excel export filename i18n key (separate from on-screen title —
     *  the export filename strips the space before the scope marker
     *  to match the legacy convention). FCY twin passes
     *  `account_inquiry.export_title_fcy`. */
    exportTitleKey?: string;
    totalLabelKey?: string;
    bankFilterLabel?: string;
    /** View Setting / Excel export screenId. Defaults inside the shared
     *  page to {@code SCREEN_IDS.ACCOUNT_INQUIRY_VND}; the FCY wrapper
     *  passes {@code SCREEN_IDS.ACCOUNT_INQUIRY_FCY} so the popover and
     *  the export endpoint route to the FCY scope. */
    viewSettingScreenId?: ScreenId;
    /** Enable the in-page currency dropdown (FCY page only). When true
     *  the wrapper owns `selectedCurrency` state and re-fires the API
     *  call whenever it changes. */
    multiCurrencyMode?: boolean;
};

/**
 * Default page size for the server-side pagination. Matches the
 * canonical {@code PAGE_SIZE_OPTIONS[0] = 10} in the shared
 * {@code Pagination} component so the dropdown selector and the
 * initial fetch agree on the same value. Backend clamps to
 * {@code AccountService.MAX_PAGE_SIZE = 100}.
 */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Keyword debounce — keystrokes shouldn't fire a refetch on every
 * character. The page already calls `resetPage(0)` synchronously on
 * keystroke (which we honour); we simply lag the value used in the
 * `useApiData` deps array so the network roundtrip waits for typing
 * to settle.
 */
const KEYWORD_DEBOUNCE_MS = 300;

/**
 * Client wrapper around the static `<AccountInquiryPage>`. Owns server-side
 * filter / pagination state (bankCd, keyword, page, pageSize) and exposes
 * it to the page via the `serverPaging` controlled-mode contract. Maps
 * the UPPER_SNAKE DTO returned from `GET /api/v1/banking/accounts` into
 * the camelCase `AccountInquiryRow` shape the static UI expects.
 *
 * Sprint 2 (server-side parity): bankCd + keyword + page + size all
 * travel as query params; the backend applies them in JPQL via
 * `AcctMstrRepository.findFiltered` so the page becomes index-friendly
 * at scale (legacy parity with `fnsh_0001_001_r001`'s server-side
 * pagination + WHERE clause).
 *
 * Sprint 1 stabilization (still in effect): the page no longer ships a
 * mock seed. While loading or on error the table renders empty (UI
 * layout unchanged).
 */
export default function AccountInquiryClient({
    currency,
    titleKey,
    exportTitleKey,
    totalLabelKey,
    bankFilterLabel,
    viewSettingScreenId,
    multiCurrencyMode = false,
}: Props) {
    const [refreshKey, setRefreshKey] = useState(0);
    const { locale } = useTranslation();

    const { sortField, sortDirection, sortParams, toggleSort } = useTableSort();

    // FCY-only state. `selectedCurrency = null` means "All Currency"
    // (wire `currency=FCY` → backend filter `ccy_cd <> 'VND'`); a
    // concrete value flips wire to that CCY (backend filter
    // `ccy_cd = <CCY>`). The dropdown options are cached from the
    // first "All Currency" response so they don't disappear when the
    // user narrows.
    const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
    const [currencyOptions, setCurrencyOptions] = useState<string[]>([]);

    // Server-side filter + pagination state. Mirrors the JEX
    // `fnsh_0001_001_r001` input set the refactor supports (bank, search,
    // page, page-per-cnt). Page is zero-based per Spring Data
    // convention.
    const [bankCd, setBankCd] = useState<string | null>(null);
    const [keyword, setKeyword] = useState("");
    // AI-01 — as-of date for legacy historical-balance display
    // (ACCT_MSTR_R004). `null` = current balances (no date param sent). The
    // page owns the date-picker UI; it notifies us via onAsOfDateChange with
    // an ISO YYYY-MM-DD value, which we convert to the yyyyMMdd wire param.
    const [asOfDate, setAsOfDate] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // Refresh handler — bumps refreshKey to force a refetch. On the FCY
    // page (multiCurrencyMode), also resets the in-page currency narrow
    // back to "All Currency" so the next fetch is unfiltered and the
    // currencyOptions cache repopulates with every available CCY. Page
    // also resets to 0 to mirror the page-reset semantics of every
    // other filter change.
    const handleRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
        if (multiCurrencyMode) {
            setSelectedCurrency(null);
            setPage(0);
        }
    }, [multiCurrencyMode]);

    // Debounced keyword used as the API dep — page sees the live value
    // for input rendering (no lag in the box) but the network roundtrip
    // waits for typing to settle.
    const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);
    useEffect(() => {
        const handle = window.setTimeout(() => setDebouncedKeyword(keyword), KEYWORD_DEBOUNCE_MS);
        return () => window.clearTimeout(handle);
    }, [keyword]);

    // Wire param sent to GET /api/v1/banking/accounts AND to the
    // export endpoint. When the page is NOT in multi-currency mode
    // (VND), this is just the page mode. When in multi-currency mode
    // (FCY), the user's dropdown selection takes precedence.
    const wireCurrency = multiCurrencyMode
        ? (selectedCurrency ?? currency)
        : currency;

    const { data, loading } = useApiData(
        () =>
            fetchAccounts({
                currency: wireCurrency,
                bankCd: bankCd ?? undefined,
                keyword: debouncedKeyword || undefined,
                sort: sortParams,
                // ISO YYYY-MM-DD → yyyyMMdd; null skips the param (current balances).
                asOfDate: asOfDate ? asOfDate.replace(/-/g, "") : undefined,
                page,
                size: pageSize,
            }),
        // wireCurrency reflects both the page mode AND the user's
        // currency-dropdown selection — refire on either. sortField +
        // sortDirection drive the backend ORDER BY; refire on those
        // too. bankCd / keyword / page / pageSize round-trip the new
        // server-side parity inputs (Sprint 2).
        [
            wireCurrency,
            refreshKey,
            sortField,
            sortDirection,
            bankCd,
            debouncedKeyword,
            asOfDate,
            page,
            pageSize,
        ],
    );

    // Sort / pagination must NOT cause the summary card OR the pagination
    // chrome to flicker between requests. `useApiData` resets `data` to
    // null on every refetch — passing through that null collapses
    // `pageCount` to 1 and blanks the "{shown} of {total}" label. Latch
    // the latest non-null response into local state so the page receives
    // a stable snapshot through every refetch.
    //
    // Uses the React 19 "store info from previous render" pattern
    // (https://react.dev/learn/you-might-not-need-an-effect#storing-information-from-previous-renders)
    // so the latch happens during render rather than in an effect.
    const [stableData, setStableData] = useState(data);
    const [prevData, setPrevData] = useState(data);
    if (data !== prevData) {
        setPrevData(data);
        if (data) {
            setStableData(data);
            // Refresh the currency-dropdown cache only when the response
            // is the unfiltered FCY result (selectedCurrency=null). On
            // narrow responses (selectedCurrency=USD/KRW/…) the cache is
            // intentionally retained so the dropdown still offers every
            // CCY after the user picks one.
            if (multiCurrencyMode && selectedCurrency === null) {
                const seen = new Set<string>();
                for (const t of data.totals_by_ccy ?? []) {
                    const c = t.ccy_cd?.trim();
                    if (c) seen.add(c);
                }
                const next = Array.from(seen).sort();
                if (
                    next.length !== currencyOptions.length ||
                    next.some((c, i) => c !== currencyOptions[i])
                ) {
                    setCurrencyOptions(next);
                }
            }
        }
    }

    /* Smooth the initial loading → empty / loading → table transition.
     * `loading && !stableData` fires true only while the very first
     * response hasn't latched yet, so subsequent search / filter /
     * pagination / sort refetches keep the previous rows visible
     * (stable-data latch above) and never trip the sticky window.
     * Mirrors the Settings + Add-on pattern. */
    const stickyInitialLoading = useStickyLoading(loading && !stableData);

    const rows = stableData
        ? stableData.accounts.map((r) => mapAccountRow(r, wireCurrency))
        : [];
    const totalsByCcy = stableData
        ? (stableData.totals_by_ccy ?? []).map(mapCurrencyTotal)
        : [];

    // Bank dropdown options come from the backend's banks_available
    // list — independent of the current bank/keyword/page filters so
    // selecting one bank never narrows the dropdown's option set.
    // Reads from `stableData` (the latched-previous-response) so the
    // dropdown stays populated during in-flight refetches.
    const bankOptions: BankOption[] = stableData
        ? (stableData.banks_available ?? []).map((b) => ({
              bankCd: b.bank_cd,
              bankName: b.bank_nm,
          }))
        : [];

    // Page hands keyword/bankCd/page/pageSize state back through these
    // callbacks. Every filter change resets the page to 0; pagination
    // chrome calls onPageChange directly with the new index.
    const serverPaging: ServerPagingControl = {
        bankCd,
        keyword,
        page,
        pageSize,
        totalCount: stableData?.total_count ?? 0,
        totalPages: stableData?.total_pages ?? 1,
        bankOptions,
        onBankCdChange: (cd) => {
            setBankCd(cd);
            setPage(0);
        },
        onKeywordChange: (kw) => {
            setKeyword(kw);
            setPage(0);
        },
        onPageChange: (p) => setPage(p),
        onPageSizeChange: (s) => {
            setPageSize(s);
            setPage(0);
        },
    };

    // BalancePopover deep-links into per-account Transaction History; pass
    // the scope only when this client wrapper is rendering a single-currency
    // page (VND or FCY). "ALL" leaves the popup on the legacy parent
    // redirect since there is no canonical single-scope route.
    const scope = currency === "VND" || currency === "FCY" ? currency : undefined;
    return (
        <AccountInquiryPage
            titleKey={titleKey}
            exportTitleKey={exportTitleKey}
            totalLabelKey={totalLabelKey}
            rows={rows}
            totalAccounts={stableData ? String(stableData.total_count) : "0"}
            availableBalance={stableData?.available_bal ?? "0"}
            balance={stableData?.balance ?? "0"}
            bankFilterLabel={bankFilterLabel}
            scope={scope}
            wireCurrency={wireCurrency}
            viewSettingScreenId={viewSettingScreenId}
            reportDownload={
                // PO-requested template-populated `.xls` download. VND uses the
                // VND template report; FCY uses the FCY template report (passing
                // the on-screen currency scope so download and screen agree).
                // "ALL" (no single-scope page) keeps the generic export.
                currency === "VND" && !multiCurrencyMode
                    ? () => downloadAccountInquiryReport(locale)
                    : currency === "FCY"
                      ? () => downloadAccountInquiryFcyReport(locale, wireCurrency)
                      : undefined
            }
            totalsByCcy={totalsByCcy}
            multiCurrencyMode={multiCurrencyMode}
            currencyOptions={currencyOptions}
            selectedCurrency={selectedCurrency}
            onCurrencyChange={setSelectedCurrency}
            onAsOfDateChange={(iso) => {
                setAsOfDate(iso || null);
                setPage(0);
            }}
            onRefresh={handleRefresh}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={toggleSort}
            serverPaging={serverPaging}
            loading={stickyInitialLoading}
        />
    );
}
