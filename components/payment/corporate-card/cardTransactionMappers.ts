import type {
    ApiActiveCard,
    ApiCardManagementRow,
    ApiCardTransactionListResponse,
    ApiCardTransactionRow,
    ApiCardTransactionTotals,
} from "@/lib/types/api";
import { formatAmount } from "@/lib/currency";
import { formatDateLang } from "@/lib/datetime";
import type { Locale } from "@/lib/i18n";

/**
 * In-memory (camelCase) shape for one Card Transaction row consumed by
 * the page components. Distinct from the legacy static-UI
 * {@code CardTransactionRow} in {@code types.ts} — that one was tuned
 * for the mock data only. New live-API code uses {@link CardTransaction}.
 */
export type CardTransaction = {
    /** Composite-PK component on the wire. Path id for PATCH / PUT. */
    cardSeqNo:          string;
    bankCd:             string;
    bankNm:             string;
    cardNo:             string;
    /** Brand chip rendered above the masked card number. */
    cardNm:             string | null;
    cardNickNm:         string | null;
    cardHldrNm:         string | null;
    merchNm:            string | null;
    ccyCd:              string;
    /** Locale-formatted amount including the currency suffix (e.g. "1.234.567 ₫"). */
    trscAmt:            string;
    /** Raw decimal string from the wire — kept so edit handlers /
     *  Excel export can re-format on demand without re-parsing. */
    trscAmtRaw:         string | null;
    /** Locale-formatted yyyyMMdd, e.g. "19-Oct-2025". */
    trscDate:           string;
    /** HH:mm:ss or empty when wire `trsc_tm` is null. */
    trscTime:           string;
    cardTrnsUsageCode:  string | null;
    chartAcctSeqNo:     string | null;
    chartAcctCd:        string | null;
    /** Free-form description (legacy CONT). */
    description:        string | null;
    apprSeqNo:          string | null;
    /** Raw status code, e.g. "1". */
    status:             string | null;
    /** i18n key emitted by the server (e.g. `payment.card_transactions.status.1`). */
    statusKey:          string | null;
    /** True when the row has no approval reference — used for the
     *  legacy yellow-highlight + delete affordance. */
    highlighted:        boolean;
};

export type CardTransactionTotals = {
    totalCount:                number;
    totalAmount:               string;
    approvalRequestedCount:    number;
    approvalRequestedAmount:   string;
    approvalNotRequestedCount: number;
    approvalNotRequestedAmount:string;
};

export type CardTransactionListResult = {
    page:        number;
    pageSize:    number;
    totalCount:  number;
    totals:      CardTransactionTotals;
    rows:        CardTransaction[];
};

export type ActiveCard = {
    bankCd:      string;
    bankNm:      string;
    cardNo:      string;
    cardNm:      string | null;
    cardNickNm:  string | null;
    cardHldrNm:  string | null;
};

/** Translate one wire row → in-memory row. */
export function mapCardTransactionRow(
    api: ApiCardTransactionRow,
    locale: Locale,
): CardTransaction {
    return {
        cardSeqNo:         api.card_seq_no,
        bankCd:            api.bank_cd,
        bankNm:            api.bank_nm,
        cardNo:            api.card_no,
        cardNm:            api.card_nm,
        cardNickNm:        api.card_nick_nm,
        cardHldrNm:        api.card_hldr_nm,
        merchNm:           api.merch_nm,
        ccyCd:             api.ccy_cd,
        // No currency suffix — the table now has a dedicated
        // Currency column (CCY_CD) per legacy `card_0001_001.ts:1087`,
        // which formats with `includeSymbol=false`.
        trscAmt:           formatAmount(api.trsc_amt, api.ccy_cd, false),
        trscAmtRaw:        api.trsc_amt,
        trscDate:          formatDateLang(api.trsc_dt, locale),
        trscTime:          formatTrscTm(api.trsc_tm),
        cardTrnsUsageCode: api.card_trns_usage_code,
        chartAcctSeqNo:    api.chart_acct_seq_no,
        chartAcctCd:       api.chart_acct_cd,
        description:       api.cont,
        apprSeqNo:         api.appr_seq_no,
        status:            api.stts,
        statusKey:         api.stts_key,
        highlighted:       !api.appr_seq_no || api.appr_seq_no.trim() === "",
    };
}

/** Translate the totals envelope → in-memory totals (locale-aware
 *  amount strings). Currency on totals defaults to VND because the
 *  legacy ledger ships VND-only data; multi-currency tenants will
 *  pivot when the backend totals envelope gains a per-currency
 *  breakdown (Phase B). */
export function mapCardTransactionTotals(
    api: ApiCardTransactionTotals,
    fallbackCcy: string = "VND",
): CardTransactionTotals {
    return {
        totalCount:                api.total_count,
        totalAmount:               formatAmount(api.totl_amt, fallbackCcy, true),
        approvalRequestedCount:    api.totl_appr_req_cnt,
        approvalRequestedAmount:   formatAmount(api.totl_appr_req_amt, fallbackCcy, true),
        approvalNotRequestedCount: api.totl_appr_not_req_cnt,
        approvalNotRequestedAmount:formatAmount(api.totl_appr_not_req_amt, fallbackCcy, true),
    };
}

