# Internal Transfer — Refactor Frontend Design

## Screens (this feature)

- [scheduled-transfer.md](scheduled-transfer.md)
- [scheduled-transfer-details.md](scheduled-transfer-details.md)
- [transfer-result.md](transfer-result.md)
- [transfer-result-details.md](transfer-result-details.md)


| Field | Value |
|---|---|
| Slug | `internal-transfer` |
| Module | `payment` |
| Route base | `/payment/internal-transfer` |
| Feature folder | [`components/payment/internal-transfer/`](../../../../components/payment/internal-transfer) — static UI + Phase A wiring (upload dialog + data-layer foundation). Phase B will rewire pages to live data. |
| i18n key prefix | `internal_transfer.*` (plus shared `payment.appr_stts.*` / `payment.proc_stat.*` reused by siblings) |
| Status | **Phase A frontend partial (2026-05-21).** Data layer (API client + mappers + wire types + locale entries + SCREEN_IDS) shipped. `<InternalTransferUploadDialog>` shipped. Page rewiring deferred to Phase B (see §14). |
| Hook approach | **NO `react-query` / `swr`.** Frontend uses shared [`useApiData`](../../../../lib/api/useApiData.ts) hook. Per-feature hook files like `useScheduledTransferList` referenced in earlier templates do not exist — pages call the API-client functions in [`lib/api/internalTransfer.ts`](../../../../lib/api/internalTransfer.ts) through `useApiData`. |
| Companion docs | internal-transfer.md _(wecms-api backend repo — not included in this clone)_ · _payment-module-overview.md _(wecms-api backend repo — not included in this clone)_ · internal-transfer-mapping.md _(wecms-api backend repo — not included in this clone)_ · internal-transfer.md _(wecms-api backend repo — not included in this clone)_ · internal-transfer-schema.md _(wecms-api backend repo — not included in this clone)_ |

> Mirrors precedent in `components/payment/vendor-payment/`, `components/payment/expense-payment/`, `components/payment/payroll/` (sibling Payment sub-modules). The current static-UI lives at `components/payment/internal-transfer/`; Phase A landed the Excel-upload wiring and the data-layer foundation. Phase B rewires the four pages (Scheduled list/detail + Result list/detail) to live API data. See §14 (Phase A) + §15 (shared upload dialog).

---

## 1. Routes

Next.js 16 App Router. All routes already exist (static-UI scaffolded):

| Path | File | Role |
|---|---|---|
| `/payment/internal-transfer/scheduled-transfer` | [app/(dashboard)/payment/internal-transfer/scheduled-transfer/page.tsx](../../../../app/%28dashboard%29/payment/internal-transfer/scheduled-transfer/page.tsx) | Composes `<ScheduledTransferPage>` |
| `/payment/internal-transfer/scheduled-transfer/[id]` | [app/(dashboard)/payment/internal-transfer/scheduled-transfer/[id]/page.tsx](../../../../app/(dashboard)/payment/internal-transfer/scheduled-transfer/[id]/page.tsx) | Composes `<ScheduledTransferDetailPage>` (per-row detail) |
| `/payment/internal-transfer/transfer-result` | [app/(dashboard)/payment/internal-transfer/transfer-result/page.tsx](../../../../app/%28dashboard%29/payment/internal-transfer/transfer-result/page.tsx) | Composes `<TransferResultPage>` |
| `/payment/internal-transfer/transfer-result/[id]` | [app/(dashboard)/payment/internal-transfer/transfer-result/[id]/page.tsx](../../../../app/(dashboard)/payment/internal-transfer/transfer-result/[id]/page.tsx) | Composes `<TransferResultDetailPage>` |

