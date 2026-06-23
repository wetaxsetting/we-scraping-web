# Corporate Card — Test Scenarios (Card Transactions, frontend)

## Status: FE tests MISSING (G-CARD-5)

No `.test.*` files exist for any Card Transactions component — the largest single coverage gap, consistent across all payment modules. Backend has 5 test files / 44 methods (see [`wecms-api/.../corporate-card/test-scenarios.md`](../../../../../wecms-api/docs/features/payment/corporate-card/test-scenarios.md)).

## Browser test plan (manual, for the MR)

1. Land on `/payment/corporate-card/card-transactions` as a tenant user with seeded data → dashboard hero + 15-row table render.
2. Toggle dashboard off → KPI row collapses, table unchanged.
3. Apply each filter (bank, card, link status, keyword, date preset) → URL stays clean, table re-fetches, page resets to 1.
4. Sort `TRSC_AMT` DESC → rows reorder, totals unchanged.
5. Reporting Account cell → picker (`stackLevel={1}`) → pick → PUT + refresh; × → DELETE clear.
6. Description cell → inline edit → blur → PATCH.
7. Purpose cell → code dropdown → PATCH.
8. Approval Ref badge → `ApprovalRefDetailDialog` with approver list (from `/by-approval`); kebab Withdraw + Change Line.
9. Memo icon → `MemoPanel` add/delete (delete restricted to author).
10. Manage Cards → activate / rename / delete (in-use → `WBE1153`); Add Card → scrape → select → create.
11. Update → `UpdateCardsDialog` session/challenge loop (QNA/OTP/CAPTCHA resume).
12. Request Approval (selected rows) → multipart submit with + without attachments.
13. Link Card Payments → e-Invoice + Receipt tabs → link (sum must equal amount → `WBE_LINK_AMOUNT_MISMATCH` otherwise) → unlink; New Receipt create.
14. Excel export → streamed XLSX opens with expected columns + subheader; Print → popup report.
15. HAENGSUNG user (`productType === "H"`) → `table2` columns render.
16. Error path (disconnect) → `<SystemDialog type="error">` with code + traceId.

## Recommended automated baseline (dev)

- `cardTransactionMappers` unit tests: wire→in-memory mapping; `approvers[]` always empty; `using_type`/`auth_code`/`city`/`note` carried through; display-name resolution from chart-tree + purpose-options keyed by raw codes; NO invented fields consumed.
- `CardTransactionsPage` integration: fetch/refresh, filter→page-1 reset, inline-edit PATCH, dialog stacking/close behaviour.
