# Card Transactions — Frontend Design (Next.js 16)

Companion to card-transactions.md _(wecms-api backend repo — not included in this clone)_, card-transactions.md _(wecms-api backend repo — not included in this clone)_, and card-transactions.md _(wecms-api backend repo — not included in this clone)_. Refactor slug: **`card-transactions`**.

> **Identifier-naming reminder** — Next.js route segment, component folder, `SCREEN_IDS` constant value, i18n key prefix, MDC tag all use kebab-case `card-transactions`. Legacy `card_0001_001*` appears only in JEX file:line citations and migration prose.
>
> **Next.js 16 reminder** — per [wecms-web/AGENTS.md](../../../AGENTS.md), check `node_modules/next/dist/docs/` before writing any non-trivial routing / data-fetching code. The notes below are design-level; implementation MR should verify against the in-tree docs.

---

## 1 · Route & folder

```
app/(dashboard)/payment/card-transactions/page.tsx          ← thin server component (metadata + composition)
components/payment/card-transactions/
├── CardTransactionsPage.tsx                                ← top-level client component
├── CardTransactionsToolbar.tsx                             ← Dashboard toggle, View Setting, Print, Excel, Manage Cards, Update
├── CardTransactionsDashboard.tsx                           ← three KPI hero cards (Total / Approval Not Requested / Approval Requested)
├── CardTransactionsFilterBar.tsx                           ← Date range + bank + card + keyword + link-status pill row
├── CardTransactionsTable.tsx                               ← bare <table> + shared <DataTableColumns> + per-row click handlers
├── CardTransactionsTableColumns.tsx                        ← shared <colgroup> + minWidth constant (table1 / table2 variants)
├── CardTransactionsTableFooter.tsx                         ← totals sibling-footer (per shared DataTableFooter pattern)
├── LinkStatusPill.tsx                                      ← All / Linked / Unlinked tri-state pill
├── ReportingAccountCell.tsx                                ← Cell renderer + "Select Account" popover trigger
├── DescriptionCell.tsx                                     ← Inline-editable cell (debounced PATCH)
├── PurposeCell.tsx                                         ← Code dropdown rendered as a popover (debounced PATCH)
├── LinkedDocsCell.tsx                                      ← Renders the first `DISP_DOC_ID` + count badge for the rest
├── ApprovalReferenceCell.tsx                               ← Click opens the receipt-details dialog
├── ReceiptDetailsDialog.tsx                                ← stackLevel={1} dialog — read-only summary of EXPT_RESOL_MSTR
├── SelectReportingAccountDialog.tsx                        ← stackLevel={1} — consumes existing chart-of-accounts/tree
├── BankFilterDropdown.tsx                                  ← multi-select bank chooser (Save / Cancel — legacy parity)
├── CardFilterDropdown.tsx                                  ← multi-select card chooser (Save / Cancel — legacy parity)
├── mockData.ts                                             ← static-UI seed; deleted in the API-wired MR
└── types.ts                                                ← in-memory camelCase types (NOT wire types — those live in lib/types/api.ts)
```

`app/(dashboard)/payment/card-transactions/page.tsx`:

```tsx
import type { Metadata } from "next";
import { CardTransactionsPage } from "@/components/payment/card-transactions/CardTransactionsPage";

export const metadata: Metadata = { title: "Card Transactions" };

export default function Page() {
  return <CardTransactionsPage />;
}
```

Thin — no business logic, no inline state. Composition only ([wecms-web/CLAUDE.md §"Coding Rules"](../../../CLAUDE.md)).

## 2 · Server vs client components

Current refactor scope ([wecms-web/CLAUDE.md §"Coding Rules"](../../../CLAUDE.md)) — everything is effectively client. `CardTransactionsPage` and every component listed above start with `"use client";` because they all consume hooks (`useApiData`, `usePagination`, `useDialog`, `useTranslation`, `useRouter`) or browser APIs.

The page-level `page.tsx` stays server (no `"use client";`); it imports the client root and renders it. This matches the existing pattern at [app/(dashboard)/banking/account-inquiry/page.tsx](../../../app/%28dashboard%29/banking/account-inquiry/page.tsx).

## 3 · Data-fetching strategy

