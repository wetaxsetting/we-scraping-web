"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import BalancePopover from "@/components/banking/account-inquiry/BalancePopover";
import TransactionSyncDialog, {
    type SyncSelectedAccount,
} from "@/components/banking/account-inquiry/TransactionSyncDialog";

import DataTableShell from "@/components/shared/DataTableShell";
import DateField, { todayIso } from "@/components/shared/DateField";
import FilterDropdown from "@/components/shared/FilterDropdown";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination, { usePagination } from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
    ViewSettingPopover,
    isSpecialViewSettingField,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { Checkbox } from "@/components/ui/checkbox";
import { useExcelExport, type ExcelExportColumnConfig } from "@/hooks/useExcelExport";
import type { SortDirection } from "@/hooks/useTableSort";
import type { CurrencyTotal } from "@/lib/api/currencyTotal";
import { todayDmy } from "@/lib/excel";
import { DEFAULT_AREA_ID, SCREEN_IDS, type ScreenId } from "@/lib/viewSettingScreens";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatAmount } from "@/lib/currency";
import { formatDateTimeForView, humanizeDatetime } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { escapeHtml, printReport } from "@/lib/print";
import { cn } from "@/lib/utils";

export type AccountInquiryRow = {
    id: string;
    /** Legacy {@code BANK_CD} (e.g. {@code "11704001"}). Drives the
     *  server-side bank filter — the popover stores this code as the
     *  option key while the user-facing label is {@link bankName}. */
    bankCd: string;
    bankName: string;
    bankType: "Current" | "Savings" | "Fixed";
    accountNo: string;
    nickname: string;
    /** Raw wire string from `AmountFormatter.wire(...)` — formatted for display
     *  via {@link formatAmount} (legacy `_osmc.ui.formatAmount`). */
    balance: string;
    available: string;
    lastUpdate: string;
    error?: boolean;
    /** ISO 4217 currency code driving amount formatting (`VND`, `USD`, …).
     *  Defaults to `VND` when the mapper hasn't populated it. */
    currencyCd?: string;
    /** Override the default `VND • {bankType}` chip for FCY rows (e.g. "USD • Current"). */
    currencyLabel?: string;
    /** `false` when the row's checkbox is disabled because the account
     *  is manual-registration OR belongs to a disconnected bank. Drives
     *  the header "select-all" calculation and the toggleRow guard so
     *  non-selectable rows can never enter the selection set. Defaults
     *  to `true` until the wire flags arrive — keeps backwards
     *  compatibility with mock seeds. */
    selectable?: boolean;
    /** i18n key for the hover tooltip shown when {@link selectable} is
     *  `false`. One of
     *  `account_inquiry.disabled.manual` (manual-registration accounts)
     *  / `account_inquiry.disabled.disconnected` (online accounts whose
     *  bank certificate is missing). Manual wins when both apply,
     *  matching legacy `fnsh_0005_001.ts:701-720` precedence. */
    disabledReasonKey?:
        | "account_inquiry.disabled.manual"
        | "account_inquiry.disabled.disconnected";
};

/**
 * No static seed — Sprint 1 stabilization removed the mock fallback.
 * The Client wrapper is the single source of rows. While the API call
 * is in flight the table renders empty; on error the wrapper either
 * logs out (401) or surfaces an empty state. Add a real loading
 * skeleton when Sprint 2 introduces one — keeping the UI unchanged
 * for now per the stabilization brief.
 */

/** Helpers handed to each column renderer so cell JSX stays declarative. */
type ColumnRenderContext = {
    row: AccountInquiryRow;
    t: (key: string, vars?: Record<string, string | number>) => string;
    summaryCurrency: string;
    /** Captures the click target's DOMRect so the Balance popover can
     *  anchor itself correctly. */
    onBalanceClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
};

type AccountInquiryColumnDef = {
    /** Tailwind class for the matching `<col>` width. */
    colClassName: string;
    /** i18n key for the header label. */
    headerKey: string;
    /** Header alignment (defaults to "left"). */
    align?: "left" | "right";
    /** Optional extra header className (e.g. `pl-4` for the last-update
     *  column to align with the body). */
    headerClassName?: string;
    /** Tailwind class applied to each `<TableCell>`. */
    cellClassName: string;
    renderBody: (ctx: ColumnRenderContext) => React.ReactNode;
};

/**
 * DB FIELD_ID → renderer / sort / export key.
 *
 * The DB seed is the source of truth for column metadata (CLAUDE.md §13).
 * Operations may reseed `SYS_SCR_OPTION_WECMS` with FIELD_IDs that don't
 * match the static refactor names below — e.g. legacy DEV codes
 * (`BANK_NM`, `ACCT_NICK_NM`, `BAL`, `REAL_AMT`,
 * `ACCT_HIS_LST_INQ_DT`) — without breaking the page. Every lookup
 * (renderer, colgroup width, sort wire key, export allow-list) routes
 * through `resolveFieldKey(...)` so the alias collapses both naming
 * forms onto the same renderer / wire key.
 *
 * Aliases are NEVER persisted: View Setting Save round-trips `vs.items`
 * with their DB FIELD_IDs unchanged. The alias only affects what the
 * frontend asks the renderer / backend whitelist to do.
 *
 * Identity passes through — any FIELD_ID not listed here resolves to
 * itself, so already-semantic seeds work without an entry.
 */
const FIELD_ID_ALIAS: Record<string, string> = {
    BANK_NM: "BANK",
    ACCT_NICK_NM: "ACCOUNT_NICKNAME",
    BAL: "BALANCE",
    REAL_AMT: "AVAILABLE_BALANCE",
    ACCT_HIS_LST_INQ_DT: "LAST_UPDATE",
};

function resolveFieldKey(fieldId: string): string {
    return FIELD_ID_ALIAS[fieldId] ?? fieldId;
}

/**
 * Renderer key → column renderer map for the Account Inquiry table.
 *
 * Drives both the runtime View Setting flow (CLAUDE.md §13) and the
 * fallback column set used while the API resolves. Keys are uppercase
 * semantic refactor names (`BANK`, `ACCOUNT_NICKNAME`, `BALANCE`, …);
 * the page reaches them via `resolveFieldKey(it.FIELD_ID)` so the DB
 * seed can use either semantic names or legacy DEV codes (see
 * `FIELD_ID_ALIAS` above). The screenId itself still follows the
 * semantic-route convention — see `lib/viewSettingScreens.ts`.
 *
 * Adding a new renderable column = one entry here + (a) a matching
 * SYS_SCR_OPTION seed row in Flyway and (b) an alias entry above if
 * the DB FIELD_ID differs from the renderer key.
 */
