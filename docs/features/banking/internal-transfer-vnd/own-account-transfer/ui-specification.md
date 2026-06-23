# Own Account Transfer — UI Specification (Frontend)

Filters, grid, actions, dialogs, and state handling for the shipped screen. Component inventory:
[component-index.md](component-index.md). Backend functional spec:
[functional-specification.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/functional-specification.md).

---

## 1. Search conditions / filters

| Filter | Control | Behaviour |
|---|---|---|
| Bank | Single-select popover ("All Banks" + `allowed_bank_cds`) | `handleBankSelect` sets `bankCd`, resets pagination, clears target cache. Fallback names in `OAT_BANK_NAMES`. |
| Sort | Per-column cycle (default → ASC → DESC → default) | Shared `useTableSort()`; sent as `sortField`/`sortDirection`; backend whitelist resolves. Sortable: BANK_CD, ACCT_NICK_NM, BAL, AVI_BAL. |
| Columns | View Setting popover (list icon) | `useViewSetting("own-account-transfer", "default")`; locked: BANK_CD, ETC. |

No date filter, no status filter, no currency filter, no keyword search — currency is fixed VND and the list is the tenant's own accounts.

## 2. Grid columns (`source-accounts-columns.tsx`)

| FIELD_ID | Header (i18n) | Width | Align | Sort | Cell |
|---|---|---|---|---|---|
| `BANK_CD` | `own_account_transfer.col.bank` | 260px | left | Y | Bank name + currency (VND • Current) + account-no sub-line |
| `ACCT_NICK_NM` | `own_account_transfer.col.nickname` | 260px | left | Y | Nickname (blank when null) |
| `BAL` | `own_account_transfer.col.balance` | 160px | right | Y | `formatAmount(balance, "VND", true)` |
| `AVI_BAL` | `own_account_transfer.col.available` | 160px | right | Y | Available (`real_amt`; defaults to balance) |
| `ACCT_BAL_LST_STS` | `own_account_transfer.col.last_refresh` | 180px | left | N | Status badge + datetime (§3) |
| `ETC` | `own_account_transfer.col.action` | 140px | right | N | Per-row **Transfer** button (§4) |

Amount/currency formatting via [`lib/currency.ts`](../../../../../lib/currency.ts) `formatAmount(value, "VND", includeSymbol)`. Footer shows total accounts, Σ balance, Σ available via `SourceAccountsTableFooter`.

## 3. "Last Refresh" display rules (`<LastRefreshCell>`)

| Data state | Display |
|---|---|
| status `"00000000"` + datetime | green **Success** (`text-wb-status-approved-text`) + formatted datetime |
| non-success status + datetime | red **Failed** (`text-wb-status-rejected-text`) + formatted datetime |
| non-success status, no datetime | red **Failed** (no time) |
| no status + no datetime | blank cell |

Success derived from `isEngineStatusSuccess(stts)` (`stts === "00000000"`) in `mappers.ts`. Datetime via `lib/datetime.ts`.

## 4. Transfer actions (`<TransferActionCell>`)

The per-row **Transfer** button (ETC column) is enabled only when all hold:
`row.canTransfer === true` **AND** engine `status === "ready"` **AND** `banksWithCredentials.has(row.bankCd)`.
Clicking opens `<OwnAccountTransferComposerDialog>` (see [screen-flow.md §4](screen-flow.md)).

Other actions: **Update Balance** (deferred, OQ-FE-1), **bank filter**, **column sort**, **View Setting**. There is no
Create / Edit / Delete in the CRUD sense — a transfer is recorded once and is immutable.

## 5. Dialogs

| Dialog | Purpose | Stack |
|---|---|---|
| `<OwnAccountTransferComposerDialog>` | Compose + execute transfer | feature dialog (shadcn `<Dialog>`) |
| `<TransferConfirmationDialog>` | Bank-driven confirmation (engine-rendered) | bridged |
| `<OtpAuthDialog>` | OTP / 2nd-factor entry | bridged |
| `<EngineNotInstalledDialog>` / `<EngineUnsupportedOsDialog>` | Engine availability | feature dialog |
| Success / error feedback | `useDialog()` (`type: "success"` / `"error"`) | `z-[100]` system layer |

Engine challenges (OTP / QnA / Confirm / system messages) are detected by `lib/nxisas/*-bridge.ts` and surfaced through the shared dialogs — never a bespoke per-page modal.

## 6. Loading / empty / error handling

- **Loading** — `use-own-account-transfer` exposes `loading`; the page uses a sticky-loading gate so the table doesn't flash empty between filter/sort changes.
- **Empty** — `sources.length === 0 && !loading` → "no data" copy (`own_account_transfer.empty.no_data`).
- **Error** — API failures map to `{ code, message }`; the page surfaces them via `useDialog().open({ type: "error", errorCode })`. 401s handled by the global Axios interceptor.
- **Retry** — `reload()` re-fetches the source list (also called after a successful transfer or balance update); engine `retry()` re-runs the bundle load + probe.
- **No client-side reorder** — sorting is DB-side; the page never `Array.sort`s the fetched rows.

## 7. Typography / tokens

All text uses the shared `text-wb-*` tokens; amounts via `formatAmount`; status badges via `wb-status-*` tokens.
No inline `text-[Npx]` / `style={{…}}`. i18n namespace `own_account_transfer.*` (EN/KO/VI present).