No SSR / no Next.js API routes — the app is a SPA inside the App Router ([wecms-web/CLAUDE.md §"Project Overview"](../../../CLAUDE.md)). Data comes from `wecms-api` via the shared Axios client.

```ts
// lib/api/payment.ts (new file — follows banking.ts / addon.ts precedent)

import { api } from "@/lib/axios";
import type {
  ApiCardTransactionListResponse, ApiCardListResponse,
} from "@/lib/types/api";
import {
  mapCardTransactionListResponse, mapActiveCardList,
} from "@/lib/api/mappers";
import type { CardTransactionListParams, CardTransactionListResult, ActiveCard } from "@/components/payment/card-transactions/types";

export async function fetchCardTransactions(params: CardTransactionListParams): Promise<CardTransactionListResult> {
  const res = await api.get<{ status: { error: boolean; code: string; message: string }, data: ApiCardTransactionListResponse }>(
    "/api/v1/payment/card-transactions",
    { params: toQueryString(params) }
  );
  return mapCardTransactionListResponse(res.data.data);
}

export async function fetchActiveCards(bankCd?: string): Promise<ActiveCard[]> {
  const res = await api.get<{ data: ApiCardListResponse }>(
    "/api/v1/payment/card-transactions/cards",
    { params: bankCd ? { bank_cd: bankCd } : undefined }
  );
  return mapActiveCardList(res.data.data);
}

export async function patchCardTransaction(cardSeqNo: string, field: "description" | "purpose", value: string): Promise<void> {
  await api.patch(`/api/v1/payment/card-transactions/${encodeURIComponent(cardSeqNo)}`, { field, value });
}

export async function updateCardTransactionReportingAccount(
  cardSeqNo: string, body: { chartAcctSeqNo: string; chartAcctCd: string }
): Promise<void> {
  await api.put(`/api/v1/payment/card-transactions/${encodeURIComponent(cardSeqNo)}/reporting-account`, {
    chart_acct_seq_no: body.chartAcctSeqNo,
    chart_acct_cd:     body.chartAcctCd,
  });
}
```

Page-level orchestration uses the shared [`lib/api/useApiData.ts`](../../../lib/api/useApiData.ts) hook — single source of truth for "fetch on mount, refetch on dep change, refresh-key bump on mutation".

```ts
// inside CardTransactionsPage.tsx
const { page, pageSize, setPage, setPageSize, resetPage } = usePagination();
const [filters, setFilters] = useState<CardTransactionFilters>(initialFilters);
const [sort,    setSort]    = useState<SortState>({ field: undefined, direction: undefined });
const [refreshKey, bumpRefresh] = useRefreshKey();

const { data, isLoading, error } = useApiData(
  () => fetchCardTransactions({ ...filters, page, pageSize, sortField: sort.field, sortDirection: sort.direction }),
  [filters, page, pageSize, sort, refreshKey]
);

const { data: activeCards } = useApiData(
  () => fetchActiveCards(filters.bankCds.length === 1 ? filters.bankCds[0] : undefined),
  [filters.bankCds]
);
```

`bumpRefresh()` fires after a successful PATCH / PUT / "Save bank selection" — re-queries the list with the same filter/sort/page snapshot. Same pattern Account Inquiry uses for its VAS-account re-bind.

## 4 · Naming — three layers, three rules

Per [wecms-web/CLAUDE.md §"API Naming & Serialization Standards"](../../../CLAUDE.md):

### 4.1 Wire types (`lib/types/api.ts`) — lowercase snake_case