const COLUMN_REGISTRY: Record<string, AccountInquiryColumnDef> = {
    BANK: {
        colClassName: "w-[var(--w-wb-col-bank)]",
        headerKey: "account_inquiry.col.bank",
        cellClassName: "py-2.5 pr-2.5",
        renderBody: ({ row }) => (
            <div className="flex flex-col items-start">
                <div className="flex items-start gap-1">
                    <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                        {row.bankName}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/table/ico-building.svg"
                        alt=""
                        aria-hidden
                        className="size-[var(--size-wb-icon-sm)] shrink-0 opacity-50"
                    />
                    <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-ink">
                        {row.currencyLabel ?? `VND • ${row.bankType}`}
                    </span>
                </div>
                <span className="whitespace-nowrap text-wb-13 font-medium leading-5 text-wb-muted">
                    {row.accountNo}
                </span>
            </div>
        ),
    },
    ACCOUNT_NICKNAME: {
        colClassName: "w-[var(--w-wb-col-nickname)]",
        headerKey: "account_inquiry.col.nickname",
        cellClassName: "py-2.5 pr-4",
        renderBody: ({ row }) => (
            <span className="text-wb-13 font-medium text-wb-dark">
                {row.nickname}
            </span>
        ),
    },
    BALANCE: {
        colClassName: "w-[var(--w-wb-col-balance)]",
        headerKey: "account_inquiry.col.balance",
        align: "right",
        cellClassName: "p-2.5 text-right",
        renderBody: ({ row, summaryCurrency, onBalanceClick }) => (
            <button
                type="button"
                onClick={onBalanceClick}
                className="cursor-pointer text-wb-13 font-medium text-brand"
            >
                {formatAmount(row.balance, row.currencyCd ?? summaryCurrency, false)}
            </button>
        ),
    },
    AVAILABLE_BALANCE: {
        colClassName: "w-[var(--w-wb-col-available)]",
        headerKey: "account_inquiry.col.available",
        align: "right",
        cellClassName: "p-2.5 text-right",
        renderBody: ({ row, summaryCurrency }) => (
            <span className="text-wb-13 font-medium text-wb-ink">
                {formatAmount(row.available, row.currencyCd ?? summaryCurrency, false)}
            </span>
        ),
    },
    VAS_ACCOUNT: {
        colClassName: "w-[var(--w-wb-col-vas-account)]",
        headerKey: "account_inquiry.col.vas_account",
        cellClassName: "py-2.5 pr-2.5",
        renderBody: () => (
            <span className="text-wb-13 font-medium text-wb-muted">—</span>
        ),
    },
    LAST_UPDATE: {
        colClassName: "w-[var(--w-wb-col-last-update)]",
        headerKey: "account_inquiry.col.last_update",
        headerClassName: "pl-4",
        cellClassName: "py-2.5 pl-4",
        renderBody: ({ row, t }) => (
            <LastUpdateCell
                lastUpdate={row.lastUpdate}
                error={row.error}
                errorLabel={t("account_inquiry.error")}
            />
        ),
    },
};

/** Mirror of the V32–V34 SYS_SCR_OPTION_WECMS seed for screenId
 *  `banking-account-inquiry-vnd` / area `default` — used only as the
 *  column set while the API resolves on first paint. The authoritative
 *  config still comes from the backend; this exists so the table doesn't
 *  flash with zero columns. CHECKBOX is rendered by the page's own JSX
 *  outside this list and is naturally filtered out by the
 *  visible-columns filter (no COLUMN_REGISTRY entry); including it here
 *  keeps `vs.items` and the fallback aligned with the DB seed. */
