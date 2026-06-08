# Smart Organizer — Component Index (Frontend)

File-by-file map. All paths relative to `wecms-web/`.

---

## 1. Route (App Router)

| File | Renders |
|---|---|
| `app/(dashboard)/banking/smart-organizer/page.tsx` | `<SmartOrganizerPage />` — `metadata.title = "Smart Organizer — WeCMS"`; auth guard + `<AppShell>` inherited from `(dashboard)` layout |

Account context is **not** a route param — it is the `?account={bankCd}_{acctNo}` query string parsed
client-side inside `SmartOrganizerPage`.

## 2. Components (`components/banking/smart-organizer/`)

| Component | Role |
|---|---|
| `SmartOrganizerPage.tsx` | The page. Parses `?account=`, owns date-range / search / sort / pagination / selection / refreshKey state, the `fetchEligibleTransactions` effect, and the `confirmEligibleTransactions` handler. Renders header, filter row, two-section grid, selection footer, pagination, empty state. |
| `OrganizerSettingsDialog.tsx` | Rule-CRUD popup (legacy `fnsh_0200_002`). View/Edit modes; draft array with `isNew`/`isDeleted` flags; Save issues DELETE → POST → PUT and recomputes `disp_ord`. Props `{ onClose, onChanged }`. |

## 3. Related component (different feature, same name)

| Component | Home | Role |
|---|---|---|
| `SmartOrganizerButton.tsx` | `components/banking/transaction-history/` | Toolbar `Link` → `/banking/smart-organizer?account=…`. Props `{ account, className? }`. |
| `SmartOrganizerDialog.tsx` | `components/banking/transaction-history/` | **Payment-match** popup (legacy `comm_0196_001`) — matches one bank txn to a scheduled payment. **Not** the Organizer Settings dialog. Uses `lib/api/banking.ts` (`fetchMatchCandidates`/`createMatch`/`undoMatch`), not `lib/api/smartOrganizer.ts`. |

## 4. Shared components consumed

`<InteractiveDateRangePicker>`, `<SearchInput>`, `<Pagination>` / `usePagination`, `<TableHeaderCell>`,
`<Checkbox>` (shadcn), `<FilterSelect>`, and the four pickers reused from Transaction History detail —
`<ReportingAccountSelect>`, `<PurposeSelect>`, `<VasAccountSelect>`, `<ContactSelect>` — plus their
option builders (`buildReportingAccountOptions`, `buildPurposeOptions`, `buildVasAccountOptions`,
`buildContactOptions`). Dialog/i18n via `useDialog()` / `useTranslation()`.

## 5. Hooks

| Hook | Home | Use |
|---|---|---|
| `useTableSort()` | `hooks/useTableSort` | header sort (`sortField`/`sortDirection`) |
| `usePagination<T>({ items })` | `components/shared/Pagination.tsx` | client-side paging |
| `useStickyLoading(flag)` | `hooks/useStickyLoading` | min-visibility gate for fetch/confirm |
| `useApiData(fetcher, deps)` | `lib/api/useApiData` | loads picker options in the settings dialog |
| `useDialog()` / `useTranslation()` | shared | dialogs / i18n |

There is **no** dedicated `useSmartOrganizer` hook — the data lifecycle is composed inline in
`SmartOrganizerPage` (no react-query/SWR, per the codebase convention).

## 6. API client + types (`lib/api/smartOrganizer.ts`)

| Function | Endpoint |
|---|---|
| `fetchEligibleTransactions(params)` | `GET /api/v1/banking/smart-organizer/eligible` |
| `confirmEligibleTransactions(body)` | `POST …/confirm` |
| `fetchOrganizerRules()` | `GET …/rules` |
| `createOrganizerRule(body)` | `POST …/rules` |
| `updateOrganizerRule(rmrkSeqNo, body)` | `PUT …/rules/{rmrk_seq_no}` |
| `deleteOrganizerRule(rmrkSeqNo)` | `DELETE …/rules/{rmrk_seq_no}` |
| `reorderOrganizerRules(body)` | `POST …/rules/reorder` *(client exists; drag-save UI deferred)* |

Wire types (snake_case): `ApiEligibleTransactionRow`, `ApiEligibleTransactionListResponse`,
`ApiSmartOrganizerConfirmRequest`/`Response`, `ApiOrganizerRuleRow`, `ApiOrganizerRuleListResponse`,
`ApiOrganizerRuleSaveRequest`, `ApiOrganizerRuleReorderRequest`. Detail: [api-consumption.md](api-consumption.md).

## 7. i18n

`locales/{en,ko,vi}.json` — prefixes `smart_organizer_page.*` (page), `organizer_settings.*` (dialog),
`txn_history.smart_organizer` (launch button). The payment-match dialog uses a separate
`smart_organizer.*` prefix.

---

Backend mapping: [wecms-api/docs/features/banking/smart-organizer/source-code-index.md](../../../../../wecms-api/docs/features/banking/smart-organizer/source-code-index.md).
