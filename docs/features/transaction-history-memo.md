# Transaction History Memo — Frontend (wecms-web)

**Feature slug:** `transaction-history-memo` (paired with `wecms-api/docs/features/transaction-history-memo.md`)
**Screens:** Banking → Transaction History **VND** and **FCY**
**Legacy source of truth:** JEX `fnsh_0002_001` (VND), `fnsh_0006_001` (FCY)
**Status:** PLAN ONLY — not implemented. Awaiting PO confirmations (see Risks).
**Date:** 2026-07-07

## Related documents

- Runtime root-cause audit: [`docs/audits/transaction-history-memo-runtime-audit.md`](../../../docs/audits/transaction-history-memo-runtime-audit.md)
- Legacy memo API/WEB audit: [`wecms-web/docs/audits/memo-legacy-api-web-audit.md`](../audits/memo-legacy-api-web-audit.md)
- Reuse reference (Card Transactions memo): [`wecms-web/docs/features/payment/card-transactions.md`](payment/card-transactions.md)
- Backend counterpart: [`wecms-api/docs/features/transaction-history-memo.md`](../../../wecms-api/docs/features/transaction-history-memo.md)

---

## Goal

Add Memo support to Transaction History (VND & FCY) reusing the **existing Card Transactions memo UI** — the shared right-side `MemoDrawer`, the same icons/colors, the same add/edit/delete/color behavior, and the same author-only rule. **No duplicate memo UI.**

## Locked decisions

| Topic | Decision |
|---|---|
| Icon visibility | Memo icon shown **only on confirmed transactions**. Unconfirmed rows show only the **Confirm** button and no memo icon (matches live `_osmc_VN` runtime). Backend returns `memo_color`/`memo_count` for all rows; the **frontend gates rendering by `row.confirmed`**. |
| UI reuse | Reuse shared `components/shared/memo/MemoDrawer`; mirror the `CardMemoDrawer` container pattern. Do not build a second drawer. |
| Scope | VND and FCY use distinct backend `WEB_SVC_ID` (`/banking/transaction-history/vnd` / `/banking/transaction-history/fcy`); frontend passes its existing `scope` prop to the memo API. |
| Colors/assets | Reuse `/assets/memo/{fileG,fileB,fileY,fileW,fileR,fileP}.png` and the `WIRE_TO_SEMANTIC`/`SEMANTIC_TO_WIRE` maps unchanged. |

---

## Frontend design

### 1. Row model — `components/banking/transaction-history/types.ts` + `mappers.ts`

- Add to `TransactionRow`: `memoColor?: MemoColor | null`, `memoCount?: number` (mirrors `CardTransaction.memoColor/memoCount`).
- In `mappers.ts`: `memoColor: api.memo_color ?? null`, `memoCount: api.memo_count ?? 0`.
- Add `memo_color?: MemoColor | null`, `memo_count?: number` to `ApiTransactionRow` in `lib/types/api.ts`.

### 2. Memo icon — confirmed-gated, in the action column

- Render the icon inside the existing Confirm/Undo action column in `components/banking/transaction-history/TransactionTable.tsx` (currently the hardcoded action cell), **only when `row.confirmed === true`**.
- Unconfirmed rows keep just the `Confirm` button (no memo icon, no memo trigger element) — exact live parity.
- Icon source identical to Card: `/assets/memo/${memoCount > 0 && memoColor ? memoColor : "fileW"}.png`. Clicking opens the drawer for that transaction (`trnsSeqNo` = `ACCT_SEQ_NO`).

### 3. `TransactionMemoDrawer.tsx` (NEW) — thin container mirroring `CardMemoDrawer`

- Renders the **shared** `components/shared/memo/MemoDrawer` in controlled mode.
- Props: `acctSeqNo` (account slug), `trnsSeqNo`, `scope` (`"VND" | "FCY"`), `onClose`, `onChanged?`.
- Fetch via `useApiData(() => fetchTransactionMemos(acctSeqNo, trnsSeqNo, scope), [acctSeqNo, trnsSeqNo, scope, refreshKey])`.
- Reuse the same wire↔semantic color maps, row-color derivation (`rows[0].color`, `fileW`→`gray` default with optimistic override), CRUD handlers (add/edit/delete/color), and confirm/error dialogs (`useDialog`) as `CardMemoDrawer`.
- `onChanged` bumps an internal `refreshKey` (refetch drawer) and calls `onChanged?.()`.

### 4. Wiring — `TransactionHistoryClient.tsx` / `TransactionHistoryPage.tsx`

- Hold `memoTrnsSeqNo` state; table `onOpenMemo={(row) => setMemoTrnsSeqNo(row.trnsSeqNo)}`.
- Mount `<TransactionMemoDrawer acctSeqNo={realAcctSeqNo} trnsSeqNo={memoTrnsSeqNo} scope={scope} onClose=... onChanged={() => bumpListRefreshKey()} />`.
- Bump the list `refreshKey` on `onChanged` so the row icon color/count updates after any memo CRUD (same pattern as `CardTransactionsPage`).
- Works for both routes via the existing `scope` prop (`"VND"`/`"FCY"`).

### 5. API client — `lib/api/…` (transactions client)

Add memo functions targeting the backend endpoints (all under `/api/v1/banking/accounts/{acctSeqNo}/transactions/{trnsSeqNo}/memos`), passing `scope`:

