import type {
    ApiActiveCard,
    ApiCardManagementRow,
    ApiCardTransactionListResponse,
    ApiCardTransactionRow,
    ApiCardTransactionTotals,
    MemoColor,
} from "@/lib/types/api";
import { formatAmount } from "@/lib/currency";
import {
    formatDateLang,
    formatUtcDtmByLanguage,
    parseLegacyTimestampUtc,
    WECMS_DISPLAY_TZ,
} from "@/lib/datetime";
import type { Locale } from "@/lib/i18n";
import type { RequestApprovalTransaction } from "@/components/payment/shared/RequestApprovalDialog";

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
    /** Resolved purpose name (USAG_INFM.USAG_NM), joined client-side at the
     *  page level from the purpose-options dictionary (grp_cd "6"). The wire
     *  ships only {@link #cardTrnsUsageCode}; this stays `undefined`/`null`
     *  until the dictionary resolves it. Legacy `card_0001_001` shows the
     *  name (not the code) in the Purpose cell. */
    cardTrnsUsageNm?:   string | null;
    chartAcctSeqNo:     string | null;
    chartAcctCd:        string | null;
    /** Resolved chart-account name (CHART_ACCT_INFM.CHART_ACCT_NM_EN), joined
     *  client-side at the page level from the chart-of-accounts tree. The wire
     *  ships only {@link #chartAcctCd}; the Reporting Account cell renders the
     *  user-facing "<code> - <name>" form ("ACC-01 - REVENUE") once resolved. */
    chartAcctNm?:       string | null;
    /** Free-form description (legacy CONT). */
    description:        string | null;
    apprSeqNo:          string | null;
    /** `EXPT_RESOL_MSTR.DOC_NO` for the approval (e.g. `"VO_260521_001"`).
     *  Approval Ref. column renders this; legacy `comm_0195_001` lookup
     *  still uses {@link #apprSeqNo}. */
    apprDocNo:          string | null;
    /** Raw status code, e.g. "1". */
    status:             string | null;
    /** Localized status label resolved server-side via the legacy
     *  `wb_get_prch_stts_nm` DB function (legacy `IDO.CARD_MSTR_R002`
     *  parity). Null for unmapped codes / KM — render `status` as fallback. */
    statusName:         string | null;
    /** True when the row has no approval reference — used for the
     *  legacy yellow-highlight + delete affordance. */
    highlighted:        boolean;
    /** Documents linked to this card transaction (every row in
     *  `BUSA_DOC_RCV_PAY_HIS` where `RCV_PAY_WAY_CD='C'` +
     *  `REF_NO=cardSeqNo`). Empty when no link has been recorded —
     *  the Link Reference cell shows the `Link` CTA in that case. */
    linkedDocs:         LinkedDocRef[];
    /** Row-level memo sticker color (wire `fileX` token) — the color of
     *  this card's memo thread. `null` when the row has no memo, so the
     *  grid renders the default (empty) memo icon. */
    memoColor:          MemoColor | null;
    /** Number of memos on this card transaction (0 = none). */
    memoCount:          number;
};

export type LinkedDocRef = {
    docId:       string;
    /** Display-friendly id (`BUSA_DOC_MSTR.DISP_DOC_ID`). */
    dispDocId:   string | null;
    /** `'B'` Bill / e-Invoice · `'E'` Expense / Receipt. */
    docType:     string;
    /** Allocated amount (`DEDU_AMT`). Decimal string. */
    totlAmt:     string | null;
};

export type CardTransactionTotals = {
    totalCount:                number;
    totalAmount:               string;
    approvalRequestedCount:    number;
    approvalRequestedAmount:   string;
    approvalNotRequestedCount: number;
    approvalNotRequestedAmount:string;
};

/** Per-link-status tab counts — always all three, independent of the
 *  active tab (see {@link ApiCardTransactionLinkCounts}). */
export type CardTransactionLinkCounts = {
    all:      number;
    linked:   number;
    unlinked: number;
};

export type CardTransactionListResult = {
    page:        number;
    pageSize:    number;
    totalCount:  number;
    totals:      CardTransactionTotals;
    linkCounts:  CardTransactionLinkCounts;
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
        apprDocNo:         api.appr_doc_no,
        status:            api.stts,
        statusName:        api.stts_nm,
        highlighted:       !api.appr_seq_no || api.appr_seq_no.trim() === "",
        linkedDocs:        (api.linked_docs ?? []).map((d) => ({
            docId:     d.doc_id,
            dispDocId: d.disp_doc_id,
            docType:   d.doc_type,
            totlAmt:   d.totl_amt,
        })),
        memoColor:         api.memo_color ?? null,
        memoCount:         api.memo_count ?? 0,
    };
}

/**
 * Project a wire {@link ApiCardTransactionRow} onto the shared
 * {@link RequestApprovalTransaction} the read-only Approval Details popup
 * (`ReadOnlyCardCell`) renders. The single source of truth for the card →
 * approval-transaction mapping — consumed by BOTH the Approval Box card
 * detail loader (`ApprovalBoxPage`) and the Card Transactions Approval Ref
 * popup (`ApprovalRefDetailDialog`) so the card grid is identical from both
 * entry points (two-call rule). Field mapping mirrors legacy
 * `comm_0195_001.ts:CardDetails(data.REC4)` / `CARD_TRNS_HSTR_R002`;
 * GAP-CARD-FIELDS surfaces the extra detail fields. Amount stays
 * symbol-less (`vi-VN` group format) because the card footer renders
 * CCY_CD + amount in separate cells.
 */