/** Translate the full list envelope. The row-level CCY drives each
 *  row's display; the totals fall back to VND when no rows are present. */
export function mapCardTransactionList(
    api: ApiCardTransactionListResponse,
    locale: Locale,
): CardTransactionListResult {
    const fallbackCcy = api.rows.length > 0 ? api.rows[0].ccy_cd : "VND";
    return {
        page:       api.page,
        pageSize:   api.page_size,
        totalCount: api.total_count,
        totals:     mapCardTransactionTotals(api.totals, fallbackCcy),
        rows:       api.rows.map((r) => mapCardTransactionRow(r, locale)),
    };
}

export function mapActiveCard(api: ApiActiveCard): ActiveCard {
    return {
        bankCd:     api.bank_cd,
        bankNm:     api.bank_nm,
        cardNo:     api.card_no,
        cardNm:     api.card_nm,
        cardNickNm: api.card_nick_nm,
        cardHldrNm: api.card_hldr_nm,
    };
}

/** HHmmss → HH:mm:ss. Empty string when the wire value is null /
 *  not exactly 6 chars (legacy seed rows sometimes carry blanks). */
function formatTrscTm(raw: string | null): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (trimmed.length !== 6) return "";
    return `${trimmed.slice(0, 2)}:${trimmed.slice(2, 4)}:${trimmed.slice(4, 6)}`;
}

/* ----------------------------------------------------------------------------
 *  Card Management Setting modal (legacy card_0001_003)
 * --------------------------------------------------------------------------*/

/** In-memory shape for one row of the Card Management modal. The
 *  `lastUpdate` string is pre-formatted by {@link formatCardModDtm}
 *  with the locale-aware "X ago" / "DD-MMM-YYYY HH:mm" rule. */
export type CardManagementCard = {
    bankCd:      string;
    bankNm:      string;
    cardNo:      string;
    cardNm:      string | null;
    cardNickNm:  string | null;
    cardHldrNm:  string;
    /** True when the wire `actv_yn === "Y"`. */
    active:      boolean;
    modId:       string;
    /** Raw legacy `yyyyMMddHHmmss` — kept on the row for callers that
     *  want to re-format under a different locale (the dialog itself
     *  consumes {@link lastUpdate}). */
    modDtmRaw:   string;
    /** Pre-rendered locale-aware "Last update" cell text. */
    lastUpdate:  string;
};

export function mapCardManagementCard(
    api: ApiCardManagementRow,
    locale: Locale,
): CardManagementCard {
    return {
        bankCd:     api.bank_cd,
        bankNm:     api.bank_nm,
        cardNo:     api.card_no,
        cardNm:     api.card_nm,
        cardNickNm: api.card_nick_nm,
        cardHldrNm: api.card_hldr_nm,
        active:     api.actv_yn === "Y",
        modId:      api.mod_id,
        modDtmRaw:  api.mod_dtm,
        lastUpdate: formatCardModDtm(api.mod_dtm, locale),
    };
}

/** Legacy parity for the `MOD_DTM` cell in the Card Management modal
 *  (mirrors `card_0001_003.ts:241-255`):
 *
 *  - same calendar day  → "X minutes ago" / "X hours ago"
 *  - otherwise          → "DD-MMM-YYYY HH:mm" (locale-aware)
 *
 *  Input is the legacy `yyyyMMddHHmmss` wire string; empty inputs
 *  return "". The "ago" string stays in English so the column reads
 *  the same across locales — same convention as the rest of the app's
 *  date chips. */
export function formatCardModDtm(
    raw: string | null | undefined,
    locale: Locale,
): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (trimmed.length !== 14) return "";

    const yyyy = Number(trimmed.slice(0, 4));
    const mm   = Number(trimmed.slice(4, 6));
    const dd   = Number(trimmed.slice(6, 8));
    const HH   = Number(trimmed.slice(8, 10));
    const MM   = Number(trimmed.slice(10, 12));
    if (
        !Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd) ||
        !Number.isFinite(HH)   || !Number.isFinite(MM)
    ) return "";

    const cell = new Date(yyyy, mm - 1, dd, HH, MM);
    if (Number.isNaN(cell.getTime())) return "";

    const now  = new Date();
    const sameDay =
        cell.getFullYear() === now.getFullYear() &&
        cell.getMonth()    === now.getMonth() &&
        cell.getDate()     === now.getDate();

    if (sameDay) {
        const ms     = now.getTime() - cell.getTime();
        const mins   = Math.max(0, Math.floor(ms / 60_000));
        if (mins < 1)  return "just now";
        if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
        const hours  = Math.floor(mins / 60);
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    // yyyyMMdd date prefix → locale-aware "DD-MMM-YYYY" / "YYYY-MM-DD" / "DD-MM-YYYY"
    const datePart = formatDateLang(trimmed.slice(0, 8), locale);
    const timePart = `${String(HH).padStart(2, "0")}:${String(MM).padStart(2, "0")}`;
    return `${datePart} ${timePart}`;
}