```ts
export interface ApiCardTransactionRow {
  card_seq_no: string;
  bank_cd: string; bank_nm: string;
  card_no: string; card_nm: string | null; card_nick_nm: string | null; card_hldr_nm: string | null;
  merch_nm: string | null;
  ccy_cd: string;
  trsc_amt: string;                 // BigDecimal serialised — keep as string on the wire
  trsc_dt: string;                  // yyyyMMdd
  trsc_tm: string | null;           // HHmmss
  card_trns_usage_code: string | null;
  card_trns_usage_nm:   string | null;
  chart_acct_seq_no: string | null; chart_acct_cd: string | null;
  chart_acct_nm: string | null;     chart_acct_nm_en: string | null;
  chart_acct_level_nm: string | null;
  cont: string | null;
  appr_seq_no: string | null; appr_doc_no: string | null; appr_dv: string | null;
  post_seq_no: number | null; post_reg_id: string | null;
  stts: string | null; stts_key: string | null;
  linked_docs: ApiLinkedDocRef[];
  approvers:    ApiApproverRef[];
}

export interface ApiLinkedDocRef { doc_id: string; disp_doc_id: string; hand_doc_id: string | null;
                                    doc_type: string; einv_yn: "Y" | "N"; totl_amt: string; }
export interface ApiApproverRef  { apprvr_id: string; apprvr_nm: string; apprvr_stts: string; }

export interface ApiCardTransactionTotals {
  totl_amt: string;
  totl_appr_req_cnt: number;     totl_appr_req_amt: string;
  totl_appr_not_req_cnt: number; totl_appr_not_req_amt: string;
}

export interface ApiCardTransactionListResponse {
  page: number; page_size: number; total_count: number;
  totals: ApiCardTransactionTotals;
  rows: ApiCardTransactionRow[];
}

export interface ApiActiveCard {
  bank_cd: string; bank_nm: string;
  card_no: string; card_nm: string | null; card_nick_nm: string | null; card_hldr_nm: string | null;
}
export interface ApiCardListResponse { cards: ApiActiveCard[]; }
```

### 4.2 In-memory types (`components/payment/card-transactions/types.ts`) — camelCase

```ts
export interface CardTransactionRow {
  cardSeqNo: string;
  bankCd: string; bankNm: string;
  cardNo: string; cardNm: string | null; cardNickNm: string | null; cardHldrNm: string | null;
  merchNm: string | null;
  ccyCd: string;
  trscAmt: number;                  // mapped from string via Big.js / Number — see mapper
  trscDate: string;                 // yyyy-MM-dd (mapper formats the wire yyyyMMdd)
  trscTime: string | null;          // HH:mm:ss
  cardTrnsUsageCode: string | null;
  cardTrnsUsageName: string | null;
  chartAcctSeqNo: string | null; chartAcctCd: string | null;
  chartAcctName: string | null;     chartAcctNameEn: string | null;
  chartAcctLevelName: string | null;
  description: string | null;
  apprSeqNo: string | null; apprDocNo: string | null; apprDv: string | null;
  postSeqNo: number | null; postRegId: string | null;
  status: string | null; statusKey: string | null;
  linkedDocs: LinkedDocRef[];
  approvers:  ApproverRef[];
}

export interface LinkedDocRef { docId: string; dispDocId: string; handDocId: string | null;
                                  docType: string; einvYn: boolean; totalAmount: number; }
export interface ApproverRef  { approverId: string; approverName: string; approverStatus: string; }

export interface CardTransactionTotals {
  totalAmount: number;
  approvalRequestedCount: number;    approvalRequestedAmount: number;
  approvalNotRequestedCount: number; approvalNotRequestedAmount: number;
}

export interface CardTransactionListResult {
  page: number; pageSize: number; totalCount: number;
  totals: CardTransactionTotals;
  rows: CardTransactionRow[];
}

export interface ActiveCard {
  bankCd: string; bankName: string;
  cardNo: string; cardName: string | null; cardNickName: string | null; cardholder: string | null;
}
```

### 4.3 Mapper — translation happens at the boundary, exactly once

