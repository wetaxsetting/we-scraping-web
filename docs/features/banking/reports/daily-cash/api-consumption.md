# Daily Cash — API Consumption (Frontend)

How the Next.js page talks to the backend. Source: `lib/api/banking.ts`,
`components/banking/reports/daily-cash/DailyCashClient.tsx`.

---

## 1. Active endpoint

```
GET /api/v1/banking/reports/daily-cash-report?asOfDate=<YYYY-MM-DD>&currency=<ALL|VND|FCY>
```

- **Fetcher:** `fetchDailyCashReport({ asOfDate, currency })` (`lib/api/banking.ts`).
- **Envelope:** `unwrap(api.get<ApiResponse<ApiDailyCashReportResponse>>(...))` — JWT auto-attached,
  `status` envelope checked, throws `ApiCallError` on `status.error`.
- **Query params:**
  - `asOfDate` — ISO `YYYY-MM-DD`; the client's `asOfIsoDate` state, read at Search time.
  - `currency` — derived from the scope toggle by `toWireCurrency(scope)`: `ALL` → `"ALL"`,
    `VND` → `"VND"`, `FCY` → `"FCY"`.

---

## 2. Wire response shape (`ApiDailyCashReportResponse`)

Defined inline in `lib/api/banking.ts` — already lowercase snake_case (the new contract):

```jsonc
{
  "as_of_date": "2026-06-04",
  "currency": "ALL",
  "currency_summary": [
    { "currency_cd": "VND", "total_cash": 0, "total_demand_deposit": 0,
      "total_term_deposit": 0, "total_loan": 0, "total_savings": 0 }
  ],
  "accounts": [
    { "biz_key": "…", "last_collected_date": null, "ref_date": "20260604",
      "currency_cd": "VND", "acct_type_cd": "03", "bank_cd": "…", "bank_nm": "Vietcombank",
      "acct_no": "…", "balance": 0, "loan_name": null, "maturity_date": null,
      "agreement_amount": null, "send_count": 0, "send_amount": 0,
      "receive_count": 0, "receive_amount": 0 }
  ],
  "currency_flow": [
    { "currency_cd": "VND", "before_date_balance": 0, "balance": 0,
      "send_count": 0, "send_amount": 0, "receive_count": 0, "receive_amount": 0 }
  ]
}
```

> The backend contract is documented in
> [`wecms-api/.../daily-cash/interface-specification.md`](../../../../../../wecms-api/docs/features/banking/reports/daily-cash/interface-specification.md).

---

## 3. Wire → view mapping (local, in `DailyCashClient.tsx`)

Mapping is done **locally in the client component**, not in `lib/api/mappers.ts`:

| View row | Mapper | Key fields |
|---|---|---|
| `DailyCashSummaryRow` | `toSummaryRow` | `current = total_demand_deposit`, `savings = total_savings`, `available = total_demand_deposit`, plus `cash` / `timeDeposit` / `loan`. |
| `DailyCashAccountRow` | `toAccountRow` | `id = bank_cd_acct_no`, `bank = bank_nm \|\| bank_cd`, `numDebits = send_count`, `debit = send_amount`, `numCredits = receive_count`, `credit = receive_amount`, `balance`, `currency = currency_cd`, plus raw `acct_type_cd` for the grid split. |

- **Summary fallback:** if `currency_summary` is empty, `rollupSummary(accounts)` groups by `currency_cd`
  and sums `balance` into `current` (03/04) / `savings` (05/06).
- **Grid split:** `isCurrentType` (03/04) → Current Accounts; `isSavingType` (05/06) → Savings Accounts;
  other types are dropped from both grids.
- **`currency_flow`** is present in the type but **not consumed** by the page (candidate for cleanup).

---

## 4. Currency-scope mapping

| Toggle (`scope`) | Wire `currency` | Backend filter (`DailyCashCurrencyFilter`) |
|---|---|---|
| All Currency | `ALL` | no currency predicate |
| FCY | `FCY` | every currency **except** the tenant local (`VND`) |
| VND | `VND` | exact `ccy_cd = 'VND'` |

The backend enum also accepts `USD` / `KHR` (exact pins) but the UI toggle exposes only All / FCY / VND.

---

## 5. Export

Export does **not** call the backend; both run off the already-fetched rows in `lib/dailyCashExport.ts`:

- Excel → `xlsx-js-style` workbook (`exportDailyCashExcel`).
- Print → standalone HTML via hidden iframe (`printDailyCashReport`).

> A wired backend single-producer export exists
> (`POST /api/v1/banking/reports/daily-cash-report/export`, `DailyCashReportExportProvider`) but the UI
> does not use it — the open technical-debt item (backend gap #2 / fix-plan #4). When adopted, the page
> would `POST` the `ExcelExportRequest` shape and save the returned XLSX blob, dropping `xlsx-js-style`.

---

## 6. Dead legacy API surface (not used by this page)

- `fetchDailyCash({ asOf, currencyScope })` → `GET /api/v1/banking/reports/daily-cash` returning the
  UPPER_SNAKE `ApiDailyCashReport` — **no live consumer**.
- `lib/types/api.ts` `ApiDailyCashSummaryRow` / `ApiDailyCashHoldingRow` /
  `ApiDailyCashAccountLedgerRow` / `ApiDailyCashReport` — Sprint-1 holdovers.
- `lib/api/mappers.ts` `mapDailyCashSummaryRow` / `mapDailyCashHoldingRow` / `mapDailyCashAccountRow` —
  not imported by the daily-cash components.

See [component-index.md](component-index.md) §5.