export function cardRowToApprovalTransaction(
    row: ApiCardTransactionRow,
): RequestApprovalTransaction {
    return {
        id:               row.card_seq_no,
        depositBankCode:  row.bank_cd,
        depositBankName:  row.bank_nm ?? row.bank_cd,
        depositBankCcyCd: row.ccy_cd,
        depositAccountNo: row.card_no,
        transferAmount:   row.trsc_amt ? formatAmount(row.trsc_amt, row.ccy_cd, false) : "",
        recipientName:    row.merch_nm ?? undefined,
        description:      row.cont ?? undefined,
        reportingAccount: row.chart_acct_cd ?? undefined,
        purpose:          row.card_trns_usage_code ?? undefined,
        // GAP-CARD-FIELDS — legacy CARD_TRNS_HSTR_R002 detail fields.
        cardName:         row.card_nm ?? undefined,
        txnDate:          row.trsc_dt ?? undefined,
        txnTime:          row.trsc_tm ?? undefined,
        usingType:        row.using_type ?? undefined,
        purchaseStatus:   row.stts ?? undefined,
        authCode:         row.auth_code ?? undefined,
        city:             row.city ?? undefined,
        note:             row.note ?? undefined,
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
        linkCounts: {
            all:      api.link_counts.all,
            linked:   api.link_counts.linked,
            unlinked: api.link_counts.unlinked,
        },
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

/** Calendar day (`yyyy-MM-dd`) of an absolute instant rendered in the
 *  WeCMS display timezone (Asia/Ho_Chi_Minh). Used to decide whether a
 *  `MOD_DTM` falls on the same VN business day as "now" — the gate for
 *  the relative "X ago" branch vs. the full-date branch below. */
function vnCalendarDay(d: Date): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: WECMS_DISPLAY_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

/** Legacy parity for the `MOD_DTM` cell in the Card Management modal
 *  (mirrors `card_0001_003.ts:241-255`):
 *
 *  - same VN calendar day → "X minutes ago" / "X hours ago"
 *  - otherwise            → "DD-MMM-YYYY HH:mm" (locale-aware, VN time)
 *
 *  <p><b>Timezone.</b> The backend stamps `MOD_DTM` with
 *  {@code OffsetDateTime.now(ZoneOffset.UTC)} (see
 *  {@code CardTransactionsService.nowDtm14()}), so the 14-char string is a
 *  UTC wall-clock with no zone marker. It MUST be read back as a UTC
 *  instant — {@link parseLegacyTimestampUtc} for the "X ago" elapsed maths,
 *  {@link formatUtcDtmByLanguage} for the full stamp (which converts to
 *  Asia/Ho_Chi_Minh, UTC+7). The previous local-time parse over-stated the
 *  elapsed time by the viewer's offset (+7h in Vietnam), so a just-toggled
 *  card read as "7 hours ago" and the full-date branch showed the raw UTC
 *  clock instead of VN local time.
 *
 *  <p>Input is the legacy `yyyyMMddHHmmss` wire string; empty inputs return
 *  "". The "ago" string stays in English so the column reads the same
 *  across locales — same convention as the rest of the app's date chips. */
export function formatCardModDtm(
    raw: string | null | undefined,
    locale: Locale,
): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (trimmed.length !== 14) return "";

    const cell = parseLegacyTimestampUtc(trimmed);
    if (!cell) return "";

    const now = new Date();
    const sameDay = vnCalendarDay(cell) === vnCalendarDay(now);

    if (sameDay) {
        const ms     = now.getTime() - cell.getTime();
        const mins   = Math.max(0, Math.floor(ms / 60_000));
        if (mins < 1)  return "just now";
        if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
        const hours  = Math.floor(mins / 60);
        return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    // Prior day → full stamp converted to VN local time. formatUtcDtmByLanguage
    // owns both the UTC→VN shift and the per-locale date layout; drop the
    // trailing :ss for the legacy short "DD-MMM-YYYY HH:mm" form.
    const { date, time } = formatUtcDtmByLanguage(trimmed, locale);
    if (!date) return "";
    return time ? `${date} ${time.slice(0, 5)}` : date;
}

/** Optimistic {@code modDtmRaw} + {@code lastUpdate} pair for a row that
 *  was just mutated on the client (the Use toggle). The backend stamps
 *  {@code MOD_DTM} with {@code OffsetDateTime.now(ZoneOffset.UTC)} on the
 *  same PATCH, so we mirror that here — a fresh UTC `yyyyMMddHHmmss` string
 *  plus its rendered "Last update" cell ("just now"). Lets the toggle
 *  reflect the new update time in place without a refetch that would
 *  reorder the open modal; the exact server value reconciles on the next
 *  real fetch (reopen / sort / delete / edit / add). */
export function cardModDtmNow(locale: Locale): { modDtmRaw: string; lastUpdate: string } {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const raw =
        `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
        `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
    return { modDtmRaw: raw, lastUpdate: formatCardModDtm(raw, locale) };
}