```ts
// lib/api/mappers.ts (additions — keep existing exports intact)
import type {
  ApiCardTransactionRow, ApiCardTransactionListResponse, ApiCardListResponse,
  ApiLinkedDocRef, ApiApproverRef,
} from "@/lib/types/api";
import type {
  CardTransactionRow, CardTransactionListResult,
  LinkedDocRef, ApproverRef, ActiveCard,
} from "@/components/payment/card-transactions/types";

export function mapCardTransactionRow(api: ApiCardTransactionRow): CardTransactionRow {
  return {
    cardSeqNo:          api.card_seq_no,
    bankCd:             api.bank_cd,
    bankNm:             api.bank_nm,
    cardNo:             api.card_no,
    cardNm:             api.card_nm,
    cardNickNm:         api.card_nick_nm,
    cardHldrNm:         api.card_hldr_nm,
    merchNm:            api.merch_nm,
    ccyCd:              api.ccy_cd,
    trscAmt:            Number(api.trsc_amt),
    trscDate:           formatDate8(api.trsc_dt),
    trscTime:           api.trsc_tm ? formatTime6(api.trsc_tm) : null,
    cardTrnsUsageCode:  api.card_trns_usage_code,
    cardTrnsUsageName:  api.card_trns_usage_nm,
    chartAcctSeqNo:     api.chart_acct_seq_no,
    chartAcctCd:        api.chart_acct_cd,
    chartAcctName:      api.chart_acct_nm,
    chartAcctNameEn:    api.chart_acct_nm_en,
    chartAcctLevelName: api.chart_acct_level_nm,
    description:        api.cont,
    apprSeqNo:          api.appr_seq_no,
    apprDocNo:          api.appr_doc_no,
    apprDv:             api.appr_dv,
    postSeqNo:          api.post_seq_no,
    postRegId:          api.post_reg_id,
    status:             api.stts,
    statusKey:          api.stts_key,
    linkedDocs:         (api.linked_docs ?? []).map(mapLinkedDocRef),
    approvers:          (api.approvers   ?? []).map(mapApproverRef),
  };
}

function mapLinkedDocRef(api: ApiLinkedDocRef): LinkedDocRef {
  return {
    docId: api.doc_id, dispDocId: api.disp_doc_id, handDocId: api.hand_doc_id,
    docType: api.doc_type, einvYn: api.einv_yn === "Y", totalAmount: Number(api.totl_amt),
  };
}
function mapApproverRef(api: ApiApproverRef): ApproverRef {
  return { approverId: api.apprvr_id, approverName: api.apprvr_nm, approverStatus: api.apprvr_stts };
}

export function mapCardTransactionListResponse(api: ApiCardTransactionListResponse): CardTransactionListResult {
  return {
    page: api.page, pageSize: api.page_size, totalCount: api.total_count,
    totals: {
      totalAmount:                Number(api.totals.totl_amt),
      approvalRequestedCount:     api.totals.totl_appr_req_cnt,
      approvalRequestedAmount:    Number(api.totals.totl_appr_req_amt),
      approvalNotRequestedCount:  api.totals.totl_appr_not_req_cnt,
      approvalNotRequestedAmount: Number(api.totals.totl_appr_not_req_amt),
    },
    rows: api.rows.map(mapCardTransactionRow),
  };
}

export function mapActiveCardList(api: ApiCardListResponse): ActiveCard[] {
  return api.cards.map(c => ({
    bankCd: c.bank_cd, bankName: c.bank_nm,
    cardNo: c.card_no, cardName: c.card_nm, cardNickName: c.card_nick_nm, cardholder: c.card_hldr_nm,
  }));
}
```

Components / hooks / storage helpers MUST NOT read `response.data.card_seq_no` directly — that would be a missing-mapper bug. The mapper is the single boundary.

## 5 · Reused shared / shadcn components

