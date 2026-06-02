# Payment — Frontend Feature Docs

Per-screen Next.js design docs for the **Payment** top-menu module. Mirrors the WeCMS Payment menu.

## Menu → folder/file map

| WeCMS Payment menu item | Doc | Notes |
|---|---|---|
| Approval Management → Approval Box | [approval-box.md](approval-box.md) | Tabbed feature-page baseline |
| Internal Transfer | [internal-transfer/](internal-transfer/) | Scheduled Transfer · Transfer Result (+ details) |
| Vendor Payment | [vendor-payment/](vendor-payment/) | Scheduled Payment · Payment Result (+ details) |
| Expense Payment | [expense-payment/](expense-payment/) | Scheduled Payment · Payment Result (+ details) |
| Payroll | [payroll/](payroll/) | Scheduled Payment · Payment Result (+ details) |
| Overseas Payment | [overseas-payment/](overseas-payment/) | Scheduled Payment · Payment Result (+ details) |
| Add-on → Exchange Rate Inquiry | [exchange-rate-inquiry.md](exchange-rate-inquiry.md) | Figma-specific currency-matrix UI |
| Corporate Card → Card Transactions | [card-transactions.md](card-transactions.md) | List-only (Sprint 2) |

Each batch-file group (Internal Transfer, Vendor, Expense, Payroll, Overseas) has a **Scheduled** list, a **Result** list, and per-row **detail** pages. See each subfolder README for the screen/route/detail breakdown.

## Routes

`/payment/approval-box` (working) · `/payment/{internal-transfer,vendor-payment,expense-payment,payroll,overseas-payment}/{scheduled-*,*-result}` (+ `[id]` detail) · `/payment/exchange-rate-inquiry` · `/payment/card-transactions`

## Related components

- [`components/payment/approval-box/`](../../../components/payment/approval-box/) — tabbed baseline (`ApprovalBoxPage`)
- [`components/payment/shared/`](../../../components/payment/shared/) — `PaymentScheduledBatchListPage`, `PaymentResultBatchListPage`, `PaymentDetailPage`, `ResultDetailView` (shared across all 5 modules)
- Per-module folders under [`components/payment/`](../../../components/payment/)

Pagination / totals / detail rules: wecms-web/CLAUDE.md §12 + §12a.

## Related backend docs

[`../../../../wecms-api/docs/features/payment/`](../../../../wecms-api/docs/features/payment/) · [`../../../../wecms-api/docs/api-spec/`](../../../../wecms-api/docs/references/api-spec/) · [`../../../../wecms-api/docs/database/payment/`](../../../../wecms-api/docs/references/database/payment/)