const FALLBACK_COLUMNS: ViewSettingItem[] = [
    { field_id: "CHECKBOX",          field_nm: "Checkbox",          disp_ord: 0, disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "38px",  sort_yn: "Y" },
    { field_id: "BANK",              field_nm: "Bank",              disp_ord: 1, disp_yn: "Y", use_yn: "Y", fix_yn: "Y", size: "240px", sort_yn: "Y" },
    { field_id: "ACCOUNT_NICKNAME",  field_nm: "Account Nickname",  disp_ord: 2, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "280px", sort_yn: "Y" },
    { field_id: "BALANCE",           field_nm: "Balance",           disp_ord: 3, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
    { field_id: "AVAILABLE_BALANCE", field_nm: "Available Balance", disp_ord: 4, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "180px", sort_yn: "Y" },
    { field_id: "VAS_ACCOUNT",       field_nm: "VAS Account",       disp_ord: 5, disp_yn: "Y", use_yn: "N", fix_yn: "N", size: "200px", sort_yn: "N" },
    { field_id: "LAST_UPDATE",       field_nm: "Last Update",       disp_ord: 6, disp_yn: "Y", use_yn: "Y", fix_yn: "N", size: "160px", sort_yn: "Y" },
];

/**
 * Single entry in the controlled-mode bank-options list. The popover
 * displays {@link bankName} as the label; the page sends {@link bankCd}
 * back to the parent on selection. Sourced from the backend's
 * {@code BANKS_AVAILABLE} list, which stays stable across bank/keyword
 * filter changes.
 */
export type BankOption = {
    bankCd: string;
    bankName: string;
};

/**
 * Controlled-mode contract — when the parent passes this prop the page
 * surrenders ownership of bank filter, keyword search, and pagination
 * state. Used by the VND client wrapper to push filters + pagination
 * to the Spring Boot endpoint (Sprint 2 server-side parity work).
 *
 * <p>When omitted, the page keeps its legacy uncontrolled behavior
 * (client-side bank/keyword filter + client-side pagination). The FCY
 * client will continue to use the uncontrolled path until its own
 * follow-up MR migrates it.
 *
 * <p>{@code page} is zero-based per Spring Data convention; the page
 * converts to one-based for the {@link Pagination} component.
 *
 * <p>{@code bankCd} is the legacy {@code BANK_CD} string (e.g.
 * {@code "11704001"}) — NOT the display name. The popover still
 * presents bank names; the page resolves the name↔code mapping via
 * {@link bankOptions} (NOT from the rendered rows, which would narrow
 * the dropdown to the currently-filtered banks).
 */
export type ServerPagingControl = {
    bankCd: string | null;
    keyword: string;
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    /** Canonical bank list for the dropdown — independent of the
     *  current bank/keyword/page filters. Provided by the wrapper from
     *  the backend's {@code BANKS_AVAILABLE} response field. */
    bankOptions: BankOption[];
    onBankCdChange: (bankCd: string | null) => void;
    onKeywordChange: (keyword: string) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
};

type AccountInquiryPageProps = {
    /** i18n key for the page title. Defaults to the VND variant. */
    titleKey?: string;
    /** i18n key for the Excel export filename base. Differs from
     *  {@link titleKey} on purpose — the on-screen title carries
     *  natural language spacing (e.g. {@code "계좌 조회 (VND)"}) but
     *  the legacy export filename strips spaces around the scope
     *  marker (e.g. {@code "계좌조회(VND)"} / {@code "Account Inquiry(VND)"}).
     *  Defaults to the VND variant. */
    exportTitleKey?: string;
    /** i18n key for the summary card "TOTAL ACCOUNTS" label. */
    totalLabelKey?: string;
    /** Rows rendered in the table. Defaults to an empty array — no mock seed. */
    rows?: AccountInquiryRow[];
    /** Total accounts count for the pill. */
    totalAccounts?: string;
    /** Formatted summary figures (display only). Default to "0" when API hasn't responded. */
    availableBalance?: string;
    balance?: string;
    /** Filter dropdown label — e.g. "All Banks", "All Currencies". */
    bankFilterLabel?: string;
    /** Currency code for summary-card formatting (defaults to VND). Mirrors
     *  legacy `_osmc.ui.formatAmount(value, fnsh_0001_001.CCY_CD)` where the
     *  page's local currency is the formatter scope. */
    summaryCurrency?: string;
    /** Banking scope — drives the BalancePopover's "View Details" deep-link
     *  to the matching `/banking/transaction-history(-fcy)/[slug]` route.
     *  Undefined falls back to the legacy parent redirect. */
    scope?: "VND" | "FCY";
    /** Wire-format currency value forwarded to the backend export endpoint
     *  (`POST /api/v1/banking/accounts/export`). May be a page mode
     *  (`VND`, `FCY`, `ALL`) OR a concrete CCY when the user has narrowed
     *  via the FCY currency dropdown (`USD`, `KRW`, …). The backend's
     *  `AccountService#resolve` handles all three forms. Defaults to
     *  {@code "VND"}. */
    wireCurrency?: string;
    /** View Setting / Excel export screenId. Defaults to the VND scope;
     *  the FCY twin passes {@code SCREEN_IDS.ACCOUNT_INQUIRY_FCY}. */
    viewSettingScreenId?: ScreenId;
    /** Per-currency summary breakdown from the backend. One tile is
     *  rendered per entry. VND page sees a single-entry list (VND);
     *  FCY page sees one entry per CCY in the filtered result. When
     *  empty / undefined the page falls back to the legacy single-tile
     *  rendering against {@link totalAccounts} / {@link availableBalance}
     *  / {@link balance} / {@link summaryCurrency}. */
    totalsByCcy?: CurrencyTotal[];
    /** Enable the second filter dropdown (currency picker) next to the
     *  bank dropdown. FCY page sets this true. VND page leaves false
     *  (single-currency screen, no need for the picker). */
    multiCurrencyMode?: boolean;
    /** Distinct currency codes for the currency dropdown when
     *  {@link multiCurrencyMode} is true. Cached by the client wrapper
     *  from the first "All Currency" response so options persist when
     *  the user narrows to a single CCY. */
    currencyOptions?: string[];
    /** {@code null} = "All Currency" (wire `currency=FCY`); concrete
     *  CCY otherwise (`USD`, `KRW`, …, wire `currency={ccy}`). */
    selectedCurrency?: string | null;
    /** Currency-dropdown change handler — owned by the client wrapper
     *  because the value drives the API refetch. */
    onCurrencyChange?: (ccy: string | null) => void;
    /** Optional refetch hook (Update / Dashboard buttons trigger this). */
    onRefresh?: () => void;
    /** Common-sort state from `useTableSort()` — `FIELD_ID` driving the
     *  active sort, or `null` when in default state. */
    sortField?: string | null;
    /** Common-sort direction (`ASC` / `DESC` / `null`). */
    sortDirection?: SortDirection;
    /** Sort click handler — typically `useTableSort().toggleSort`. When
     *  omitted, sortable headers render the inactive glyph but are inert. */
    onSort?: (fieldId: string) => void;
    /** Server-side pagination + filter contract. Pass to switch the page
     *  into controlled mode (bank filter, keyword search, pagination
     *  driven by the parent + the backend). Omit for legacy
     *  uncontrolled behavior (client-side filter + client-side pagination). */
    serverPaging?: ServerPagingControl;
};

/**
 * FIELD_ID → export-config map for Account Inquiry. Mirrors
 * {@link COLUMN_REGISTRY} in scope (same FIELD_ID set + headerKey)
 * but carries the wire-format vocabulary the backend writer needs
 * ({@code amount} → numeric cell with currency-aware header,
 * {@code datetime} → legacy YYYYMMDDHHmmss → "yyyy-MM-dd HH:mm:ss",
 * etc.). Adding a new exportable column is one entry here + the
 * matching seed row in {@code SYS_SCR_OPTION_WECMS} for the
 * {@code banking-account-inquiry-vnd} screen.
 *
 * The map deliberately omits {@code CHECKBOX} — the row-selection
 * column is never exported (CLAUDE.md §13 / backend
 * {@code ScreenOptionService.SPECIAL_FIELD_IDS}). The shared
 * {@link useExcelExport} hook also filters specials defensively.
 */
const ACCOUNT_INQUIRY_EXPORT_COLUMNS: Record<string, ExcelExportColumnConfig> = {
    // BANK is a composite cell — `<bank name>  ·  <ccy> <type> / <acct no>`
    // (e.g. "Vietcom Bank  ·  VND Current / 0441000688210", ~43 chars) —
    // so the on-screen 240px SIZE (which the backend would convert to
    // ~33 Excel chars) is too narrow for the Excel single-line form.
    // Override here so the spreadsheet always fits the full composite
    // regardless of the user's on-screen column resize. Every other
    // column omits widthChars and lets the backend derive width from
    // View Setting SIZE — when the column-resize UI ships, the
    // user's per-column resize in USER_SCR_OPTION_WECMS will flow to
    // exports automatically.
    BANK: {
        headerKey: "account_inquiry.col.bank",
        format: "text",
        widthChars: 40,
    },
    ACCOUNT_NICKNAME: {
        headerKey: "account_inquiry.col.nickname",
        format: "text",
    },
    BALANCE: {
        headerKey: "account_inquiry.col.balance",
        format: "amount",
        align: "right",
    },
    AVAILABLE_BALANCE: {
        headerKey: "account_inquiry.col.available",
        format: "amount",
        align: "right",
    },
    VAS_ACCOUNT: {
        headerKey: "account_inquiry.col.vas_account",
        format: "text",
    },
    LAST_UPDATE: {
        headerKey: "account_inquiry.col.last_update",
        format: "datetime",
    },
};

export default function AccountInquiryPage({
    titleKey = "account_inquiry.title",
    exportTitleKey = "account_inquiry.export_title",
    totalLabelKey = "account_inquiry.total_label",
    rows = [],
    totalAccounts,
    availableBalance = "0",
    balance = "0",
    bankFilterLabel = "All Banks",
    summaryCurrency = "VND",
    scope,
    wireCurrency = "VND",
    viewSettingScreenId = SCREEN_IDS.ACCOUNT_INQUIRY_VND,
    totalsByCcy,
    multiCurrencyMode = false,
    currencyOptions = [],
    selectedCurrency = null,
    onCurrencyChange,
    onRefresh,
    sortField = null,
    sortDirection = null,
    onSort,
    serverPaging,
}: AccountInquiryPageProps = {}) {
    const { t } = useTranslation();
    const exportXlsx = useExcelExport();

    // CLAUDE.md §13 — every list page binds a stable semantic
    // route-based screenId from the central registry in
    // `lib/viewSettingScreens.ts`. The VND wrapper falls through to
    // the prop default (banking-account-inquiry-vnd); the FCY wrapper
    // passes SCREEN_IDS.ACCOUNT_INQUIRY_FCY so the popover and the
    // export endpoint route to the FCY scope. Refactor frontend never
    // imports legacy JEX ids (`fnsh_0001_001`) or raw URL strings.
    const VIEW_SETTING_SCREEN_ID = viewSettingScreenId;
    const VIEW_SETTING_AREA_ID = DEFAULT_AREA_ID;
    const vs = useViewSetting(VIEW_SETTING_SCREEN_ID, VIEW_SETTING_AREA_ID);
    // Working draft for the popover: copied from `vs.items` whenever the
    // popover opens, edited locally, committed via `vs.save()` or
    // discarded via Cancel/outside-click. Null when popover is closed.
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[] | null>(null);
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    // Local (uncontrolled) state — used when `serverPaging` is omitted.
    // In server-side mode these values are shadowed by `serverPaging`
    // and the local state is held but not consulted (cheaper than
    // conditionally calling hooks).
    const [searchLocal, setSearchLocal] = useState("");
    // null = "All Banks" (default). When `serverPaging` is undefined the
    // option key is the bank's display name (uncontrolled legacy mode);
    // when defined we look up the display name from `serverPaging.bankCd`
    // via the `bankCdToName` map below.
    const [selectedBankLocal, setSelectedBankLocal] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(todayIso());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bankFilterOpen, setBankFilterOpen] = useState(false);
    /**
     * Controls the Bank Transaction Sync popup (Update button entry).
     * Mount is conditional so re-opening with a different selection
     * re-seeds the dialog's local state cleanly (§3a key-reseed pattern).
     */
    const [syncDialogOpen, setSyncDialogOpen] = useState(false);

    // Server-side mode bridge — derived from `serverPaging` so the rest
    // of the render reads from one set of variables. Bank popover still
    // operates on display strings; in server mode we maintain a
    // name↔code lookup sourced from the canonical
    // `serverPaging.bankOptions` list (NOT from the rendered rows —
    // rows are filtered + paginated, so deriving from them would narrow
    // the dropdown to whatever bank is currently selected).
    const serverMode = serverPaging != null;
    const bankCdToName = (() => {
        const out = new Map<string, string>();
        if (serverMode && serverPaging!.bankOptions.length > 0) {
            for (const b of serverPaging!.bankOptions) {
                if (b.bankCd && b.bankName && !out.has(b.bankCd)) out.set(b.bankCd, b.bankName);
            }
        } else {
            for (const r of rows) {
                if (r.bankCd && r.bankName && !out.has(r.bankCd)) out.set(r.bankCd, r.bankName);
            }
        }
        return out;
    })();
    const bankNameToCd = (() => {
        const out = new Map<string, string>();
        if (serverMode && serverPaging!.bankOptions.length > 0) {
            for (const b of serverPaging!.bankOptions) {
                if (b.bankName && b.bankCd && !out.has(b.bankName)) out.set(b.bankName, b.bankCd);
            }
        } else {
            for (const r of rows) {
                if (r.bankName && r.bankCd && !out.has(r.bankName)) out.set(r.bankName, r.bankCd);
            }
        }
        return out;
    })();
    const search = serverMode ? serverPaging!.keyword : searchLocal;
    const setSearch = serverMode
        ? (v: string) => serverPaging!.onKeywordChange(v)
        : setSearchLocal;
    const selectedBank = serverMode
        ? (serverPaging!.bankCd ? (bankCdToName.get(serverPaging!.bankCd) ?? null) : null)
        : selectedBankLocal;
    const setSelectedBank = serverMode
        ? (name: string | null) => {
              const cd = name == null ? null : (bankNameToCd.get(name) ?? null);
              serverPaging!.onBankCdChange(cd);
          }
        : setSelectedBankLocal;
    const [currencyFilterOpen, setCurrencyFilterOpen] = useState(false);
    // Balance-click popup — stores the clicked row, its anchor DOMRect (for
    // fixed positioning), and the currently selected lookup date.
    const [balancePopup, setBalancePopup] = useState<{
        row: AccountInquiryRow;
        anchorRect: DOMRect;
        date: string;
    } | null>(null);
    // Dashboard chip toggles the visibility of the TOTAL ACCOUNTS summary
    // card. Filters / table / pagination state are intentionally NOT
    // touched — the chip is purely a "show / hide the dashboard tile"
    // affordance.
    const [dashboardVisible, setDashboardVisible] = useState(true);

    const tableScrollRef = useRef<HTMLTableElement>(null);

    // Distinct bank names for the dropdown popover. In server mode
    // these come from the backend's `BANKS_AVAILABLE` list (independent
    // of the current bank/keyword/page filters — selecting one bank
    // does NOT remove the others). In uncontrolled mode we keep the
    // legacy "derive from current rows" path; mirrors the legacy
    // `distinct[]` accumulator inside `fnsh_0001_001.fn_loadData`.
    // React Compiler handles memoization for these plain const
    // derivations; do not wrap in useMemo (lint rule
    // react-hooks/preserve-manual-memoization).
    const bankOptions = (() => {
        const seen = new Set<string>();
        const out: string[] = [];
        if (serverMode && serverPaging!.bankOptions.length > 0) {
            for (const b of serverPaging!.bankOptions) {
                if (b.bankName && !seen.has(b.bankName)) {
                    seen.add(b.bankName);
                    out.push(b.bankName);
                }
            }
        } else {
            for (const r of rows) {
                if (r.bankName && !seen.has(r.bankName)) {
                    seen.add(r.bankName);
                    out.push(r.bankName);
                }
            }
        }
        return out;
    })();

    // Bank + keyword filter. In server mode the rows arriving in props
    // are already filtered server-side (Spring `findFiltered` query),
    // so we skip the in-memory pass. Uncontrolled mode keeps the legacy
    // client-side filter pass for the FCY page until it migrates.
    const q = search.trim().toLowerCase();
    const filtered = serverMode
        ? rows
        : rows.filter((r) => {
              if (selectedBank && r.bankName !== selectedBank) return false;
              if (!q) return true;
              return (
                  r.bankName.toLowerCase().includes(q) ||
                  r.nickname.toLowerCase().includes(q) ||
                  r.accountNo.toLowerCase().includes(q)
              );
          });

    // Shared pagination state — owns page / pageSize / paged / pageCount
    // and the page-1 reset on size change. Filter mutations (bank, search,
    // date) call `resetPage()` from their own onChange handlers below;
    // page-size change additionally clears row selection per legacy
    // behaviour (`onPageSizeChange` callback).
    //
    // In server mode this hook still runs (rules-of-hooks compliance)
    // but its values are discarded — we synthesise the same shape from
    // `serverPaging` (already 0-based on the wire; the Pagination
    // component is 1-based so we offset).
    const local = usePagination({
        items: filtered,
        onPageSizeChange: () => setSelectedIds(new Set()),
    });
    const safePage = serverMode ? serverPaging!.page + 1 : local.page;
    const pageSize = serverMode ? serverPaging!.pageSize : local.pageSize;
    const pageCount = serverMode ? Math.max(1, serverPaging!.totalPages) : local.pageCount;
    // In server mode `rows` is already the page slice — no further slicing.
    const paged = serverMode ? rows : local.paged;
    const setPage = serverMode
        ? (oneBased: number) => {
              const clamped = Math.max(1, Math.min(pageCount, oneBased));
              serverPaging!.onPageChange(clamped - 1);
          }
        : local.setPage;
    const setPageSize = serverMode
        ? (size: number) => {
              setSelectedIds(new Set());
              serverPaging!.onPageSizeChange(size);
              serverPaging!.onPageChange(0);
          }
        : local.setPageSize;
    const resetPage = serverMode
        ? () => serverPaging!.onPageChange(0)
        : local.resetPage;
    const counts = serverMode
        ? { shown: rows.length, total: serverPaging!.totalCount }
        : local.counts;

    const total = totalAccounts ?? String(rows.length);

    // Visible columns from View Setting, ordered by DISP_ORD. Until the
    // backend resolves we render against `FALLBACK_COLUMNS` (matches the
    // V30 system seed) so the table doesn't flash empty on first paint.
    // Filter out columns we don't have a renderer for so the row-mapper
    // never iterates an unknown FIELD_ID.
    const liveItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
    const visibleColumns: ViewSettingItem[] = liveItems
        .filter((it) => it.use_yn === "Y" && COLUMN_REGISTRY[resolveFieldKey(it.field_id)])
        .slice()
        .sort((a, b) => a.disp_ord - b.disp_ord);

    // Header "select-all" only counts SELECTABLE rows on the page so the
    // master checkbox can reach the checked state even when the page
    // contains manual / disconnected-bank rows whose individual
    // checkboxes are disabled (legacy `fnsh_0005_001.ts:502-519` — the
    // legacy code likewise excludes `.disable` rows from the "all
    // checked" calculation via `allDisable` subtraction).
    const selectableOnPage = paged.filter((r) => r.selectable !== false);
    const allOnPageSelected =
        selectableOnPage.length > 0 &&
        selectableOnPage.every((r) => selectedIds.has(r.id));
    const someOnPageSelected = selectableOnPage.some((r) =>
        selectedIds.has(r.id),
    );

    const toggleRow = (id: string, next: boolean) => {
        // Defence in depth — the disabled `<Checkbox>` cannot fire
        // `onCheckedChange` in practice, but the same row id could
        // reach here via the header "select-all" path before V35's
        // filter lands; guard anyway.
        const row = paged.find((r) => r.id === id);
        if (row && row.selectable === false) return;
        setSelectedIds((prev) => {
            const out = new Set(prev);
            if (next) out.add(id);
            else out.delete(id);
            return out;
        });
    };
    const toggleAllOnPage = (next: boolean) => {
        setSelectedIds((prev) => {
            const out = new Set(prev);
            for (const r of paged) {
                // Non-selectable rows are immune to "select-all" — never
                // added on check, never removed on uncheck.
                if (r.selectable === false) continue;
                if (next) out.add(r.id);
                else out.delete(r.id);
            }
            return out;
        });
    };

    const updateEnabled = selectedIds.size > 0;

    const handleDashboard = () => {
        // Toggle the TOTAL ACCOUNTS summary card. Filters, table, and
        // pagination state are intentionally untouched — the chip's
        // sole role is to show / hide the dashboard tile.
        setDashboardVisible((v) => !v);
    };

    const handleUpdate = () => {
        if (!updateEnabled) return;
        // Opens the Bank Transaction Sync popup. The R&D stub bumps the
        // per-account audit timestamps and the page refetches on
        // success → "Last Update" visibly moves. Legacy NXISAS bank
        // scraping is out of refactor R&D scope (workspace CLAUDE.md).
        setSyncDialogOpen(true);
    };

    /** Build the dialog's selected-account payload from the checked rows. */
    const selectedSyncAccounts: SyncSelectedAccount[] = rows
        .filter((r) => selectedIds.has(r.id))
        .map((r) => ({
            id: r.id,
            bankCd: r.bankCd,
            bankName: r.bankName,
            accountNo: r.accountNo,
            currencyCd: r.currencyCd,
        }));

    const handleList = (anchorRect: DOMRect) => {
        // CLAUDE.md §13 — the list-icon trigger opens the shared View
        // Setting popover anchored below the icon. Snapshot the current
        // `vs.items` into a local draft so checkbox / reorder edits stay
        // reversible until Save (mirrors legacy `comm_0108_001` Cancel
        // semantics). When the API hasn't responded yet (or returned an
        // empty list because the user is unauthenticated / the screen
        // isn't seeded), fall back to FALLBACK_COLUMNS so the popover
        // still opens — same fallback strategy the table uses for the
        // first-paint render. Never seed with `null`: the render
        // condition below would short-circuit and the popover would
        // silently fail to open.
        const seed = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
        setVsDraft(seed.map((it) => ({ ...it })));
        setVsAnchor(anchorRect);
    };

    const closeViewSetting = () => {
        setVsAnchor(null);
        setVsDraft(null);
    };

    const handlePrint = () => {
        // Legacy `fnsh_0001_001.printAllTable` builds a clean print frame
        // via `_v2common.app.setUpPrintTable` rather than calling
        // `window.print()` on the live DOM (which would include the
        // sidebar, top nav, action toolbar, filters, pagination, and
        // checkboxes). The shared `printReport` helper in
        // [lib/print.ts](lib/print.ts) is the WeCMS port of that pattern
        // — opens a scoped popup window with title + summary + table and
        // calls `window.print()` on it. Print source is the `filtered`
        // collection (bank + search applied, all pages) — matches the
        // legacy `tbody` clone scope.
        // Print summary mirrors the on-screen tiles: one count + balance +
        // available line per currency group when `totalsByCcy` is
        // available (covers VND single-tile and FCY multi-tile uniformly).
        // Falls back to the legacy single-line format using `summaryCurrency`
        // and the scalar totals when the backend has not sent the
        // breakdown — preserves byte-for-byte output for any caller that
        // still uses the older path.
        const summary = totalsByCcy && totalsByCcy.length > 0
            ? totalsByCcy
                  .map((g) =>
                      `${t("account_inquiry.accounts_count", { count: g.count })} (${g.ccy})` +
                      ` / ${t("account_inquiry.balance")} ${formatAmount(g.balance, g.ccy, true)}` +
                      `, ${t("account_inquiry.available_balance")} ${formatAmount(g.available, g.ccy, true)}`,
                  )
                  .join("  |  ")
            : `${t("account_inquiry.accounts_count", { count: total })}` +
              ` / ${t("account_inquiry.balance")} ${formatAmount(balance, summaryCurrency, true)}` +
              `, ${t("account_inquiry.available_balance")} ${formatAmount(availableBalance, summaryCurrency, true)}`;

        const errorWord = t("account_inquiry.error");

        printReport({
            title: t(titleKey),
            summary,
            columns: [
                {
                    header: t("account_inquiry.col.bank"),
                    render: (r) => (
                        `<strong>${escapeHtml(r.bankName)}</strong> ` +
                        `<span class="muted">${escapeHtml(r.currencyLabel ?? `VND • ${r.bankType}`)}</span>` +
                        `<div class="muted small">${escapeHtml(r.accountNo)}</div>`
                    ),
                },
                {
                    header: t("account_inquiry.col.nickname"),
                    render: (r) => escapeHtml(r.nickname),
                },
                {
                    header: t("account_inquiry.col.balance"),
                    align: "right",
                    render: (r) =>
                        escapeHtml(
                            formatAmount(r.balance, r.currencyCd ?? summaryCurrency, false),
                        ),
                },
                {
                    header: t("account_inquiry.col.available"),
                    align: "right",
                    render: (r) =>
                        escapeHtml(
                            formatAmount(r.available, r.currencyCd ?? summaryCurrency, false),
                        ),
                },
                {
                    header: t("account_inquiry.col.last_update"),
                    render: (r) => {
                        const last = humanizeDatetime(r.lastUpdate, t);
                        if (!r.error) return escapeHtml(last);
                        const tag = `<span class="err">${escapeHtml(errorWord)}</span>`;
                        return last ? `${tag}<br>${escapeHtml(last)}` : tag;
                    },
                },
            ],
            rows: filtered,
        });
    };

    const handleExportExcel = async () => {
        // Per CLAUDE.md §6 (Print / Export Rule) the page does not
        // generate the workbook itself — the shared `lib/excel.ts`
        // POSTs the filter / sort / View Setting context to the
        // backend, which re-runs the same query as the list endpoint
        // and streams XLSX bytes back. Honours unsaved popover
        // reorders by passing `vs.items` (or the fallback) directly;
        // the backend intersects with persisted visibility before
        // emitting columns (CLAUDE.md decision 4).
        // Pre-alias items so the export hook's `columnConfig[FIELD_ID]`
        // lookup hits the renderer-key map AND the wire `fieldId` shipped
        // to the backend matches its allow-list (`AccountInquiryExportProvider`
        // expects the semantic refactor names). Aliasing only here — the
        // page's `vs.items` keep their DB FIELD_IDs so View Setting Save
        // round-trips cleanly.
        const rawItems = vs.items.length > 0 ? vs.items : FALLBACK_COLUMNS;
        const items = rawItems.map((it) =>
            FIELD_ID_ALIAS[it.field_id]
                ? { ...it, field_id: FIELD_ID_ALIAS[it.field_id] }
                : it,
        );
        const sort =
            sortField && (sortDirection === "ASC" || sortDirection === "DESC")
                ? { field: sortField, direction: sortDirection }
                : null;
        // Two distinct strings — DO NOT collapse into one:
        //
        //   filename → legacy filesystem convention:
        //              `<exportTitle>_<DDMMYYYY>.xlsx`
        //              e.g. `계좌조회(VND)_02052026.xlsx` /
        //                   `Account Inquiry(VND)_02052026.xlsx`
        //              (no inner Korean space, no space before scope)
        //
        //   title    → in-sheet row-0 header cell — must match the
        //              ON-SCREEN page title verbatim so the user sees
        //              one consistent label across the page header
        //              and the exported workbook. e.g.
        //              `계좌 조회 (VND)` / `Account Inquiry (VND)`
        //              (natural spacing, NO date suffix).
        //
        // The earlier implementation reused fileName for the title
        // cell, which leaked the date suffix into the spreadsheet
        // header. Keeping these two values separated below is the
        // contract — see lib/excel.ts ExcelExportOptions.
        try {
            await exportXlsx({
                endpoint: "/api/v1/banking/accounts/export",
                screenId: VIEW_SETTING_SCREEN_ID,
                dymAreaId: VIEW_SETTING_AREA_ID,
                fileName: `${t(exportTitleKey)}_${todayDmy()}`,
                title: t(titleKey),
                items,
                columnConfig: ACCOUNT_INQUIRY_EXPORT_COLUMNS,
                t,
                filters: {
                    currency: wireCurrency,
                    // In server mode the bank filter is the legacy BANK_CD
                    // (matches what the list endpoint receives). In
                    // uncontrolled mode we still only have the display
                    // name, so pass it under the legacy alias the export
                    // provider accepts as a fallback.
                    bankCd: serverMode
                        ? (serverPaging!.bankCd ?? undefined)
                        : (selectedBank
                            ? (bankNameToCd.get(selectedBank) ?? undefined)
                            : undefined),
                    bankName: serverMode ? undefined : (selectedBank ?? undefined),
                    keyword: search.trim() || undefined,
                },
                sort,
            });
        } catch (err) {
            // Session-expired (401) is handled by the global axios
            // interceptor; everything else lands here. Sprint 2 R&D:
            // log + console — replace with `useDialog().open(...)`
            // when the export error UX gets its dedicated copy.
            // eslint-disable-next-line no-console
            console.error("Excel export failed", err);
        }
    };

    const bankFilterValue = selectedBank ?? bankFilterLabel;

    return (
        <>
        {/* Shared PageLayout owns the full-height flex column + standard
           16/24px gutters; DataTableShell owns the scroll container + pagination
           spacing — both match every other paginated page (Approval Box,
           Operation Status, e-Invoices, Transaction History) byte-for-byte so
           the BANKING_HOME landing renders the same bottom rhythm. */}
        <PageLayout>
                {/* Page header */}
                <PageHeader title={t(titleKey)}>
                    <div className="flex flex-wrap items-center gap-6">
                        {/* Dashboard chip — §11 action-button standard.
                           Toggles the TOTAL ACCOUNTS card; icon flips
                           between eye / eye-off so the button reflects
                           the current state. */}
                        <button
                            type="button"
                            onClick={handleDashboard}
                            aria-pressed={!dashboardVisible}
                            className="flex h-9 cursor-pointer items-center gap-2 rounded-md bg-white px-4 text-wb-14 font-medium text-brand shadow-wb-btn"
                        >
                            <span>{t("account_inquiry.dashboard")}</span>
                            {dashboardVisible ? (
                                <Eye className="size-5" strokeWidth={1.8} />
                            ) : (
                                <EyeOff className="size-5" strokeWidth={1.8} />
                            )}
                        </button>

                        <PageActionButtons
                            showList
                            showPrint
                            showExcel
                            onList={handleList}
                            onPrint={handlePrint}
                            onExport={handleExportExcel}
                        />

                        {/* Update — disabled until at least one row is checked, per legacy `#acct_Reg`. */}
                        <button
                            type="button"
                            disabled={!updateEnabled}
                            onClick={handleUpdate}
                            className={cn(
                                "flex h-9 items-center gap-2 rounded-md px-4 text-wb-14 font-medium text-white shadow-wb-outline",
                                updateEnabled
                                    ? "cursor-pointer bg-brand hover:bg-brand-hover"
                                    : "bg-wb-ntrl-4",
                            )}
                        >
                            <span>{t("account_inquiry.update")}</span>
                        </button>
                    </div>
                </PageHeader>

                {/* Summary card(s) — toggled by the Dashboard chip. Renders
                   one tile per currency group from `totalsByCcy`. VND
                   page sees a single-entry list (VND); FCY page sees one
                   entry per CCY in the filtered result. When the backend
                   has not sent `totalsByCcy` (legacy fallback) render the
                   pre-existing single tile against the scalar totals so
                   any older caller still works. */}
                {dashboardVisible && (
                    <div className="flex flex-wrap gap-3">
                        {totalsByCcy && totalsByCcy.length > 0 ? (
                            totalsByCcy.map((g) => (
                                <SummaryTile
                                    key={g.ccy}
                                    title={t(totalLabelKey, { ccy: g.ccy })}
                                    count={t("account_inquiry.accounts_count", { count: g.count })}
                                    availableLabel={t("account_inquiry.available_balance")}
                                    availableValue={formatAmount(g.available, g.ccy, true)}
                                    balanceLabel={t("account_inquiry.balance")}
                                    balanceValue={formatAmount(g.balance, g.ccy, true)}
                                />
                            ))
                        ) : (
                            <SummaryTile
                                title={t(totalLabelKey)}
                                count={t("account_inquiry.accounts_count", { count: total })}
                                availableLabel={t("account_inquiry.available_balance")}
                                availableValue={formatAmount(availableBalance, summaryCurrency, true)}
                                balanceLabel={t("account_inquiry.balance")}
                                balanceValue={formatAmount(balance, summaryCurrency, true)}
                            />
                        )}
                    </div>
                )}

                {/* Filter row — same shape as every other paginated page */}
                <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <FilterDropdown
                                value={bankFilterValue}
                                onClick={() => setBankFilterOpen((o) => !o)}
                                className="w-[150px]"
                            />
                            {bankFilterOpen && (
                                <BankFilterPopover
                                    options={bankOptions}
                                    selected={selectedBank}
                                    allLabel={bankFilterLabel}
                                    onSelect={(value) => {
                                        setSelectedBank(value);
                                        resetPage();
                                        setBankFilterOpen(false);
                                    }}
                                    onClose={() => setBankFilterOpen(false)}
                                />
                            )}
                        </div>
                        {/* Currency dropdown — FCY-only second filter chip.
                           Owned by the client wrapper because changing the
                           value re-fires the API call (wire `currency`
                           param flips between `FCY` and a concrete CCY).
                           Options are cached upstream so they persist when
                           the user narrows. */}
                        {multiCurrencyMode && (
                            <div className="relative">
                                <FilterDropdown
                                    value={
                                        selectedCurrency ??
                                        t("account_inquiry.currency_filter_all")
                                    }
                                    onClick={() => setCurrencyFilterOpen((o) => !o)}
                                    className="w-[150px]"
                                />
                                {currencyFilterOpen && (
                                    <CurrencyFilterPopover
                                        options={currencyOptions}
                                        selected={selectedCurrency ?? null}
                                        allLabel={t("account_inquiry.currency_filter_all")}
                                        onSelect={(value) => {
                                            onCurrencyChange?.(value);
                                            resetPage();
                                            setCurrencyFilterOpen(false);
                                        }}
                                        onClose={() => setCurrencyFilterOpen(false)}
                                    />
                                )}
                            </div>
                        )}
                        {/* Inquiry date — chip + calendar icon share one trigger via
                           the shared <DateField>. Click on either opens the Figma
                           77:12230 popup; selecting a day commits the value and
                           resets the table to page 1, mirroring the legacy
                           `$(document).on('change', '#TO_DT', …)` refetch. */}
                        <DateField
                            value={selectedDate}
                            onChange={(iso) => {
                                setSelectedDate(iso || todayIso());
                                resetPage();
                            }}
                        />
                    </div>
                    <SearchInput
                        value={search}
                        onChange={(v) => {
                            setSearch(v);
                            resetPage();
                        }}
                    />
                </div>

                {/* Paginated table shell — CLAUDE.md §7a. Shared component
                   owns the scroll container, sticky-header anchor, and
                   pagination spacing so this page renders the same bottom
                   rhythm as every other paginated page.

                   Columns (apart from the always-rendered checkbox) come
                   from the shared View Setting hook (CLAUDE.md §13) keyed
                   by WEB_SVC_ID = fnsh_0001_001. While the API is
                   resolving we fall back to the V30 system seed so the
                   table doesn't flash empty. */}
                <DataTableShell
                    footerMode="paginationOnly"
                    table={
                        <table
                            ref={tableScrollRef}
                            className="w-full min-w-[var(--w-wb-table-min)] table-fixed border-collapse"
                        >
                            <colgroup>
                                <col className="w-[var(--w-wb-col-checkbox)]" />
                                {visibleColumns.map((col) => (
                                    <col
                                        key={col.field_id}
                                        className={
                                            COLUMN_REGISTRY[resolveFieldKey(col.field_id)]?.colClassName ??
                                            "w-[160px]"
                                        }
                                    />
                                ))}
                            </colgroup>
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                    <TableHead className="px-2.5 text-left">
                                        <Checkbox
                                            className="size-[var(--size-wb-icon-sm)]"
                                            checked={
                                                allOnPageSelected
                                                    ? true
                                                    : someOnPageSelected
                                                        ? "indeterminate"
                                                        : false
                                            }
                                            onCheckedChange={(v) => toggleAllOnPage(v === true)}
                                            aria-label={t("payment.aria.select_all")}
                                        />
                                    </TableHead>
                                    {/* CLAUDE.md §5 table-typography rule: Account Inquiry (VND)
                                       opts into the 13px table-text standard via `textSizeClass`.
                                       Sort wiring (CLAUDE.md §13a) — a column is sortable when
                                       (a) its View Setting `SORT_YN === "Y"`, (b) it is NOT a
                                       special CHECKBOX/ETC row, and (c) the page received an
                                       `onSort` handler from the client wrapper. The backend
                                       whitelist (`AccountSortField`) is the second line of
                                       defence — unknown FIELD_IDs fall back to default ORDER BY. */}
                                    {visibleColumns.map((col) => {
                                        const rendererKey = resolveFieldKey(col.field_id);
                                        const def = COLUMN_REGISTRY[rendererKey];
                                        if (!def) return null;
                                        const sortable =
                                            col.sort_yn === "Y" &&
                                            !isSpecialViewSettingField(col.field_id);
                                        return (
                                            <TableHeaderCell
                                                key={col.field_id}
                                                textSizeClass="text-wb-13"
                                                align={def.align}
                                                className={def.headerClassName}
                                                sortable={sortable}
                                                sortFieldId={sortable ? rendererKey : undefined}
                                                activeSortField={sortField}
                                                activeSortDirection={sortDirection}
                                                onSort={sortable ? onSort : undefined}
                                            >
                                                {t(def.headerKey)}
                                            </TableHeaderCell>
                                        );
                                    })}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paged.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                                    >
                                        <TableCell className="px-2.5">
                                            {/* Manual-registration rows + rows on
                                               disconnected banks render a disabled
                                               checkbox with a native-`title` hover
                                               tooltip — mirrors legacy
                                               `fnsh_0005_001.ts:708-719` which
                                               renders `<input … disabled>` plus a
                                               `data-tooltip` on the label. Wrapping
                                               span owns the `title` so the tooltip
                                               surfaces even though Radix swallows
                                               pointer events on the disabled
                                               checkbox itself. */}
                                            <span
                                                title={
                                                    row.selectable === false &&
                                                    row.disabledReasonKey
                                                        ? t(row.disabledReasonKey)
                                                        : undefined
                                                }
                                                className="inline-flex"
                                            >
                                                <Checkbox
                                                    className={cn(
                                                        "size-[var(--size-wb-icon-sm)]",
                                                        // Manual / disconnected rows render a
                                                        // solid muted-grey square with no
                                                        // border, matching the legacy
                                                        // `.checkbox.disabled` asset. Override
                                                        // the primitive's default
                                                        // `disabled:opacity-50` (which dims the
                                                        // border into a faint outline) and
                                                        // re-skin with `bg-wb-ntrl-4` +
                                                        // `border-transparent` so the row
                                                        // reads as "non-interactive surface"
                                                        // instead of "muted checkbox".
                                                        row.selectable === false &&
                                                            "border-transparent bg-wb-ntrl-4 opacity-100",
                                                    )}
                                                    checked={selectedIds.has(row.id)}
                                                    disabled={row.selectable === false}
                                                    onCheckedChange={(v) => toggleRow(row.id, v === true)}
                                                    aria-label={`Select ${row.nickname}`}
                                                />
                                            </span>
                                        </TableCell>
                                        {visibleColumns.map((col) => {
                                            const def = COLUMN_REGISTRY[resolveFieldKey(col.field_id)];
                                            if (!def) return null;
                                            return (
                                                <TableCell
                                                    key={col.field_id}
                                                    className={def.cellClassName}
                                                >
                                                    {def.renderBody({
                                                        row,
                                                        t,
                                                        summaryCurrency,
                                                        onBalanceClick: (e) =>
                                                            setBalancePopup({
                                                                row,
                                                                anchorRect: e.currentTarget.getBoundingClientRect(),
                                                                date: selectedDate,
                                                            }),
                                                    })}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    }
                    pagination={
                        <Pagination
                            page={safePage}
                            pageCount={pageCount}
                            pageSize={pageSize}
                            totalLabel={t("common.showing_of", {
                                shown: String(counts.shown),
                                total: String(counts.total),
                            })}
                            onPageChange={setPage}
                            onPageSizeChange={setPageSize}
                            className="shrink-0"
                        />
                    }
                />
        </PageLayout>

        {/* Balance-click popup — rendered via createPortal at document.body
           inside the BalancePopover component so it floats above sticky
           table headers and escapes the DataTableShell overflow container. */}
        {balancePopup && (
            <BalancePopover
                row={balancePopup.row}
                anchorRect={balancePopup.anchorRect}
                date={balancePopup.date}
                summaryCurrency={summaryCurrency}
                scope={scope}
                onClose={() => setBalancePopup(null)}
                onDateChange={(iso) =>
                    setBalancePopup((prev) => (prev ? { ...prev, date: iso } : null))
                }
            />
        )}

        {/* Bank Transaction Sync popup — opens on the "Update" toolbar
           button. R&D stub: backend bumps audit timestamps, list refetches,
           "Last Update" column visibly moves. Conditional mount + key reseed
           on the selected-id set so re-opening with a different selection
           starts the dialog's local state fresh (§3a). */}
        {syncDialogOpen && selectedSyncAccounts.length > 0 && (
            <TransactionSyncDialog
                key={selectedSyncAccounts.map((a) => a.id).sort().join(",")}
                selectedAccounts={selectedSyncAccounts}
                onClose={() => {
                    // Clear selection on dialog close (not on
                    // onSyncComplete). Clearing inside
                    // onSyncComplete empties selectedSyncAccounts
                    // → the mount gate above flips false → the
                    // popup unmounts mid-flow, so the user never
                    // sees the post-completion state (green
                    // progress bar + Success/Failed tally + View
                    // links). Keeping the selection alive until
                    // close preserves the popup state through the
                    // entire post-sync surface.
                    setSyncDialogOpen(false);
                    setSelectedIds(new Set());
                }}
                onSyncComplete={() => {
                    if (onRefresh) onRefresh();
                }}
            />
        )}

        {/* View Setting popover — Figma 100:13382 / CLAUDE.md §13.
           The draft is a local copy of `vs.items`; Save commits via the
           shared hook (PUT /api/v1/screen-options/{screenId}/{dymAreaId})
           which optimistically updates the table and rolls back on
           failure; Reset wipes user overrides; Cancel just closes. */}
        {vsAnchor && vsDraft && (
            <ViewSettingPopover
                anchorRect={vsAnchor}
                items={vsDraft}
                onItemsChange={(next) => setVsDraft(next)}
                getLabel={(item) => {
                    // Resolve the DB FIELD_ID through the alias to the
                    // page renderer key, then to the i18n key in
                    // COLUMN_REGISTRY. Falls back to the raw FIELD_NM
                    // (legacy behaviour) when no renderer is registered
                    // — so an op-side seed with an unknown FIELD_ID
                    // still shows something readable instead of a
                    // blank label.
                    const def = COLUMN_REGISTRY[resolveFieldKey(item.field_id)];
                    return def ? t(def.headerKey) : item.field_nm;
                }}
                onSave={async () => {
                    // Hand the working draft directly to `save()` — the
                    // hook does the optimistic update + rollback on
                    // failure. Close regardless of success/failure; the
                    // hook surfaces errors via `vs.error` for the page
                    // (or a future global error dialog) to render.
                    try {
                        await vs.save(vsDraft);
                    } finally {
                        closeViewSetting();
                    }
                }}
                onReset={async () => {
                    // Wipe user overrides and re-sync the popover draft
                    // from the new sys-default list. We use the items
                    // returned by `vs.reset()` rather than reading
                    // `vs.items` here — the closure-captured `vs` is
                    // from the previous render and its `items` is stale
                    // until React re-renders this component.
                    const next = await vs.reset();
                    setVsDraft(next.map((it) => ({ ...it })));
                }}
                onClose={closeViewSetting}
            />
        )}
        </>
    );
}

/**
 * Single summary tile — title + accounts-count chip + Available Balance
 * + Balance. Used by both the VND single-tile and FCY multi-tile paths
 * so the layout is identical across pages. Kept as a local helper
 * because nowhere else in the app renders this composite (yet); promote
 * to `components/shared/` when the second consumer arrives.
 */
function SummaryTile({
    title,
    count,
    availableLabel,
    availableValue,
    balanceLabel,
    balanceValue,
}: {
    title: string;
    count: string;
    availableLabel: string;
    availableValue: string;
    balanceLabel: string;
    balanceValue: string;
}) {
    return (
        <div className="flex h-[var(--w-wb-summary-h)] w-full max-w-[var(--w-wb-summary)] flex-col justify-between rounded-md border border-wb-border-sidebar bg-wb-bg-card p-4 md:w-[var(--w-wb-summary)]">
            <div className="flex items-center gap-1.5">
                <p className="text-wb-12 font-bold text-brand">{title}</p>
                <span className="flex items-center rounded-full bg-brand-softer px-1.5 py-0.5">
                    <span className="text-wb-10 font-bold text-brand">{count}</span>
                </span>
            </div>

            <div className="flex w-full flex-col gap-2">
                <div className="flex w-full items-center justify-between">
                    <span className="text-wb-16 font-medium text-black">{availableLabel}</span>
                    <span className="text-wb-16 font-medium text-black">{availableValue}</span>
                </div>
                <div className="flex w-full items-center justify-between">
                    <span className="text-wb-13 font-medium text-black opacity-50">{balanceLabel}</span>
                    <span className="text-wb-13 font-medium text-black opacity-50">{balanceValue}</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Currency-filter popover — twin of `BankFilterPopover` with a CCY label
 * domain. Kept as a sibling component (not parameterised into one) to
 * minimise churn against the existing bank popover; can be unified
 * later when a third consumer materialises.
 */
function CurrencyFilterPopover({
    options,
    selected,
    allLabel,
    onSelect,
    onClose,
}: {
    options: string[];
    selected: string | null;
    allLabel: string;
    onSelect: (value: string | null) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLUListElement>(null);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [onClose]);
    return (
        <ul
            ref={ref}
            role="listbox"
            className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 w-[150px] overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
        >
            <li
                role="option"
                aria-selected={selected === null}
                onClick={() => onSelect(null)}
                className={cn(
                    "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                    selected === null && "bg-wb-bg-active",
                )}
            >
                {allLabel}
            </li>
            {options.map((ccy) => (
                <li
                    key={ccy}
                    role="option"
                    aria-selected={selected === ccy}
                    onClick={() => onSelect(ccy)}
                    className={cn(
                        "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                        selected === ccy && "bg-wb-bg-active",
                    )}
                >
                    {ccy}
                </li>
            ))}
        </ul>
    );
}

function BankFilterPopover({
    options,
    selected,
    allLabel,
    onSelect,
    onClose,
}: {
    options: string[];
    selected: string | null;
    allLabel: string;
    onSelect: (value: string | null) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLUListElement>(null);
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [onClose]);
    return (
        <ul
            ref={ref}
            role="listbox"
            className="custom-scrollbar-y absolute left-0 top-full z-20 mt-1 max-h-64 w-[150px] overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
        >
            <li
                role="option"
                aria-selected={selected === null}
                onClick={() => onSelect(null)}
                className={cn(
                    "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                    selected === null && "bg-wb-bg-active",
                )}
            >
                {allLabel}
            </li>
            {options.map((bank) => (
                <li
                    key={bank}
                    role="option"
                    aria-selected={selected === bank}
                    onClick={() => onSelect(bank)}
                    className={cn(
                        "cursor-pointer truncate whitespace-nowrap px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                        selected === bank && "bg-wb-bg-active",
                    )}
                >
                    {bank}
                </li>
            ))}
        </ul>
    );
}

/**
 * Last Update cell — humanizes the legacy `YYYYMMDDHHmmss` wire string
 * into "40mn ago" / "1d ago" / "3+ months ago" style display, with
 * an "Error" tag stacked above when the API marks the account's
 * balance inquiry as failed (`ACCT_BAL_INQ_STTS === "ERR"`). Empty /
 * malformed timestamp → empty cell (mirrors the legacy `<td></td>`).
 *
 * Tooltip carries the full `DD-MM-YYYY HH:mm:ss` for power users —
 * matches `common.app.formatDateTimeForView` from the legacy code.
 */
function LastUpdateCell({
    lastUpdate,
    error,
    errorLabel,
}: {
    lastUpdate: string;
    error?: boolean;
    errorLabel: string;
}) {
    const { t } = useTranslation();
    const humanized = humanizeDatetime(lastUpdate, t);
    const tooltip = formatDateTimeForView(lastUpdate);
    if (error) {
        return (
            <div className="flex flex-col" title={tooltip || undefined}>
                <span className="text-wb-13 font-medium text-wb-error">
                    {errorLabel}
                </span>
                {humanized && (
                    <span className="text-wb-13 font-medium text-wb-muted">
                        {humanized}
                    </span>
                )}
            </div>
        );
    }
    if (!humanized) {
        // Empty cell — legacy renders <td></td> when the inquiry timestamp
        // is missing. Returning a space-filled span keeps the row height.
        return <span aria-hidden>&nbsp;</span>;
    }
    return (
        <span
            className="text-wb-13 font-medium text-wb-muted"
            title={tooltip || undefined}
        >
            {humanized}
        </span>
    );
}