| Concern | Component | Notes |
|---|---|---|
| Shell | `<AppShell>` ([components/layout/AppShell.tsx](../../../components/layout/AppShell.tsx)) | Inherited via `app/(dashboard)/layout.tsx` |
| Page header | `<PageHeader>` ([components/shared/PageHeader.tsx](../../../components/shared/PageHeader.tsx)) | Title key `card_transactions.title` (18 / 500). Right slot = `<CardTransactionsToolbar>`. |
| Toolbar buttons | `<PageActionButtons>` ([components/shared/PageActionButtons.tsx](../../../components/shared/PageActionButtons.tsx)) + bespoke "Manage Cards" / "Update" pair | Per [wecms-web/CLAUDE.md §6a](../../../CLAUDE.md) every toolbar routes through `<PageActionButtons>`. |
| Filter row | `<FilterRow>` ([components/shared/FilterRow.tsx](../../../components/shared/FilterRow.tsx)) + `<SearchInput>` + `<DateRangePicker>` ([components/shared/DateRangePicker.tsx](../../../components/shared/DateRangePicker.tsx)) + custom `<BankFilterDropdown>` + `<CardFilterDropdown>` | The two multi-select dropdowns mirror the legacy "All Card Companies" / "All Cards" popovers; pattern is `FilterDropdown` from the shared library. |
| Data table | bare `<table>` + `<CardTransactionsTableColumns>` colgroup + `<DataTableShell>` ([components/shared/DataTableShell.tsx](../../../components/shared/DataTableShell.tsx)) | Bare-table pattern because the page has a sibling-footer totals row. |
| Totals footer | `<DataTableFooter>` ([components/shared/DataTableFooter.tsx](../../../components/shared/DataTableFooter.tsx)) | Renders the three totals (count / approval-requested / approval-not-requested) with column-aligned summary cells; same primitive as `ApprovalTableFooter`. |
| Pagination | `<Pagination>` + `usePagination` ([components/shared/Pagination.tsx](../../../components/shared/Pagination.tsx)) | Page-size options `[15, 20, 50, 100]` — legacy parity. |
| View Setting popover | the existing screen-id-registry popover | `SCREEN_IDS.CARD_TRANSACTIONS = "card-transactions"`. Variant `dym_area_id` decided client-side from `StoredUser.productType` (H → `table2`, F / M → `table1`). |
| Excel export | `useExcelExport` hook ([hooks/useExcelExport.ts](../../../hooks/useExcelExport.ts)) | `endpoint: "/api/v1/payment/card-transactions/export"`, `screenId: "card-transactions"`, columns built from the View Setting popover state. |
| Print | `printReport({ … })` ([lib/print.ts](../../../lib/print.ts)) | Replaces legacy `setUpDataForPrint`. |
| Dialogs (system) | `useDialog()` | Error variant for API/network/validation failures per [wecms-web/CLAUDE.md §"Dialog variant"](../../../CLAUDE.md). |
| Dialogs (feature) | shadcn `<Dialog>` primitive | `<ReceiptDetailsDialog>`, `<SelectReportingAccountDialog>` — both `stackLevel={1}`. Standard rhythm: DialogHeader / DialogBody / DialogFooter; only `max-w-*` may vary. |
| Currency formatting | `formatAmount(value, ccyCd)` ([lib/currency.ts](../../../lib/currency.ts)) | Used both on-screen and in the print/export hand-off. |
| Date formatting | `formatDate8(...)` / `formatTime6(...)` ([lib/datetime.ts](../../../lib/datetime.ts)) | New helpers may be needed for `yyyyMMdd` ↔ display — extend `lib/datetime.ts` once, not per-page. |
| Inline-editable text cell | new `<EditableTextCell>` under `components/shared/` (first consumer is this feature → "extend shared first" rule) | Pattern: focus-on-click → debounced PATCH → success/error dialog; `field === 'description'`. |
| Code dropdown cell | new `<EditableCodeCell>` (same pattern, code list source = `<UsagePicker>` shared with the future Purpose Settings consumer) | If Purpose Settings already ships this, reuse it; otherwise extract on the second consumer. |

`<EditableTextCell>` / `<EditableCodeCell>` are the only **new** shared components introduced by this feature; both land in `components/shared/` from day one because the use case is guaranteed to recur (legacy WeCMS has analogous inline editors on Transaction History, Account Inquiry, Approval Box).

## 6 · i18n keys (frontend)

Under `card_transactions.*` namespace in `locales/en.json`, `locales/ko.json`, `locales/vi.json`. **No `km.json`** entries per the established refactor stance (wecms-api/CLAUDE.md §"i18n Rules" _(wecms-api backend repo — not included in this clone)_).

Key set (EN baseline):