- `fetchTransactionMemos(acctSeqNo, trnsSeqNo, scope)` → `MemoListResponse`
- `createTransactionMemo(acctSeqNo, trnsSeqNo, scope, { memo, color? })` → `MemoRow`
- `updateTransactionMemo(acctSeqNo, trnsSeqNo, scope, seqNo, { memo })` → `MemoRow`
- `updateTransactionMemoColor(acctSeqNo, trnsSeqNo, scope, { color })` → void
- `deleteTransactionMemo(acctSeqNo, trnsSeqNo, scope, seqNo)` → void

Reuse the existing `MemoRow`/`MemoListResponse`/`MemoColor` wire types; TH create/color requests omit `ref_no` (path-derived). Wire stays lowercase snake_case.

### Typography / styling

Reuse WeCMS tokens and the shared drawer styling as-is; no new font-family/size/weight. `MemoColor` = `green|blue|yellow|gray|pink|purple` (semantic) mapped to legacy `fileG|fileB|fileY|fileW|fileR|fileP` wire tokens.

---

## Reuse strategy from Card Transactions

| Card asset | Reuse for Transaction History |
|---|---|
| `components/shared/memo/MemoDrawer` (+ subcomponents) | **Reused as-is** — drawer UI not duplicated |
| `CardMemoDrawer.tsx` | **Pattern mirrored** into `TransactionMemoDrawer.tsx` (thin container, established pattern) |
| Color maps, `/assets/memo/*.png`, `MemoColor` union | Reused unchanged |
| `useApiData` fetch + `refreshKey` bump pattern | Reused |
| Confirm/error dialogs (`useDialog`) | Reused |
| Author-only edit/delete via `canEdit` on `MemoItem` | Reused (server enforces `WBE_MEMO_NOT_AUTHOR`; UI hides Edit/Delete when `canEdit === false`) |
| Icon rendering (`memoColor`/`memoCount` → `/assets/memo/{color}.png`) | Reused, with an added `row.confirmed` gate |

---

## Expected modified / created files (frontend)

- **NEW** `components/banking/transaction-history/TransactionMemoDrawer.tsx`
- **EDIT** `components/banking/transaction-history/types.ts` — add `memoColor`/`memoCount`
- **EDIT** `components/banking/transaction-history/mappers.ts` — map memo fields
- **EDIT** `components/banking/transaction-history/TransactionTable.tsx` — confirmed-gated memo icon in action column + `onOpenMemo`
- **EDIT** `components/banking/transaction-history/TransactionHistoryClient.tsx` — memo state, mount drawer, refreshKey, scope
- **EDIT** `components/banking/transaction-history/TransactionHistoryPage.tsx` — pass through memo handlers/props
- **EDIT** `lib/api/…` (transactions API client) — memo functions
- **EDIT** `lib/types/api.ts` — `ApiTransactionRow.memo_color/memo_count`; TH request types

No new shared component. `MemoDrawer` and its subcomponents are untouched.

---

## Risks & required PO confirmations

- **R1 — shared backend service (approved).** Backend extracts `common/memo/MemoService` and migrates Card to delegate, keeping Card behavior 100% unchanged. No frontend impact for Card; verify Card Transactions memo still works after the shared-service change.
- **R2 — modern `WEB_SVC_ID` hides existing legacy memos.** Because the refactor uses `/banking/transaction-history/vnd|fcy` while the ~3,342 (VND) / ~3,341 (FCY) legacy memos are stored under `fnsh_0002_001`/`fnsh_0006_001`, **existing legacy memos will NOT appear on the refactor screen** and refactor-created memos will not appear on the live legacy screen. **No migration unless PO/DBA approves.** Product must accept this or approve a migration (backend doc R2).
- **R3 — scope passed explicitly.** Frontend must send `scope` (VND/FCY) to the memo API so the backend picks the correct `WEB_SVC_ID`; keeps VND/FCY threads separate.
- **R5 — no regression.** Adding the icon + drawer must not alter existing Transaction History behavior (status tabs, matching pickers, confirm/undo, Smart Organizer, export) for either VND or FCY.

---

## Final implementation checklist (frontend)

- [ ] PO sign-off obtained on R2 (modern `WEB_SVC_ID`, existing legacy memos not shown, no migration now).
- [ ] `TransactionRow` + `ApiTransactionRow` gain `memoColor`/`memoCount`; mapper wired.
- [ ] Memo icon rendered in the action column **only when `row.confirmed`**; unconfirmed rows unchanged (Confirm button only).
- [ ] Icon reuses `/assets/memo/{color}.png` + `fileW` default, identical to Card.
- [ ] `TransactionMemoDrawer.tsx` created, mirroring `CardMemoDrawer` and rendering shared `MemoDrawer`.
- [ ] Add / edit / delete / color-select behave identically to Card; author-only edit/delete honored (`canEdit`).
- [ ] Transactions API client memo functions added; `scope` passed on every call.
- [ ] List `refreshKey` bumps after memo CRUD so icon color/count updates.
- [ ] VND route shows memo icon on confirmed rows; FCY route shows memo icon on confirmed rows.
- [ ] No new drawer/component; shared `MemoDrawer` untouched.
- [ ] No regression to status tabs, pickers, confirm/undo, Smart Organizer, export (VND & FCY).
- [ ] `tsc` clean; wire format lowercase snake_case.
- [ ] Paired with backend checklist in `wecms-api/docs/features/transaction-history-memo.md`.
