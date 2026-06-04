# Cash Flow — API Consumption (Frontend)

How the page talks to `wecms-api`. Backed by `lib/api/banking.ts`, `lib/api/mappers.ts`, and
`CashFlowClient.tsx`. Backend contract: [wecms-api interface-specification](../../../../../../wecms-api/docs/features/banking/reports/cash-flow/interface-specification.md).

---

## 1. Endpoints consumed

| Purpose | Call | Endpoint |
|---|---|---|
| Cash-flow data | `fetchCashFlow(params)` | `GET /api/v1/banking/reports/cash-flow-report` |
| Excel export | `exportExcel({...})` | `POST /api/v1/banking/reports/cash-flow-report/export` |
| Rate prefill | `fetchExchangeRates()` | `GET /api/v1/banking/exchange-rates` |
| Bank options | `fetchAccounts()` | `GET /api/v1/banking/accounts` |

> Note the endpoint is `/cash-flow-report` (with the `-report` suffix), **not** `/cash-flow`. The
> `wecms-web/CLAUDE.md` API table's `/banking/reports/cash-flow` "stub … falls back to mock" row is
> stale — see §5.

---

## 2. Search request

```ts
// CashFlowQueryParams — lib/api/banking.ts  (NO quarter field)
fetchCashFlow({
  year:         filters.year,
  baseCurrency: filters.baseCurrency,            // "VND" | "USD" | "KRW"
  usdRate:      filters.usdRate || null,
  krwRate:      filters.krwRate || null,
  bankFilters:  filters.bankFilters.map(b => ({ bankCd: b.bankCd, accountNo: b.acctNo })),
});
// → GET …/cash-flow-report?year=2025&baseCurrency=VND&usdRate=26000&krwRate=19&bankFilters=<json>
```

- `usdRate` / `krwRate` are added to the query **only when non-null/non-empty**.
- `bankFilters` is JSON-stringified into the `bankFilters` query param **only when non-empty**.
- **`quarter` is never sent** — the calc endpoint always returns full Jan–Dec; quarter is client-side
  column visibility only (`monthIndicesForQuarter`). This is the load-bearing parity rule (G5/D-1).

---

## 3. Wire → view mapping

`mapCashFlowReport(data)` (`lib/api/mappers.ts` ~line 561):

| Wire (`ApiCashFlowRow`, snake_case) | View (`CashFlowRow`, camelCase) |
|---|---|
| `display_order` | `displayOrder` |
| `display_cd` | `displayCd` |
| `display_nm` | `displayNm` |
| `item_cd` | `itemCd` |
| `item_nm` | `itemNm` |
| `row_type` | `rowType` |
| `group_cd` | `groupCd` |
| `parent_l2_cd` | `parentL2Cd` |
| `display_currency` | `displayCurrency` |
| `monthly.{jan..dec}` | `monthly.{jan..dec}` (via `mapCashFlowMonthly` + `toStr`) |
| `annual_total` | `annualTotal` (`toStr`) |

Report-level: `base_currency ?? "VND"`, `usd_rate`/`krw_rate` via `toStr`, `rows ?? []`. String fields
default to `""`. The frontend then re-derives the visual hierarchy from the flat rows via `groupReport`
(see [ui-specification.md §2](ui-specification.md)).

---

## 4. Export request

```ts
exportExcel({
  endpoint: "/api/v1/banking/reports/cash-flow-report/export",
  screenId: SCREEN_IDS.CASH_FLOW_REPORT,   // "cash-flow-report"
  dymAreaId: DEFAULT_AREA_ID,              // "default"
  fileName: `CashFlow_${DDMMYYYY}`,
  title:    t("report.cash_flow.title"),
  columns:  buildExportColumns(t, baseCcy),  // DISP_CD, DISP_NM, ITEM_CD, ITEM_NM, ROW_TYPE,
                                             // JAN_AMT..DEC_AMT (format:"amount", ccy=baseCcy), TOTAL_AMT, DISP_CCY_CD
  filters: {
    year, quarter: quarter ?? "", baseCurrency, usdRate, krwRate,
    bankFilters: JSON.stringify(bankFilters.map(b => ({ bankCd: b.bankCd, accountNo: b.acctNo }))),
  },
});
```

- The export **does** send `quarter` in `filters` (unlike the calc fetch), but the backend always emits
  all 12 month columns.
- Filter keys here are **camelCase** inside the otherwise snake_case API (parity audit N6) — harmless.
- The backend reuses the same `service.search(...)` and streams the workbook via `CashFlowExcelWriter`
  (frontend never builds the file — wecms-web §13b).

---

## 5. Live-wiring confirmation & doc-staleness

**The page is fully wired to the live backend with no mock fallback.** Decisive evidence:

- `CashFlowClient` renders `report = mapCashFlowReport(data)` straight from `useApiData(loader,
  [searchKey])`. There is no `mockCashFlowReport` import anywhere in `CashFlowClient.tsx` /
  `CashFlowPage.tsx`.
- `mockData.ts` (`mockCashFlowReport`) is **dead code** — a workspace grep finds only its own definition.
- On backend error/empty, `useApiData` sets `data:null` → `report=undefined` → `buildEmptyReport(...)`
  renders an empty matrix, **never** the seed.

**Stale doc lines to fix when those files are next touched:**

- `wecms-web/CLAUDE.md` API table: `/api/v1/banking/reports/cash-flow` → "Stub backend, falls back to
  mock". Reality: endpoint is `/cash-flow-report`, fully wired, no mock.
- `wecms-web/CLAUDE.md` "Holdovers (still UPPER_SNAKE)": lists `ApiCashFlowReport`. Reality: the wire row
  is lowercase snake_case (`display_cd`, `row_type`, `annual_total`, `monthly.jan` …).

---

## 6. Error handling

All calls go through `api` (Axios + JWT interceptor), unwrap the `{ status, data }` envelope, and throw
`ApiCallError` carrying `status.code` + `trace_id`. `handleExport` swallows `WBE1401` and routes other
codes to `useDialog().open({ type: "error", … })`. 401s are handled globally by the session-expired
interceptor in `lib/axios.ts`. Missing FX rates degrade to the static defaults (26000/19) — graceful
(parity audit N5).