```json
{
  "card_transactions.title":          "Card Transactions",
  "card_transactions.description":    "Review every card transaction, classify it against your Chart of Accounts, and link it to expense resolutions.",
  "card_transactions.button.manage":  "Manage Cards",
  "card_transactions.button.update":  "Update",
  "card_transactions.button.request_approval": "Request Approval",
  "card_transactions.filter.last_30": "Last 30 Days",
  "card_transactions.filter.last_90": "Last 90 Days",
  "card_transactions.filter.last_180":"Last 180 Days",
  "card_transactions.filter.custom":  "Custom",
  "card_transactions.filter.bank":    "All Card Companies",
  "card_transactions.filter.card":    "All Cards",
  "card_transactions.filter.search_placeholder": "Search merchant, cardholder, card name, nickname",
  "card_transactions.link.all":       "All",
  "card_transactions.link.linked":    "Linked",
  "card_transactions.link.unlinked":  "Unlinked",
  "card_transactions.dashboard.total":            "TOTAL",
  "card_transactions.dashboard.approval_requested":     "APPROVAL REQUESTED",
  "card_transactions.dashboard.approval_not_requested": "APPROVAL NOT REQUESTED",
  "card_transactions.column.date_time":           "Date/Time",
  "card_transactions.column.card_number":         "Card Number",
  "card_transactions.column.merchant":            "Merchant",
  "card_transactions.column.card_nickname":       "Card Nickname",
  "card_transactions.column.cardholder":          "Cardholder",
  "card_transactions.column.currency":            "Currency Code",
  "card_transactions.column.amount":              "Amount",
  "card_transactions.column.reporting_account":   "Reporting Account",
  "card_transactions.column.status":              "Status",
  "card_transactions.column.purpose":             "Purpose",
  "card_transactions.column.link_reference":      "Link Reference",
  "card_transactions.column.description":         "Description",
  "card_transactions.column.approval_reference":  "Approval Ref.",
  "card_transactions.column.memo":                "Memo",
  "card_transactions.empty.no_rows":              "No card transactions for the selected period and filters.",
  "card_transactions.select_account":             "Select Account",
  "card_transactions.status.1":                   "Posted",
  "card_transactions.receipt_details.title":      "Receipt Details",
  "card_transactions.toast.saved":                "Saved."
}
```

`status.1` is provisional until OQ-3 is resolved. Frontend renders `t(row.statusKey ?? "")` with a fallback to the raw `row.status` value — if a code arrives with no matching key, the cell shows the raw 1-character code rather than an empty cell.

## 7 · Typography & tokens

Per workspace [CLAUDE.md §"Global Typography"](../../../CLAUDE.md) — no inline `text-[14px]`, no `style={{ fontFamily: ... }}`. Every text surface goes through the Tailwind tokens:

| Surface | Token |
|---|---|
| Page title | `text-page-title` (18 / 500) |
| Section / dashboard hero label | `text-section-title` (14 / 600) |
| KPI hero number | `text-3xl font-semibold` (27 / 600 — per `Hero / dashboard numbers` row of the typography table) |
| Body text | `text-body` (13 / 400, color `#494949`) |
| Table header | `text-table-header` (13 / 600, color `#494949`) |
| Table body | `text-table-cell` (13 / 400) |
| Filter / input / button | `text-button` (13 / 500) for buttons, `text-input` (13 / 400) for inputs |
| Helper / sub-line | `text-helper` (11 / 300) |

Card-icon "VTB(5559)" chip in the Card Number column uses the existing `wb-status-*` token family (light blue background); confirm exact token mapping in the implementation MR.

## 8 · Form validation

Filter-row validation is light (date range + simple text). RHF + Zod schema, exposed via `card_transactions.validation.*` keys:

```ts
// components/payment/card-transactions/filterSchema.ts
import { z } from "zod";

export const cardTransactionsFilterSchema = z.object({
  fromDt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "card_transactions.validation.from_dt_required" }),
  toDt:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "card_transactions.validation.to_dt_required" }),
  srchWd: z.string().max(100).optional(),
  bankCds: z.array(z.string()).max(50).default([]),
  cardNos: z.array(z.string()).max(50).default([]),
  linkYn: z.enum(["", "Y", "N"]).default(""),
}).refine(v => v.fromDt <= v.toDt, { path: ["toDt"], message: "card_transactions.validation.period_invalid" })
  .refine(v => spanDays(v.fromDt, v.toDt) <= 365, { path: ["toDt"], message: "card_transactions.validation.period_too_long" });
```

Zod messages are translation **keys**, not strings — components run `t(error.message)` when surfacing them ([loginSchema.ts](../../../app/%28auth%29/login/loginSchema.ts) is the pattern).

PATCH-form validation lives in the cell components:

- `<DescriptionCell>` — max 200 chars; trim; reject identical-value-on-blur (no-op);
- `<PurposeCell>` — must be one of the `<UsagePicker>` codes or empty.

Server-side validation still runs (Bean Validation on the request DTO) — the frontend forms reduce the round-trip count, not the trust surface.