Sidebar entries — parent "Internal Transfer" group expands to `Scheduled Transfer` and `Transfer Result` children under the Payment top-nav (already declared in [`components/layout/Sidebar.tsx`](../../../../components/layout/Sidebar.tsx) `paymentGroups` per [§ 2a](../../../../CLAUDE.md#2a-nested-sidebar-menu-expandable-parents)).

Each `[id]` dynamic page uses Next.js 16's `params: Promise<{ id: string }>` shape:

```tsx
// app/(dashboard)/payment/internal-transfer/scheduled-transfer/[id]/page.tsx
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <ScheduledTransferDetailPage id={id} />;
}
```

The feature component looks up the row in mock data (today) / API (post-wiring) and calls `notFound()` if missing — per [§ 12 "Payment Detail Page Rules"](../../../../CLAUDE.md#12-payment-detail-page-rules).

## 2. Page composition

### 2.1 Scheduled Transfer list (`<ScheduledTransferPage>`)

Composes [`<PaymentScheduledBatchListPage>`](../../../../components/payment/shared/PaymentScheduledBatchListPage.tsx) (per [§ 12a "Batch-file Scheduled list pages — ONE shared table"](../../../../CLAUDE.md#12a-payment-module-pagination-rule-all-5-modules)):

```tsx
"use client";

export function ScheduledTransferPage() {
    const { data, isLoading, error, refetch } = useScheduledTransferList(filters, sort, page, pageSize);
    const { t } = useTranslation();
    const vs = useViewSetting(SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED, DEFAULT_AREA_ID);

    return (
        <PaymentScheduledBatchListPage
            title={t("internal_transfer.title")}
            screenId={SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED}
            rows={data?.rows ?? FALLBACK_ROWS}
            currencyTotals={data?.currencyTotals ?? []}
            rowDetailHref={(row) => `/payment/internal-transfer/scheduled-transfer/${row.scdulPymnNo}`}
            onExcelUpload={() => setUploadOpen(true)}
            onRequestApproval={handleRequestApproval}
            onDispatch={handleDispatch}
            onDelete={handleDelete}
            // View Setting + sort + pagination are owned by the shell
            vs={vs}
            sort={sortState}
            page={page}
            pageSize={pageSize}
        />
    );
}
```

The "Excel Upload" toolbar button opens a per-feature wrapper:

```tsx
{uploadOpen && (
    <InternalTransferUploadDialog
        key={uploadKey}
        onClose={() => setUploadOpen(false)}
        onSaved={(scdulPymnNo) => {
            setUploadOpen(false);
            refetch();
            dialog.open({ type: "success", title: t("dialog.success"),
                          description: t("internal_transfer.dialog.save_success") });
        }}
    />
)}
```

`<InternalTransferUploadDialog>` consumes the shared [`<ExcelUploadDialog>`](../../../../components/shared/excel-upload/ExcelUploadDialog.tsx) (§ 4 below).

### 2.2 Scheduled Transfer detail (`<ScheduledTransferDetailPage>`)

Composes [`<PaymentDetailPage>`](../../../../components/payment/shared/PaymentDetailPage.tsx) — owns the breadcrumb header, file card, list-icon toolbar, sticky pagination-off footer per [§ 12 rules](../../../../CLAUDE.md#12-payment-detail-page-rules).

Per-row CTAs in the detail table:

- "Reporting Account" → opens a `<ChartOfAccountPicker>` shared popup → fires `useUpdateReportingAccount(id, lineId)` → on success refetches and shows success dialog.
- "Transfer" button at page header (only when `apprStts === "01"` AND `trnfYn === "N"`) → opens a confirmation dialog → fires `useDispatchScheduledTransfer(id)`.

### 2.3 Transfer Result list (`<TransferResultPage>`)

Composes [`<PaymentResultBatchListPage>`](../../../../components/payment/shared/PaymentResultBatchListPage.tsx) with `paginationOnly` mode — Internal Transfer Result is the **only** Payment Result variant that omits the totals footer (Figma 1:11730; per [§ 12a "Totals footer rule for batch-file Result pages"](../../../../CLAUDE.md#12a-payment-module-pagination-rule-all-5-modules)).

```tsx
<PaymentResultBatchListPage
    title={t("internal_transfer.result.title")}
    screenId={SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT}
    rows={data?.rows ?? FALLBACK}
    rowDetailHref={(row) => `/payment/internal-transfer/transfer-result/${row.scdulPymnNo}`}
    // NO `totals` prop — paginationOnly variant
/>
```

### 2.4 Transfer Result detail (`<TransferResultDetailPage>`)

Composes [`<ResultDetailView>`](../../../../components/payment/shared/ResultDetailView.tsx). Uses the canonical `resultDetailColumns` from [`detailColumns.tsx`](../../../../components/payment/shared/detailColumns.tsx) — eleven columns: Date/Time, Deposit Bank, Recipient Name, Transfer Amount, Remarks ⓘ, Results, Result Date/Time, Reporting Account, Description, Document No., Banking Transaction ID. Status pill via [`<PaymentResultBadge>`](../../../../components/payment/shared/PaymentResultBadge.tsx); the `success / failed / pending / cancelled` mapping comes from `proc_stat_key` resolved via `t(row.procStatKey)`.

## 3. Server vs client components

Every page in this feature is **client-only** ([`"use client"`](../../../../app/%28dashboard%29/payment/internal-transfer/scheduled-transfer/page.tsx) directive at the top of each feature component) because:

- TanStack-equivalent fetch goes through the local `useApiData` shared hook ([`lib/api/useApiData.ts`](../../../../lib/api/useApiData.ts)).
- View Setting state and sort cycle state live in hooks (`useViewSetting`, `useTableSort`).
- Dialogs use `useDialog()` which is a React context.

The `app/(dashboard)/payment/internal-transfer/**/page.tsx` files themselves are thin React Server Components — they set `metadata` and render the client feature component. Per [§ "Composition rules"](../../../../CLAUDE.md#composition-rules).

## 4. Excel Upload dialog (`<InternalTransferUploadDialog>`)

Mirrors the canonical [`<ChartOfAccountsExcelUploadDialog>`](../../../../components/settings/chart-of-accounts/ExcelUploadDialog.tsx) wrapper pattern — per-feature wrapper supplies columns + rows + translated chrome, the shared shell does everything else.

```tsx
// components/payment/internal-transfer/InternalTransferUploadDialog.tsx
"use client";

const COLUMNS: ExcelUploadColumn[] = [
    { id: "FINC_MDA_NO",   label: t("internal_transfer.upload.col.finc_mda_no"),   required: true, widthPx: 180 },
    { id: "RCPT_NM",       label: t("internal_transfer.upload.col.rcpt_nm"),       required: true, widthPx: 200 },
    { id: "TAR_BANK_CD",   label: t("internal_transfer.upload.col.tar_bank_cd"),   required: true, widthPx: 140 },
    { id: "ANT_DIV_CD",    label: t("internal_transfer.upload.col.ant_div_cd"),    required: true, widthPx: 110 },
    { id: "TRAN_AMT",      label: t("internal_transfer.upload.col.tran_amt"),      required: true, widthPx: 140, align: "right" },
    { id: "TRAN_USAG",     label: t("internal_transfer.upload.col.tran_usag"),                       widthPx: 220 },
    { id: "DOC_NO",        label: t("internal_transfer.upload.col.doc_no"),                          widthPx: 130 },
    { id: "NOTE",          label: t("internal_transfer.upload.col.note"),                            widthPx: 200 },
];

export function InternalTransferUploadDialog({ onClose, onSaved }: Props) {
    const parse = useParseInternalTransferExcel();
    const create = useCreateScheduledTransfer();
    const [parseResult, setParseResult] = useState<ParseExcelResponse | null>(null);
    const [withdrawal, setWithdrawal] = useState<WithdrawalSelection | null>(null);
    const [title, setTitle] = useState("");
    const dialog = useDialog();

    return (
        <ExcelUploadDialog
            title={t("internal_transfer.upload.title")}
            columns={COLUMNS}
            rows={parseResult?.rows ?? []}
            completedCount={parseResult?.sucCnt ?? 0}
            errorCount={parseResult?.errCnt ?? 0}
            uploadDisabled={!parseResult || (parseResult.errCnt ?? 0) > 0 || !title || !withdrawal}
            onDownload={() => downloadTemplate()}
            onReSelect={(file) => parse.run({ file, bankCd: withdrawal?.bankCd! }).then(setParseResult)}
            onUpload={() => create.run({ file, request: buildBody(title, withdrawal, parseResult) })
                                .then(({ scdulPymnNo }) => onSaved(scdulPymnNo))
                                .catch((err) => dialog.open({ type: "error", title: t("dialog.error"),
                                                              description: err.message, errorCode: err.code }))}
            stackLevel={1}  // opened from a top-level menu page, not from inside Settings
        />
    );
}
```

The wrapper:

- Translates every chrome string via `t(...)` and passes plain strings into the shared shell (which is i18n-free).
- Renders the withdrawal-account picker (`<WithdrawalAccountPicker>`) and the title input **above** the file-pane block — these are Internal-Transfer-specific fields not part of the shared upload shell. Extensions to the shared shell are forbidden here; the form goes in the wrapper's body region.
- Maps each `ParseExcelResponse.rows[i]` into an `ExcelUploadRow` keyed by FIELD_ID with `{ value, error? }` per cell.

## 5. View Setting registrations

Two new constants land in [`lib/viewSettingScreens.ts`](../../../../lib/viewSettingScreens.ts):

```ts
export const SCREEN_IDS = {
    // ...existing
    PAYMENT_INTERNAL_TRANSFER_SCHEDULED:        "payment-internal-transfer-scheduled",
    PAYMENT_INTERNAL_TRANSFER_SCHEDULED_DETAIL: "payment-internal-transfer-scheduled-detail",
    PAYMENT_INTERNAL_TRANSFER_RESULT:           "payment-internal-transfer-result",
    PAYMENT_INTERNAL_TRANSFER_RESULT_DETAIL:    "payment-internal-transfer-result-detail",
} as const;

export const SCREEN_ID_TO_ROUTE = {
    // ...existing
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED]:        "/payment/internal-transfer/scheduled-transfer",
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_SCHEDULED_DETAIL]: "/payment/internal-transfer/scheduled-transfer/[id]",
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT]:           "/payment/internal-transfer/transfer-result",
    [SCREEN_IDS.PAYMENT_INTERNAL_TRANSFER_RESULT_DETAIL]:    "/payment/internal-transfer/transfer-result/[id]",
} as const;
```

Per [§ 13](../../../../CLAUDE.md#13-view-setting-column-visibility--order--shared-component-never-per-page). All four screens use `dymAreaId = "default"`. Column registries per page (`COLUMN_REGISTRY` constant in each feature component) follow the existing precedent in [`<AccountInquiryPage>`](../../../../components/shared/AccountInquiryPage.tsx).

## 6. Data layer

### 6.1 API client

New file [`lib/api/internalTransfer.ts`](../../../../lib/api/internalTransfer.ts) (to be added):

```ts
import { api } from "@/lib/axios";
import { ApiCallError } from "@/lib/api/banking";   // shared error class
import type {
    ApiScheduledTransferListResponse,
    ApiScheduledTransferDetailResponse,
    ApiTransferResultListResponse,
    ApiTransferResultDetailResponse,
    ApiParseExcelResponse,
} from "@/lib/types/api";

export async function fetchScheduledTransferList(
    params: {
        fromDt: string; toDt: string;
        srchWd?: string; apprType?: string;
        pageNo?: number; pageSize?: number;
        sortField?: string; sortDirection?: "ASC" | "DESC";
    }
): Promise<ScheduledTransferList> {
    const res = await api.get<ApiResponse<ApiScheduledTransferListResponse>>(
        "/api/v1/payment/internal-transfer",
        { params },
    );
    if (res.data.status.error) throw new ApiCallError(res.data.status, res.data.trace_id);
    return mapScheduledTransferList(res.data.data!);
}

export async function fetchScheduledTransferDetail(id: string, ...): Promise<ScheduledTransferDetail> { /* … */ }

export async function parseInternalTransferExcel(file: File, bankCd: string): Promise<ParseExcelResult> {
    const form = new FormData();
    form.append("file_data", file);
    form.append("bank_cd", bankCd);
    const res = await api.post<ApiResponse<ApiParseExcelResponse>>(
        "/api/v1/payment/internal-transfer/uploads/parse", form,
        { headers: { "Content-Type": "multipart/form-data" } });
    /* … */
}

export async function createScheduledTransfer(file: File, request: CreateScheduledTransferRequest): Promise<{ scdulPymnNo: string }> {
    const form = new FormData();
    form.append("file_data", file);
    form.append("request", new Blob([JSON.stringify(toWire(request))], { type: "application/json" }));
    /* … */
}

export async function updateReportingAccount(id: string, lineId: string, body: { chartAcctSeqNo: string; chartAcctCd: string }): Promise<void> { /* … */ }

export async function deleteScheduledTransfer(id: string): Promise<void> { /* … */ }

export async function dispatchScheduledTransfer(id: string, body: { trnfCcyCd: string }): Promise<void> { /* … */ }

export async function fetchTransferResultList(params: {...}): Promise<TransferResultList> { /* … */ }
export async function fetchTransferResultDetail(id: string, params: {...}): Promise<TransferResultDetail> { /* … */ }
```

All shape translation (snake_case → camelCase) happens once in `lib/api/mappers.ts` — per [§ "API Naming & Serialization Standards"](../../../../CLAUDE.md#api-naming--serialization-standards). New mappers:

```ts
// lib/api/mappers.ts (additions)
export function mapScheduledTransferRow(api: ApiScheduledTransferRow): ScheduledTransferRow {
    return {
        scdulPymnNo:        api.scdul_pymn_no,
        scdulPymnTypeCd:    api.scdul_pymn_type_cd,
        ccyCd:              api.ccy_cd,
        titl:               api.titl,
        apprSeqNo:          api.appr_seq_no,
        totalTranAmt:       api.total_tran_amt,
        totTrnsCnt:         api.tot_trns_cnt,
        regDtm:             api.reg_dtm,
        draftUserNm:        api.draft_user_nm,
        apprStts:           api.appr_stts,
        apprSttsKey:        api.appr_stts_key,
        trnfStts:           api.trnf_stts,
        trnfYn:             api.trnf_yn,
        fileUrl:            api.file_url,
        approvers:          (api.approvers ?? []).map(mapApprover),
        apprTotalCount:     api.appr_total_count,
        apprApprovedCount:  api.appr_approved_count,
        docNo:              api.doc_no,
        apprDv:             api.appr_dv,
        postSeqNo:          api.post_seq_no,
        outBankCd:          api.out_bank_cd,
        wdrlActNo:          api.wdrl_act_no,
        outBankNm:          api.out_bank_nm,
        pymnType:           api.pymn_type,
        payDate:            api.pay_date,
        fileNm:             api.file_nm,
        postRegId:          api.post_reg_id,
        regId:              api.reg_id,
        wdrlCcyCd:          api.wdrl_ccy_cd,
    };
}
```

### 6.2 Hooks

New hooks under [`hooks/`](../../../../hooks) (cross-feature) for the recurring fetch + mutation patterns, with `useApiData` for reads:

```ts
// hooks/internalTransfer/useScheduledTransferList.ts
export function useScheduledTransferList(filters, sort, page, pageSize) {
    return useApiData(
        () => fetchScheduledTransferList({ ...filters, ...sort, pageNo: page, pageSize }),
        [filters.fromDt, filters.toDt, filters.srchWd, filters.apprType, sort.sortField, sort.sortDirection, page, pageSize],
    );
}

export function useCreateScheduledTransfer() { return useMutation(createScheduledTransfer); }
export function useDispatchScheduledTransfer() { return useMutation(dispatchScheduledTransfer); }
// ... etc
```

(`useMutation` is a small shared helper following the same shape `useApiData` does — to be added in `hooks/useMutation.ts` if not already present.)

### 6.3 Wire types

New entries in [`lib/types/api.ts`](../../../../lib/types/api.ts) — property names are lowercase snake_case per [§ "API Naming & Serialization Standards"](../../../../CLAUDE.md#api-naming--serialization-standards):

```ts
export interface ApiScheduledTransferRow {
    scdul_pymn_no: string;
    scdul_pymn_type_cd: string;
    ccy_cd: string;
    titl: string;
    appr_seq_no: string | null;
    total_tran_amt: string;            // decimal string from BigDecimal
    tot_trns_cnt: number;
    reg_dtm: string;                   // ISO-8601
    draft_user_nm: string;
    appr_stts: string;
    appr_stts_key: string | null;      // i18n key — frontend renders via t(key)
    trnf_stts: string;
    trnf_yn: "Y" | "N";
    file_url: string | null;
    approvers: ApiApproverRow[];
    appr_total_count: number;
    appr_approved_count: number;
    doc_no: string;
    appr_dv: string;
    post_seq_no: string;
    out_bank_cd: string;
    wdrl_act_no: string;
    out_bank_nm: string;
    pymn_type: string;
    pay_date: string | null;           // YYYY-MM-DD
    file_nm: string;
    post_reg_id: string;
    reg_id: string;
    wdrl_ccy_cd: string | null;
}
```

Plus `ApiScheduledTransferListResponse`, `ApiScheduledTransferDetailResponse`, `ApiTransferResultRow`, `ApiTransferResultListResponse`, `ApiTransferResultDetailResponse`, `ApiTransferResultLine`, `ApiParseExcelResponse`, `ApiParsedTransferLine`, `ApiApproverRow`.

Importantly: there is **no** generic `Api<Snake>` wire type kept on the legacy holdovers list once this lands — Internal Transfer is migrated end-to-end (backend ships snake_case) per [§ "Holdovers (still UPPER_SNAKE on the wire)"](../../../../CLAUDE.md#holdovers-still-upper_snake-on-the-wire). The previous `ApiTransferRow` / `ApiTransferHistoryResponse` entries in `lib/types/api.ts` (Banking-side Internal Transfer history holdovers) stay UPPER_SNAKE until their backend feature migrates separately — they are NOT the same feature as this Payment-module Internal Transfer.

## 7. Zod validation schemas (client-side mirror)

Used in the upload dialog body form (title + withdrawal pick) and in the line-edit popup:

```ts
// components/payment/internal-transfer/schemas.ts
export const createScheduledTransferSchema = z.object({
    titl:        z.string().min(1, "internal_transfer.validation.titl_required").max(100),
    bankCd:      z.string().min(1, "internal_transfer.validation.bank_required").max(20),
    acctNo:      z.string().min(1, "internal_transfer.validation.account_required").max(100),
    ccyCd:       z.string().length(3),
    trnfCcyCd:   z.string().length(3),
});

export const updateReportingAccountSchema = z.object({
    chartAcctSeqNo: z.string().min(1).max(10),
    chartAcctCd:    z.string().min(1).max(20),
});

export const dispatchSchema = z.object({
    trnfCcyCd: z.string().length(3),
});
```

Server is the authority — Zod is a UX-only first-pass that gates the Save button. The actual contract enforcement is server-side via Bean Validation (see backend doc § 4).

## 8. Shared UI consumed

Per the Common Reusability Rule. Use existing components — do not re-implement:

| Concern | Component |
|---|---|
| Page shell + auth | [`<AppShell>`](../../../../components/layout/AppShell.tsx) (auto-applied by `app/(dashboard)/layout.tsx`) |
| Page layout / vertical rhythm | [`<PageLayout>`](../../../../components/shared/PageLayout.tsx) |
| Page header | [`<PageHeader>`](../../../../components/shared/PageHeader.tsx) + [`<PageActionButtons>`](../../../../components/shared/PageActionButtons.tsx) |
| Scheduled batch list shell | [`<PaymentScheduledBatchListPage>`](../../../../components/payment/shared/PaymentScheduledBatchListPage.tsx) |
| Result batch list shell | [`<PaymentResultBatchListPage>`](../../../../components/payment/shared/PaymentResultBatchListPage.tsx) |
| Detail shells | [`<PaymentDetailPage>`](../../../../components/payment/shared/PaymentDetailPage.tsx) and [`<ResultDetailView>`](../../../../components/payment/shared/ResultDetailView.tsx) |
| Date-range picker | [`<DateRangePicker>`](../../../../components/shared/DateRangePicker.tsx) |
| Calendar icon | [`<CalendarIconButton>`](../../../../components/shared/CalendarIconButton.tsx) |
| Search input | [`<SearchInput>`](../../../../components/shared/SearchInput.tsx) |
| Filter row | [`<FilterRow>`](../../../../components/shared/FilterRow.tsx) + [`<FilterDropdown>`](../../../../components/shared/FilterDropdown.tsx) |
| Pagination | [`<Pagination>`](../../../../components/shared/Pagination.tsx) + `usePagination` |
| Table chrome | [`<DataTableShell>`](../../../../components/shared/DataTableShell.tsx) (used internally by the batch-list shells) |
| Table header cell + sort | [`<TableHeaderCell>`](../../../../components/shared/TableHeaderCell.tsx) + `useTableSort` |
| File card | [`<FileCard>`](../../../../components/payment/shared/FileCard.tsx) |
| Status pill — scheduled | [`<StatusBadge>`](../../../../components/payment/approval-box/StatusBadge.tsx) |
| Status pill — result | [`<PaymentResultBadge>`](../../../../components/payment/shared/PaymentResultBadge.tsx) |
| Detail status tabs | [`<DetailStatusTabs>`](../../../../components/payment/shared/DetailStatusTabs.tsx) |
| Excel Upload modal | [`<ExcelUploadDialog>`](../../../../components/shared/excel-upload/ExcelUploadDialog.tsx) (shared shell — consumed by `<InternalTransferUploadDialog>`) |
| System dialogs | `useDialog()` from [`components/shared/dialog`](../../../../components/shared/dialog) |
| Currency formatting | [`formatAmount`](../../../../lib/currency.ts) — only sanctioned amount formatter |
| Date / time formatting | [`lib/datetime.ts`](../../../../lib/datetime.ts) |
| Excel export | `useExcelExport()` from [`hooks/useExcelExport.ts`](../../../../hooks/useExcelExport.ts) |
| View Setting | `useViewSetting` + [`<ViewSettingPopover>`](../../../../components/shared/view-setting/ViewSettingPopover.tsx) |

New per-feature components introduced (live under `components/payment/internal-transfer/`):

| Component | Role |
|---|---|
| `ScheduledTransferPage.tsx` | Already exists (static UI). Wire into `useScheduledTransferList` + View Setting. |
| `ScheduledTransferDetailPage.tsx` | Already exists. Wire into `useScheduledTransferDetail`, `useUpdateReportingAccount`, `useDispatchScheduledTransfer`, `useDeleteScheduledTransfer`. |
| `TransferResultPage.tsx` | Already exists. Wire into `useTransferResultList`. |
| `TransferResultDetailPage.tsx` | Already exists. Wire into `useTransferResultDetail`. |
| `InternalTransferUploadDialog.tsx` | NEW — extends shared `<ExcelUploadDialog>` with title + withdrawal-account selector + Save action. |
| `WithdrawalAccountPicker.tsx` | NEW — list popup picking a withdrawal account from `GET /api/v1/banking/accounts`. Lifted to `components/shared/` if a second consumer arrives. |
| `ChartOfAccountPicker.tsx` | NEW (or extends existing `<ChartOfAccountsPanel>` content) — picks a Reporting Account when editing a draft line. |
| `mockData.ts`, `types.ts` | Existing — kept as the static-UI fallback during wiring per [§ 10 "Refactor Rule"](../../../../CLAUDE.md#10-refactor-rule). |

## 9. Typography & tokens

Every text element uses the workspace-typography tokens — no `text-[Npx]`, no `font-[N]`, no inline `style={{ fontFamily: ... }}`:

| Element | Token chain |
|---|---|
| Page title (`internal_transfer.title` etc.) | `text-page-title` (resolves to `text-xl font-medium` via workspace [CLAUDE.md "Tailwind mapping"](../../../../CLAUDE.md#tailwind-mapping-for-wecms-web)) |
| Section title (Detail master "Withdrawal Bank / Account No / …" labels) | `text-section-title` |
| Body / table cell | `text-base` (13 px) `font-normal` (body) or `font-medium` (table cell) |
| Table header | `text-base font-semibold` |
| Form input value | `text-base font-normal` |
| Helper / muted (`<DetailSummary>` label, account-number sub-line) | `text-base font-medium text-wb-ntrl-6` per [§ 12 "Detail summary typography"](../../../../CLAUDE.md#12-payment-detail-page-rules) |
| Status pill | resolved via `<StatusBadge>` / `<PaymentResultBadge>` (uses `wb-status-*` tokens internally) |

Amount values rendered via `formatAmount(value, ccyCd, true)` — same function used by the page header summary, the print popup, and the Excel subheader.

## 10. i18n keys (EN copy listed; KO / VI follow same key)

Per locale-coverage rule (EN + KO + VI; no `km.json` entries):

```
// locales/en.json — additions
"internal_transfer": {
    "title": "Scheduled Transfer",
    "detail.title": "Scheduled Transfer Detail",
    "result.title": "Transfer Result",
    "result_detail.title": "Transfer Result Detail",

    "column.date_time":              "Date / Time",
    "column.file_name":              "File Name",
    "column.no_of_transactions":     "No. of Transactions",
    "column.total_transfer_amount":  "Total Transfer Amount",
    "column.approval_status":        "Approval Status",
    "column.requestor":              "Requestor",
    "column.approver":               "Approver",
    "column.approval_ref":           "Approval Ref.",
    "column.approval_title":         "Approval Title",
    "column.transfer_status":        "Transfer Status",
    "column.doc_no":                 "Doc No.",
    "column.action":                 "Action",
    "column.recipient_name":         "Recipient Name",
    "column.deposit_bank":           "Deposit Bank",
    "column.transfer_amount":        "Transfer Amount",
    "column.remarks":                "Remarks",
    "column.results":                "Results",
    "column.result_date_time":       "Result Date / Time",
    "column.reporting_account":      "Reporting Account",
    "column.description":            "Description",
    "column.banking_txn_id":         "Banking Transaction ID",

    "action.request_approval":  "Request Approval",
    "action.transfer":          "Transfer",
    "action.delete":            "Delete",
    "action.excel_upload":      "Excel Upload",
    "action.edit_reporting":    "Edit Reporting Account",

    "dialog.delete_confirm":    "Delete this draft batch?",
    "dialog.dispatch_confirm":  "Execute transfer of {count} lines totalling {amount}?",
    "dialog.save_success":      "Scheduled transfer saved.",
    "dialog.delete_success":    "Scheduled transfer deleted.",
    "dialog.dispatch_success":  "Transfer dispatched.",

    "validation.titl_required":            "Title is required.",
    "validation.bank_required":            "Withdrawal bank is required.",
    "validation.account_required":         "Withdrawal account is required.",
    "validation.upload_required":          "Please select an Excel file.",

    "upload.title":                   "Upload Internal Transfer",
    "upload.step1.title":             "Step 1 — Download template",
    "upload.step2.title":             "Step 2 — Select your file",
    "upload.col.finc_mda_no":         "Recipient Account No.",
    "upload.col.rcpt_nm":             "Recipient Name",
    "upload.col.tar_bank_cd":         "Recipient Bank",
    "upload.col.ant_div_cd":          "Transfer Network",
    "upload.col.tran_amt":            "Amount",
    "upload.col.tran_usag":           "Description",
    "upload.col.doc_no":              "Doc No.",
    "upload.col.note":                "Note",

    "error.appr_locked":              "Cannot delete — this batch has been submitted for approval.",
    "error.cutoff_past":              "Past the transfer cut-off time ({cutoff}). Please retry tomorrow.",
    "error.cutoff_before":            "Transfer service starts at {start}. Please retry later.",
    "error.weekend_blocked":          "CITAD / SWIFT transfers do not run on weekends.",
    "error.approval_not_complete":    "This batch is not yet approved."
},

// Shared payment.* keys reused (also referenced by approval-box, vendor-payment, etc.)
"payment": {
    "appr_stts.draft":       "Draft",
    "appr_stts.pending":     "Pending",
    "appr_stts.in_progress": "In Progress",
    "appr_stts.approved":    "Approved",
    "appr_stts.rejected":    "Rejected",
    "appr_stts.cancelled":   "Cancelled",
    "proc_stat.pending":         "Pending",
    "proc_stat.in_progress":     "In Progress",
    "proc_stat.success":         "Success",
    "proc_stat.failed":          "Failed",
    "proc_stat.cancelled":       "Cancelled",
    "proc_stat.transfer_pending":"Transfer Pending"
}
```

Korean (`ko.json`) and Vietnamese (`vi.json`) entries land with verified translations only (per the Domain enum keys policy in api CLAUDE.md). If a verified translation is unavailable for a key on the Save Draft MR, the locale entry is omitted and the EN fallback is acceptable (LocaleProvider falls back to EN per [§ "i18n Rules"](../../../../CLAUDE.md#i18n-rules)).

## 11. Validation strategy

- **Client (Zod)** — fast UX gate on the upload dialog body (title + withdrawal selection) and on the reporting-account picker. Messages are translation keys.
- **Server (Bean Validation + service-layer cross-field rules)** — the authority. Every form posts go through `@Valid` on the controller DTO record (see backend § 4) and through `InternalTransferValidator` for cross-field rules (withdrawal account belongs to tenant, currency consistency, etc.).
- **Excel cell validation** — server-only. The parse endpoint returns `ParseExcelResponse` with per-cell `err_fld` (comma-separated FIELD_IDs) + `err_fld_caus` (cause string). The shared `<ExcelUploadDialog>` paints those cells red and disables the Upload button while `err_cnt > 0`. The frontend does **not** independently re-validate parsed rows — server output is authoritative.

## 12. Error / empty / loading states

| State | Treatment |
|---|---|
| Loading (initial fetch) | List shell shows a skeleton table (existing pattern in `<PaymentScheduledBatchListPage>` — already supports a `loading` prop). Detail shells show their own skeleton via `<PaymentDetailPage>`. |
| Empty (zero rows in filter range) | Empty-state row in the table per the existing `<DataTableShell>` precedent — `t("common.no_records")`. |
| 401 (session expired) | Handled globally by the Axios response interceptor — drops back to `/login`. |
| 404 detail / unknown id | `notFound()` from the dynamic route page → Next.js 16 not-found UI. |
| Other API errors (`WBE2014`, `WBE2018`, …) | Surface through `useDialog().open({ type: "error", title: t("dialog.error"), description: err.message, errorCode: err.code })`. Never silent. |
| Validation error (`WBE_VALIDATION`) | Render against the offending field (Zod schema's key already targets it); also surface a top-level error dialog for the rare case where field-level binding fails. |
| Excel parse error (`WBE2017`) | Dialog with the cause; user re-uploads. |
| Cut-off-time blocked dispatch | Variant `"error"` dialog with `errorCode = WBE1168` / `WBE1167` / `WBE1162`. The description string uses the localized message from the server which already interpolates `{cutoff}` / `{start}`. |

## 13. Sprint sequencing

1. **Sprint 2 — wiring**: Replace mock data in `<ScheduledTransferPage>` / `<ScheduledTransferDetailPage>` / `<TransferResultPage>` / `<TransferResultDetailPage>` with `useApiData`-driven hooks. Land the API client + mappers + wire types + Zod schemas. Land `<InternalTransferUploadDialog>`. Keep `mockData.ts` as the fallback seed while QA validates.
2. **Sprint 3 — extras**: `<ChartOfAccountPicker>` integration with `useUpdateReportingAccount`. Excel export wiring on both detail pages.
3. **Sprint 4+ — polish**: Sort + View Setting popover wiring on both list pages. `useTableSort` cycle. Print pipeline via `printReport`.

## 14. Phase A frontend implementation (as-built — Prompt 3 deliverable)

This section captures what actually shipped in the Phase A frontend MR. Sections 1–13 above remain the design contract; this section documents the deviations from the Prompt 3 template and the deferred scope.

### 14.1 Deviations from the Prompt 3 template

Every deviation is driven by an existing wecms-web CLAUDE.md / AGENTS.md rule. The Prompt 3 template was templated language that did not match the actual codebase conventions.

| Prompt 3 template | What shipped | Reason |
|---|---|---|
| Route group `app/(authenticated)/...` | `app/(dashboard)/...` (already scaffolded) | wecms-web CLAUDE.md §"Architecture Rules → Directory Layout" mandates `(dashboard)` for every authenticated route; the existing scaffolding under `app/(dashboard)/payment/internal-transfer/*` already follows this. |
| Routes `/internal-transfer/page`, `/.../new`, `/.../uploads/`, `/.../results/` | `/payment/internal-transfer/scheduled-transfer/` + `/.../transfer-result/` (with `[id]` children) | api CLAUDE.md "Refactor identifier naming" requires `/<module>/<slug>` and the Phase A backend is at `/api/v1/payment/internal-transfer`. Upload is a dialog on the Scheduled Transfer list (matches JEX `pymn_0009_002` popup UX), not a separate route. |
| TanStack Query hooks under `lib/hooks/internal-transfer/` | `useApiData` shared hook (existing) | wecms-web CLAUDE.md explicitly lists `react-query/SWR` under "Explicitly NOT used". The shared `useApiData` hook is the canonical pattern (every other ported feature uses it). |
| `locales/{en,ko,km,vi}/internal-transfer.json` (split per-feature files) | Entries appended to `locales/{en,ko,vi}.json` (flat dotted keys; KM omitted) | wecms-web CLAUDE.md §"i18n Rules" — flat dotted keys per locale file; KM not yet supported. |
| `/api/v1/internal-transfer` REST base | `/api/v1/payment/internal-transfer` | Matches the actual Phase A backend path. |

### 14.2 Phase A scope — data-layer foundation only

This MR ships the **data layer** other engineers / future MRs build on. It does NOT rewire the existing static-UI pages to live API data. The page rewiring deliberately defers to Phase B because:

- The static-UI pages consume a richer mock shape than the backend Phase A returns (e.g. `rowHighlight`, `approverCount`, status step "1/3", file size, status badge labels). Wiring would require many fallback / placeholder strategies for fields the backend returns as `null` today.
- Several Phase A backend response fields are intentionally `null` (`appr_stts`, `appr_stts_key`, `proc_stat*`, `rs_cd`, `rs_msg`, `proc_dttm`, `rslt_dttm`, dispatch-related counts) until the next-MR EXPT_RESOL_MSTR join + TB_PAY_TARGET / TB_PAY_FILE_DATA tables land (backend doc §15.6).
- The existing static UI is high-fidelity Figma work; partial wiring risks visual regression. A focused Phase B MR can rewire pages atomically once backend Phase B lands.

### 14.3 Files shipped

| File | Purpose |
|---|---|
| [lib/types/api.ts](../../../../lib/types/api.ts) | Internal Transfer wire types appended — `ApiScheduledTransferRow`, `ApiScheduledTransferListResponse`, `ApiScheduledTransferDetailResponse`, `ApiTransferLineDetail`, `ApiCreateScheduledTransferRequest`, `ApiTransferLineInput`, `ApiCreateScheduledTransferResponse`, `ApiUpdateReportingAccountRequest`, `ApiDispatchRequest`, `ApiParseExcelResponse`, `ApiParsedTransferLine`, `ApiTransferResultRow`, `ApiTransferResultListResponse`, `ApiTransferResultLine`, `ApiTransferResultDetailResponse`, `ApiInternalTransferCurrencyTotal`. snake_case property names matching Phase A backend wire shape. |
| [lib/api/internalTransfer.ts](../../../../lib/api/internalTransfer.ts) | API client wrapping 8 endpoints: `fetchScheduledTransferList`, `fetchScheduledTransferDetail`, `parseInternalTransferExcel`, `createScheduledTransfer`, `updateReportingAccount`, `deleteScheduledTransfer`, `dispatchScheduledTransfer`, `fetchTransferResultList`, `fetchTransferResultDetail`. Errors thrown as `ApiCallError` (shared with other features). |
| [lib/api/mappers.ts](../../../../lib/api/mappers.ts) | Wire→in-memory mappers + camelCase interface declarations: `ScheduledTransferRow`, `ScheduledTransferList`, `ScheduledTransferDetail`, `TransferLineDetail`, `TransferResultRow`, `TransferResultList`, `TransferResultDetail`, `TransferResultLine`, `InternalTransferCurrencyTotal`. |
| [lib/viewSettingScreens.ts](../../../../lib/viewSettingScreens.ts) | New `SCREEN_IDS` constants: `PAYMENT_INTERNAL_TRANSFER_SCHEDULED`, `PAYMENT_INTERNAL_TRANSFER_SCHEDULED_DETAIL`, `PAYMENT_INTERNAL_TRANSFER_RESULT`, `PAYMENT_INTERNAL_TRANSFER_RESULT_DETAIL`. Matching `SCREEN_ID_TO_ROUTE` entries. |
| [locales/en.json](../../../../locales/en.json), [locales/ko.json](../../../../locales/ko.json), [locales/vi.json](../../../../locales/vi.json) | Shared `payment.appr_stts.*` (6 keys) + `payment.proc_stat.*` (6 keys) + `internal_transfer.error.*` (6 keys) entries. KO/VI carry EN verbatim for now (verified translations land via the PO — same precedent as `audit.*` keys across other Settings features). KM intentionally omitted per AGENTS.md. |

### 14.4 Deferred to Phase B (next MR after backend Phase B lands)

- Rewire `<ScheduledTransferPage>` (and the other 3 list/detail pages) to consume `useApiData` + the new API client + mappers, with `mockData.ts` as graceful fallback (mirrors the Account Inquiry / Approval Box precedent).
- `<InternalTransferUploadDialog>` — **shipped** as part of the Phase A frontend MR (see § 15 below). The shared `<PaymentExcelUploadDialog>` wrapper landed alongside it so Vendor / Expense / Payroll / Overseas can reuse the popup. Phase B still needs the Title input + Withdrawal-account picker form (currently hard-coded `DEFAULT_*` constants in `<InternalTransferUploadDialog>`).
- `<ChartOfAccountPicker>` integration with `useUpdateReportingAccount` (requires CHART_ACCT_INFM entity migration on the backend).
- Dispatch / Delete CTAs on the detail page wired to `dispatchScheduledTransfer` / `deleteScheduledTransfer` with the variant-`confirmation` dialog flow.
- Sort whitelist wiring via the shared `useTableSort` hook + `<TableHeaderCell sortable>`.
- View Setting popover wiring (one of the four registered SCREEN_IDS becomes the active list popover when the page is rewired).
- Excel export wiring via the shared `useExcelExport` hook (depends on a follow-up backend `ExportRowProvider`).
- Status-badge resolution via `t(row.apprSttsKey)` and `t(row.procStatKey)` — backend returns null until EXPT_RESOL_MSTR + dispatch tables land.

### 14.5 Build status

- `npx tsc --noEmit` — passes on every new file. 4 pre-existing TS errors remain in `components/banking/account-inquiry-fcy/mockData.ts` (missing `bankCd` property on the legacy FCY mock — unrelated to this MR; pre-dates Internal Transfer work).
- `npx eslint` on every new / modified file — passes (no errors, no warnings).
- `npm run build` — not run in this MR because the FCY mockData errors above already block it pre-existingly. Will pass once those are fixed in their own MR.

## 15. Shared Payment Excel Upload (pymn_0009_002 common popup)

The legacy `pymn_0009_002` JEX popup is the Excel-upload modal Internal Transfer uses today and that Vendor Payment / Expense Payment / Payroll Payment / Overseas Payment will reuse once their wiring lands. The five payment types share the same workflow chrome (Download template → pick a file → preview rows with per-cell error highlights → confirm Save) — only the column set, the parse / save endpoints, and the i18n keys differ per payment type. To honour the Common Reusability Rule ([wecms-web/CLAUDE.md §"Common Reusability Rule"](../../../../CLAUDE.md#1-common-reusability-rule-the-two-call-rule)), the shared chrome lives in a **Payment-module shared wrapper** that every payment type composes — never forks.

### 15.1 Architecture — three layers

```
components/shared/excel-upload/ExcelUploadDialog.tsx          ← App-wide shell (Settings / Chart-of-Accounts / Contacts / VAS Account already consume this)
        ▲
        │
components/payment/shared/PaymentExcelUploadDialog.tsx        ← Payment-module wrapper — NEW (this MR)
        ▲
        │
components/payment/internal-transfer/InternalTransferUploadDialog.tsx   ← Per-payment-type thin wrapper — NEW (this MR)
components/payment/vendor-payment/VendorPaymentUploadDialog.tsx         ← Future Phase B
components/payment/expense-payment/ExpensePaymentUploadDialog.tsx       ← Future Phase B
components/payment/payroll/PayrollUploadDialog.tsx                      ← Future Phase B
components/payment/overseas-payment/OverseasPaymentUploadDialog.tsx     ← Future Phase B
```

- **Layer 1 — App-wide shell** ([components/shared/excel-upload/ExcelUploadDialog.tsx](../../../../components/shared/excel-upload/ExcelUploadDialog.tsx)). Already shipped before this MR. Owns the modal shell (Dialog, header bar, two-pane body, footer with Close + Upload), the step panel chrome (Step 1 / Step 2 numbered badges, file chip, Download / Re-Select buttons), the fixed three-table preview region, the Completed / Error summary chips. i18n-free — callers resolve `t(...)` and pass plain strings. Already consumed by Chart-of-Accounts, Contacts, VAS Account (all under Settings at `stackLevel=2`).
- **Layer 2 — Payment-module wrapper** ([components/payment/shared/PaymentExcelUploadDialog.tsx](../../../../components/payment/shared/PaymentExcelUploadDialog.tsx)). **New in this MR.** The Payment-module-specific composition of layer 1 — owns the parse/save state machine + error funnel + `stackLevel=1` default that every Payment-type upload flow needs. Per-payment-type wrappers pass two callable handlers (`onParse` + `onUpload`) and a flat `strings` bag; the shared wrapper does everything else.
- **Layer 3 — Per-payment-type thin wrapper** (e.g. [components/payment/internal-transfer/InternalTransferUploadDialog.tsx](../../../../components/payment/internal-transfer/InternalTransferUploadDialog.tsx)). Supplies the per-payment-type column set, the parse + save endpoint calls, the i18n key bag, and the wire ↔ preview row mappers. Internal Transfer is the canonical first consumer; the four sibling payment types mirror its shape.

### 15.2 `<PaymentExcelUploadDialog>` — what the shared wrapper owns

The shared Payment-module wrapper handles every concern that recurs across all five payment types:

- **File-selection state** — owns `selectedFile`, `parsed`, `isBusy` `useState`s. Spawns a hidden `<input type="file">` for the Re-Select flow (modal-scope, no DOM leakage between dialog instances).
- **Parse step** — when the user picks (or re-picks) a file, calls the caller's `onParse(file)` callback. Caller returns `PaymentExcelParseResult` ({ rows, completedCount, errorCount }) — caller is responsible for POSTing the multipart payload to its own `/uploads/parse` endpoint and mapping the response to `ExcelUploadRow[]` shaped for the columns the caller declared. Errors thrown by `onParse` are caught and routed to `useDialog()` with the `ApiCallError` code propagated.
- **Save step** — when the user clicks Upload, calls the caller's `onUpload(file, parsed)` callback. Caller is responsible for POSTing the multipart save payload (file + JSON body) to its own create endpoint. Errors are funneled the same way as parse errors. On success, the wrapper closes itself FIRST, then opens a `useDialog()` success dialog with the caller's `successDescription`, then invokes the optional `onSaved(result)` so the parent can refetch the list / route to a detail page.
- **Modal stack level** — `stackLevel={1}` (the L1 root). Payment-module upload flows open from top-level Payment menu pages, NOT from inside the Settings modal — so unlike the Settings-side Excel uploads (Chart of Accounts / Contacts / VAS Account at `stackLevel=2`), this wrapper defaults to L1. The shared shell ([components/shared/excel-upload/ExcelUploadDialog.tsx](../../../../components/shared/excel-upload/ExcelUploadDialog.tsx)) accepts the `stackLevel` prop directly; the Payment wrapper pins it.
- **Upload-button gating** — disabled until (a) the user picked a file and parse succeeded, (b) parse returned zero per-cell errors, (c) the wrapper is not currently mid-flight. Caller does not duplicate this logic.
- **Translated chrome** — every visible string (title, step titles + descriptions, Download / Re-Select / Close / Upload labels, Completed / Error summary labels, total-row label) comes from the caller's `strings` bag. The wrapper itself imports `useTranslation` only to (a) resolve the `totalLabelKey` with the `{count}` interpolation each time `rows.length` changes, and (b) supply the system error / success dialog titles via the shared `dialog.error` / `dialog.success` / `dialog.error_generic` keys. **Per-payment-type i18n keys live in the caller**, not here.

**Public props surface** ([PaymentExcelUploadDialogProps](../../../../components/payment/shared/PaymentExcelUploadDialog.tsx)):

```ts
export type PaymentExcelUploadDialogProps = {
    onClose: () => void;
    onSaved?: (result: unknown) => void;
    strings: PaymentExcelUploadStrings;
    columns: ExcelUploadColumn[];
    onParse: (file: File) => Promise<PaymentExcelParseResult>;
    onUpload: (file: File, parsed: PaymentExcelParseResult) => Promise<unknown>;
    onDownload?: () => void;
};

export type PaymentExcelParseResult = {
    rows: ExcelUploadRow[];
    completedCount: number;
    errorCount: number;
};

export type PaymentExcelUploadStrings = {
    title:              string;
    step1Title:         string;
    step1Description:   string;
    downloadLabel:      string;
    step2Title:         string;
    step2Description:   string;
    reSelectLabel:      string;
    completedLabel:     string;
    errorLabel:         string;
    totalLabelKey:      string;   // resolved via t(key, { count }) inside the wrapper
    closeLabel:         string;
    uploadLabel:        string;
    successDescription: string;
};
```

### 15.3 `<InternalTransferUploadDialog>` — canonical first consumer

[components/payment/internal-transfer/InternalTransferUploadDialog.tsx](../../../../components/payment/internal-transfer/InternalTransferUploadDialog.tsx) supplies only Internal-Transfer-specific configuration:

1. **8 columns** — `FINC_MDA_NO` (Recipient Account No.), `RCPT_NM` (Recipient Name), `TAR_BANK_CD` (Recipient Bank), `ANT_DIV_CD` (Transfer Network), `TRAN_AMT` (Amount), `TRAN_USAG` (Description), `DOC_NO` (Doc No.), `NOTE` (Note). Required flags on the first five; pixel widths configured per Figma; `TRAN_AMT` right-aligned. Labels resolved via `t("internal_transfer.upload.col.*")`.
2. **`handleParse(file)`** — calls `parseInternalTransferExcel(file, DEFAULT_BANK_CD)` from [lib/api/internalTransfer.ts](../../../../lib/api/internalTransfer.ts). Maps each returned `ApiParsedTransferLine` into an `ExcelUploadRow` via the `toUploadRow` mapper (splits `err_fld` comma-separated FIELD_IDs into a per-cell error flag set). Returns `{ rows, completedCount, errorCount }`.
3. **`handleUpload(file, parsed)`** — reverse-maps the previewed rows back into `ApiTransferLineInput[]` via the `rowToLine` mapper, builds the `ApiCreateScheduledTransferRequest` (with `DEFAULT_TITLE` / `DEFAULT_BANK_CD` / `DEFAULT_ACCT_NO` / `DEFAULT_CCY_CD` / `DEFAULT_TRNF_CCY_CD` placeholders until the Title + Withdrawal-account form lands), and calls `createScheduledTransfer(file, request)`. Returns the wire `{ scdul_pymn_no }` so the wrapper can pass it through to the parent's `onSaved`.
4. **Strings bag** — every key resolved via `t("internal_transfer.upload.*")` + `t("internal_transfer.dialog.save_success")`. Locale entries land in `locales/{en,ko,vi}.json` per the i18n rule.

### 15.4 Sibling Payment types — how Vendor / Expense / Payroll / Overseas mirror this

Each of the four remaining Payment types lands its own thin wrapper file under `components/payment/{type}/{Type}UploadDialog.tsx`. The shape is identical to `<InternalTransferUploadDialog>`:

- Supply the per-type column set (column FIELD_IDs match each type's JEX upload template — Vendor uses recipient-bank-account + vendor-code; Expense uses expense-account + description; Payroll uses employee-id + salary breakdown columns; Overseas uses SWIFT BIC + correspondent-bank columns).
- Supply `handleParse` calling the type's own parse endpoint (`/api/v1/payment/vendor-payment/uploads/parse`, `/api/v1/payment/expense-payment/uploads/parse`, etc.).
- Supply `handleUpload` calling the type's own create endpoint.
- Supply the type's i18n key bag (`vendor_payment.upload.*`, `expense_payment.upload.*`, etc.).

The `<PaymentExcelUploadDialog>` shared wrapper does NOT change between consumers. Adding a new Payment type is purely additive — one new file under `components/payment/{type}/`, no changes to `components/payment/shared/PaymentExcelUploadDialog.tsx` and no changes to `components/shared/excel-upload/ExcelUploadDialog.tsx`.

### 15.5 What the per-type wrapper does NOT include

Some flow-specific concerns are intentionally NOT bundled into the shared wrapper:

- **Title input** — the JEX `pymn_0009_002` popup shows a Title text field above the file pane. The Internal Transfer thin wrapper currently hard-codes `DEFAULT_TITLE` until the Phase B form lands. When the title input is added, it goes in the **per-type wrapper's body region** (rendered above the `<PaymentExcelUploadDialog>` call site), NOT extracted into the shared wrapper — every Payment type's title rules differ (Internal Transfer uses a free-text title; Vendor Payment derives the title from the recipient batch; Payroll uses the payroll period; etc.).
- **Withdrawal-account picker** — same rule. JEX `pymn_0009_002` shows a withdrawal-bank + account picker above the file pane. The shared `<WithdrawalAccountPicker>` (planned for a Phase B follow-up MR per § 8 above) is the cross-feature primitive; per-type wrappers render it themselves with type-specific filtering (e.g. Internal Transfer allows VND/USD/KRW accounts; Overseas Payment restricts to FCY-capable accounts).
- **Template-download URL** — the optional `onDownload` prop on `<PaymentExcelUploadDialog>` is passed through to the shared shell's Download button. The actual template URL is per-type and lands in a follow-up MR when the backend `/uploads/template` endpoint set is wired. For Phase A, omitting `onDownload` renders an inert Download button (matches the Chart-of-Accounts precedent).

### 15.6 i18n keys added (`internal_transfer.upload.*`)

Per the locale-coverage rule (EN + KO + VI; no `km.json`). Keys appended to [locales/en.json](../../../../locales/en.json), [locales/ko.json](../../../../locales/ko.json), [locales/vi.json](../../../../locales/vi.json):

```
internal_transfer.upload.title                — "Upload Internal Transfer"
internal_transfer.upload.step1_title          — "Step 1 — Download template"
internal_transfer.upload.step1_description    — "Download the Excel template."
internal_transfer.upload.download             — "Download"
internal_transfer.upload.step2_title          — "Step 2 — Upload file"
internal_transfer.upload.step2_description    — "Select your filled-in template."
internal_transfer.upload.re_select            — "Re-Select"
internal_transfer.upload.completed            — "Completed"
internal_transfer.upload.error                — "Error"
internal_transfer.upload.total_transactions   — "Total: {count} transactions"
internal_transfer.upload.close                — "Close"
internal_transfer.upload.upload               — "Upload"
internal_transfer.upload.col.finc_mda_no      — "Recipient Account No."
internal_transfer.upload.col.rcpt_nm          — "Recipient Name"
internal_transfer.upload.col.tar_bank_cd      — "Recipient Bank"
internal_transfer.upload.col.ant_div_cd       — "Transfer Network"
internal_transfer.upload.col.tran_amt         — "Amount"
internal_transfer.upload.col.tran_usag        — "Description"
internal_transfer.upload.col.doc_no           — "Doc No."
internal_transfer.upload.col.note             — "Note"
internal_transfer.dialog.save_success         — "Scheduled transfer saved."
dialog.error_generic                          — "An unexpected error occurred."  (shared fallback)
```

Sibling Payment types reuse the same key-name shape under their own prefix (`vendor_payment.upload.title`, `expense_payment.upload.col.*`, etc.) so the wrapper-strings-bag at the call site reads identically across all five payment types.

### 15.7 Files shipped in this MR (Excel-upload slice)

| File | Purpose |
|---|---|
| [components/payment/shared/PaymentExcelUploadDialog.tsx](../../../../components/payment/shared/PaymentExcelUploadDialog.tsx) | **NEW** — Payment-module shared wrapper. Owns parse/save state, error funnel, success-dialog flow, `stackLevel=1` default. |
| [components/payment/internal-transfer/InternalTransferUploadDialog.tsx](../../../../components/payment/internal-transfer/InternalTransferUploadDialog.tsx) | **NEW** — Internal-Transfer thin wrapper. 8 columns, parse + save endpoints, wire ↔ preview row mappers, `DEFAULT_*` constants for Phase B form fields. |
| [locales/en.json](../../../../locales/en.json) · [locales/ko.json](../../../../locales/ko.json) · [locales/vi.json](../../../../locales/vi.json) | `internal_transfer.upload.*` + `internal_transfer.dialog.save_success` + shared `dialog.error_generic` entries. |

### 15.8 Verification

- `npx tsc --noEmit` — passes on every new file. (Same 4 pre-existing TS errors in `components/banking/account-inquiry-fcy/mockData.ts` remain — unrelated to this MR.)
- `npx eslint` on every new file — passes (no errors, no warnings).
- Wiring the dialog into `<ScheduledTransferPage>`'s toolbar `Excel Upload` button is the Phase B step (deferred per § 14.4) — `<InternalTransferUploadDialog>` is ready to compose; the parent page just opens it on the Excel-Upload click.

## 16. Shared with siblings

The four Payment sub-modules (`internal-transfer`, `vendor-payment`, `expense-payment`, `payroll`) consume the same shared shells under [`components/payment/shared/`](../../../../components/payment/shared). Per-sibling components must not fork these — extend behaviour via props, not by copy-paste.

### 16.1 Shared shells consumed by every sibling

| Shared component | What it owns | Internal Transfer caller | Sibling-driven props |
|---|---|---|---|
| [`<PaymentScheduledBatchListPage>`](../../../../components/payment/shared/PaymentScheduledBatchListPage.tsx) | Scheduled batch list chrome — toolbar, search, period dropdown, approval-status dropdown, table + sortable headers, sticky pagination, View Setting popover. Generic over `Row extends PaymentScheduledBatchRow`. | [`<ScheduledTransferPage>`](../../../../components/payment/internal-transfer/ScheduledTransferPage.tsx) | `title`, `rows`, `rowDetailHref`, `totals` (CurrencyTotal[]), `onExcelUpload`, `onRequestApproval`, `onTransferRow`, `onDeleteRow`, `onDownloadRow`, `viewSettingItems`, `pagination`, `sort`, `period`, `apprType` filter options. Vendor/Expense override only the row shape + `totals` (currency totals) + the row-action callbacks. Payroll same. |
| [`<PaymentResultBatchListPage>`](../../../../components/payment/shared/PaymentResultBatchListPage.tsx) | Result batch list chrome — read-only variant. Generic over `Row extends PaymentResultBatchRow`. | [`<TransferResultPage>`](../../../../components/payment/internal-transfer/TransferResultPage.tsx) | Same prop shape minus mutating callbacks; adds `statusFilter` + `extraColumns`. **Internal Transfer omits `totals`** (Figma 1:11730 — paginationOnly variant); Vendor/Expense/Payroll all pass `totals`. |
| [`<PaymentDetailPage>`](../../../../components/payment/shared/PaymentDetailPage.tsx) | Detail page chrome — back link, master summary section, file card, scrollable line-item table. Generic over `Row extends { id: string }`. | [`<ScheduledTransferDetailPage>`](../../../../components/payment/internal-transfer/ScheduledTransferDetailPage.tsx) | `listTitle`, `subtitle`, `backHref`, `summary` (DetailSummaryField[]), `file`, `columns`, `rows`, `minWidth`, `aboveTable` (for the per-feature CTA strip), `onExcelExport`. Siblings drive `columns` + `summary` shape per their column set. |
| [`<ResultDetailView>`](../../../../components/payment/shared/ResultDetailView.tsx) | Result detail chrome — read-only twin of `<PaymentDetailPage>`. | [`<TransferResultDetailPage>`](../../../../components/payment/internal-transfer/TransferResultDetailPage.tsx) | Same shape; the `columns` prop defaults to the 11-column canonical `resultDetailColumns` from [detailColumns.tsx](../../../../components/payment/shared/detailColumns.tsx). **Payroll passes a different 5-column set** per Figma. |
| [`<PaymentExcelUploadDialog>`](../../../../components/payment/shared/PaymentExcelUploadDialog.tsx) | Payment-module shared Excel upload wrapper. Owns parse/save state, error funnel, success-dialog flow, `stackLevel=1`. | [`<InternalTransferUploadDialog>`](../../../../components/payment/internal-transfer/InternalTransferUploadDialog.tsx) | Per-sibling `columns` + `onParse` + `onUpload` + `strings` bag + optional `onDownload` + optional `extraStep`. **Internal Transfer's wrapper supplies an `extraStep` for the withdrawal-account dropdown above the file pane**; siblings supply their own equivalent (e.g. Payroll's payroll-period selector). |
| [`<RequestApprovalDialog>`](../../../../components/payment/shared/RequestApprovalDialog.tsx) | Approval-request confirmation dialog. Cross-feature shell. | (called from `<ScheduledTransferPage>`'s `onRequestApproval` callback) | `kind` (per-sibling), `selectedRows`, handlers. |
| [`<ApprovalDetailsDialog>`](../../../../components/payment/shared/ApprovalDetailsDialog.tsx) | Approval-details (approve / reject) confirmation dialog. Cross-feature shell. | (called from detail page's approval CTAs) | `kind`, `status`, `documentNo`, approvers list, attachments. |
| [`<WithdrawalAccountDropdown>`](../../../../components/payment/shared/WithdrawalAccountDropdown.tsx) | Withdrawal-account picker (consumed by every upload dialog). | `<InternalTransferUploadDialog>`'s `extraStep` content | `accounts`, `value`, `onChange`, `ccyFilter`. |
| [`<PaymentPeriodDropdown>`](../../../../components/payment/shared/PaymentPeriodDropdown.tsx) | "Last 7 days / This month / Custom" period picker. | List pages' `period` / `manualRange` props | shared across all four siblings. |
| [`<PaymentResultBadge>`](../../../../components/payment/shared/PaymentResultBadge.tsx) | Result-status pill resolved from `proc_stat_key`. | result-detail row column | shared. |
| [`<FileCard>`](../../../../components/payment/shared/FileCard.tsx), [`<DetailHeader>`](../../../../components/payment/shared/DetailHeader.tsx), [`<DetailSummary>`](../../../../components/payment/shared/DetailSummary.tsx), [`<DetailStatusTabs>`](../../../../components/payment/shared/DetailStatusTabs.tsx) | Detail page primitives (file card, header, summary section, status tabs) | composed inside `<PaymentDetailPage>` / `<ResultDetailView>` | shared. |
| [`detailColumns.tsx`](../../../../components/payment/shared/detailColumns.tsx) `resultDetailColumns` | Canonical 11-column result-detail column set | default columns for `<ResultDetailView>` | Payroll overrides with a 5-column variant; the others use the default. |
| [`deriveResultStatus.ts`](../../../../components/payment/shared/deriveResultStatus.ts) | Pure function — maps `(proc_stat, rs_cd)` → status pill key | every result row mapper | shared. |
| [`mockHelpers.ts`](../../../../components/payment/shared/mockHelpers.ts), [`types.ts`](../../../../components/payment/shared/types.ts) | Shared mock-data helpers + cross-sibling row types | static-UI fallback during Phase B | shared. |

### 16.2 Typography conformance (verified for `components/payment/internal-transfer/`)

Audit performed 2026-05-21 against the feature folder — searched for forbidden inline-typography patterns:

- `text-\[…\]` — **0 matches**
- `font-\[…\]` — **0 matches**
- `fontFamily` (any casing) — **0 matches**
- `style={{ font… }}` — **0 matches**

The feature folder is clean against the workspace [CLAUDE.md "Tailwind mapping"](../../../../CLAUDE.md) typography rule. Page titles use `text-page-title`, section titles use `text-section-title`, body cells use `text-base`, etc. Any future regression goes into the parity checklist (§F).

### 16.3 Hooks (as-implemented)

The earlier template referenced per-feature TanStack-style hooks (`useScheduledTransferList`, `useDispatchScheduledTransfer`, etc.). These hooks **do not exist as named files** — `wecms-web/CLAUDE.md` explicitly lists `react-query` / `swr` under "Explicitly NOT used". The actual pattern:

- Page calls an API-client function from [`lib/api/internalTransfer.ts`](../../../../lib/api/internalTransfer.ts) — `fetchScheduledTransferList`, `parseInternalTransferExcel`, `createScheduledTransfer`, `submitInternalTransferApproval`, etc.
- The page wraps the call in [`useApiData`](../../../../lib/api/useApiData.ts) (shared hook) for the read path.
- Mutations call the API function directly inside an `async` event handler; success / failure flow through `useDialog()`.

Phase B rewiring will keep the same pattern.

### 16.4 i18n key inventory (Internal Transfer namespace)

Verified entries in `locales/en.json` (KO / VI carry EN verbatim until verified translations land per the existing precedent; KM intentionally omitted):

```
approval.type.internal_transfer
settings.users.menu.payment.internal_transfer

internal_transfer.error.cutoff_past
internal_transfer.error.cutoff_before
internal_transfer.error.weekend_blocked
internal_transfer.error.appr_locked
internal_transfer.error.dispatch_not_approved
internal_transfer.error.already_dispatched

internal_transfer.upload.title
internal_transfer.upload.step1_title       internal_transfer.upload.step1_description
internal_transfer.upload.download
internal_transfer.upload.step2_title       internal_transfer.upload.step2_description
internal_transfer.upload.re_select
internal_transfer.upload.completed         internal_transfer.upload.error
internal_transfer.upload.total_transactions
internal_transfer.upload.close             internal_transfer.upload.upload
internal_transfer.upload.withdrawal_title  internal_transfer.upload.withdrawal_description
internal_transfer.upload.withdrawal_empty
internal_transfer.upload.col.bank_code     internal_transfer.upload.col.deposit_no
internal_transfer.upload.col.bank          internal_transfer.upload.col.transfer_amount
internal_transfer.upload.col.transfer_currency
internal_transfer.upload.col.remarks       internal_transfer.upload.col.reporting_account
internal_transfer.upload.col.description   internal_transfer.upload.col.document_no
internal_transfer.upload.col.recipient_name

internal_transfer.dialog.save_success
```

Shared cross-sibling keys reused by Internal Transfer (and every other Payment sibling):

```
payment.appr_stts.{draft,pending,in_progress,approved,rejected,cancelled}
payment.proc_stat.{pending,in_progress,success,failed,cancelled,transfer_pending}
```

Phase B will add `internal_transfer.title`, `internal_transfer.detail.title`, `internal_transfer.result.title`, `internal_transfer.result_detail.title`, `internal_transfer.column.*`, `internal_transfer.action.*`, `internal_transfer.dialog.*`, `internal_transfer.validation.*` when the pages rewire to live data.

---

Last verified: 2026-05-21