## 9 · Error / loading / empty states

| State | Surface |
|---|---|
| Loading | `<DataTableShell loadingState="skeleton" />` — same skeleton primitive Account Inquiry uses. KPI dashboard tiles show a 3-line shimmer. |
| Empty | `<DataTableShell emptyState>` renders the `card_transactions.empty.no_rows` key + a friendly icon (re-use the existing `<EmptyState>` primitive). |
| API failure | `useDialog().open({ type: "error", title: t("dialog.error"), description: err.message, errorCode: err.code, traceId: err.traceId })`. The shared `<SystemDialog>` enforces button colours + variant. Never `type: "warning"` for an API error ([wecms-web/CLAUDE.md §"Dialog variant"](../../../CLAUDE.md)). |
| Validation failure (Zod) | Same — `type: "error"`. |
| Successful PATCH / PUT | `useDialog().open({ type: "success", title: t("dialog.success"), description: t("card_transactions.toast.saved") })` for explicit Save actions; inline-editable cells skip the dialog and rely on the cell going back to read mode (legacy parity). |
| 401 (session expired) | Caught by the Axios response interceptor in [lib/axios.ts](../../../lib/axios.ts) — the global re-auth dialog appears. No per-page handling. |

`error.code` (e.g., `WBE_CARD_TRANSACTIONS_NOT_FOUND`) is rendered verbatim in the dialog; `error.traceId` is rendered verbatim so the user can quote it to support.

## 10 · Sort cycle UI

Per [wecms-web/CLAUDE.md §13a](../../../CLAUDE.md) — header click cycles `default → ASC → DESC → default`. The header glyph reads from the shared `<TableHeaderCell>` primitive — feature components MUST NOT roll their own sort indicator.

Sortable header set (from `card_transactions` View Setting seed minus the special FIELD_IDs and the projection-only columns flagged `SORT_YN='N'` per the backend's whitelist enum): `TRSC_DT`, `CARD_NO`, `MERCH_NM`, `CARD_NICK_NM`, `CARD_HLDR_NM`, `CCY_CD`, `TRSC_AMT`, `STTS`, `CARD_TRNS_USAGE_NM`, `CHART_ACCT_NM`, `CONT`.

Non-sortable columns from the seed: `CHECKBOX_1` / `CHECKBOX_2` (admin-controlled), `MEMO` / `MEMO_2`, `DISP_DOC_ID` (projected from JSON_AGG), `APPR_DOC_NO` (projected from EXPT_RESOL_MSTR sub-select). These render without a sort glyph regardless of any `SORT_YN='Y'` the legacy seed has — frontend filter via `isSortableForCardTransactions(fieldId)` which checks the runtime registry.

## 11 · HAENGSUNG variant (`dym_area_id = "table2"`)

The View Setting popover already supports per-area variants via the existing `screenId` + `dymAreaId` API. The page selects the variant from `StoredUser.productType`:

```ts
const dymAreaId = user?.productType === "H" ? "table2" : "table1";
```

The two areas seed different `FIELD_ID` sets (`CARD_TRNS_USAGE_NM` and `CHART_ACCT_NM` are absent on `table2` per the legacy DEV seed). The page **does not branch** beyond reading the variant id — the View Setting popover renders only the columns the variant lists; rendering code consumes `viewSettingItems` rather than a hardcoded column list.

`productType` is a UI-display + gating hint only and is **never a security boundary** (wecms-api/CLAUDE.md §"JWT filter" _(wecms-api backend repo — not included in this clone)_) — the backend still enforces tenant scope from the signed JWT regardless of what the frontend renders.

## 12 · Storage / state persistence

| Key | Storage | Shape |
|---|---|---|
| (none new) | — | Page does not introduce any new `localStorage` keys. Saved-filter persistence is out of scope; per-page bookmarking goes through query-string state if PO ever asks. |

The legacy `card_0001_001` page persists the last filter set in `_v2common.app` cookie machinery (card_0001_001.ts:156 _(external reference — not included in this repository)_ — `_v2common.app.sortData(..., "#storeInputAfterShort", ...)`). Refactor drops that — page reloads start from the 30-day default. If PO wants persistence it lands as an explicit OQ-F1 (see §16).

## 13 · Accessibility

- Inline-editable cells must be keyboard-reachable (`tabIndex={0}` + `role="button"`). Hitting Enter promotes to edit mode; Escape cancels.
- Header sort triggers have `role="button"` + `aria-sort="ascending|descending|none"`.
- Modal stacking follows the §"Modal stacking convention" — `<ReceiptDetailsDialog>` and `<SelectReportingAccountDialog>` both use `stackLevel={1}`. ESC / outside-click semantics inherit the default ([wecms-web/CLAUDE.md §"Modal stack — interaction & close behaviour"](../../../CLAUDE.md)).
- All filter dropdowns / inputs carry a `<label>` (visually hidden when Figma calls for icon-only chrome) per WCAG 2.1.

## 14 · Performance considerations

- The page fetches **two** endpoints (`list` + `cards`); `cards` is cached per-`bankCd` filter combination via `useApiData`'s built-in dedupe.
- The `cards` dropdown population is roughly static during a session (no scraper write-paths on the refactor side) — refresh-key bumps only after a Save in `<BankFilterDropdown>`.
- Inline PATCH calls are debounced 400 ms; the cell renders an optimistic "saving…" indicator that resolves on the success/error dialog or the silent fall-back.
- The list endpoint is paginated server-side; no client-side virtualisation needed unless DEV row counts exceed 500 per page.
- Excel export is bounded server-side at 50 000 rows; the frontend never gathers rows for export — it sends the JSON envelope of `screenId + filters + columns` and saves the blob the server streams back ([wecms-web/CLAUDE.md §13b](../../../CLAUDE.md)).

## 15 · Browser test plan (informational — for the implementation MR)

1. Land on `/payment/card-transactions` as a tenant user with seeded data; verify the page renders with the dashboard hero + 15-row table.
2. Toggle the dashboard off; verify the row above the table collapses but the table is unchanged.
3. Apply each filter individually (bank, card, link status, keyword, date preset) and confirm the URL stays clean and the table re-fetches.
4. Click a header to sort `TRSC_AMT` DESC → confirm the rows reorder and the totals stay the same.
5. Click a `CHART_ACCT_NM` cell → "Select Account" tree opens (`stackLevel={1}`) → pick a row → confirm PATCH + table refresh.
6. Click a `CONT` cell → inline-edit → blur → confirm PATCH + success toast.
7. Click an `APPR_DOC_NO` badge → Receipt Details dialog opens with the approver list.
8. Trigger an error path (e.g., disconnect network) → confirm `<SystemDialog>` opens with `type: "error"` + the network error code + a `WBE_NETWORK` `LOCL`-suffixed trace id.
9. Click Excel export → confirm the streamed XLSX opens in the OS spreadsheet app with the expected columns + subheader.
10. As a HAENGSUNG user (`StoredUser.productType === "H"`), reload the page → confirm only `table2` columns render and the View Setting popover lists the `table2` set.

UI testing is **not optional** for any UI change per the workspace [CLAUDE.md "Doing tasks"](../../../CLAUDE.md).

## 16 · Open questions (frontend-specific)

| ID | Question | Default |
|---|---|---|
| OQ-F1 | Filter persistence across navigations (last-used date range / bank / card)? | None — start at 30-day default every visit. |
| OQ-F2 | Inline-edit autosave vs explicit "Save" toolbar button — legacy uses both. | Inline autosave on description / purpose; reporting-account stays modal (legacy parity). |
| OQ-F3 | Multi-row selection — the seed reserves `CHECKBOX_1` / `CHECKBOX_2` columns. Does Sprint 0 ship a bulk-action surface (Request Approval, etc.)? | Render the checkbox column but disable the bulk-action button (`.RequestApproval.disable` — same as legacy default). Wire when the expense-resolution slug lands. |
| OQ-F4 | Dashboard hero KPI tile click — legacy filters the table to the clicked bucket (`data-type="ALL"` / `PA`). Refactor scope? | Defer — render static tiles in Sprint 0; PO confirms if click-to-filter is in scope before the MR lands. |

Cross-reference master OQ list: docs/refactor-wecms/features/card-transactions.md §11 _(wecms-api backend repo — not included in this clone)_.
