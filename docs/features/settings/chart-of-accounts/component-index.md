# Chart of Accounts — Component / Hook / Type Index (Frontend)

All paths relative to `wecms-web/`.

---

## 1. Components — `components/settings/chart-of-accounts/`

| File | Role |
|---|---|
| `ChartOfAccountsPanel.tsx` | Main container — list fetch, search state, inline add/edit mode, selection set, bulk delete/deactivate, single delete, dialogs, parent-option derivation |
| `ChartOfAccountsTable.tsx` | Read-only two-level tree table; group vs child rows; indentation by level; checkbox selection (child rows only) |
| `ChartOfAccountsInlineRow.tsx` | Inline create/edit form row; code-disabled-in-edit; prospective-level → calc-rule gating |
| `ChartOfAccountsTableColumns.tsx` | Shared `<colgroup>` for table + inline row alignment |
| `ExcelUploadDialog.tsx` | Excel upload wrapper (per-feature config for the shared shell): template download, file pick, preview, per-row bulk-upload |
| `InlineDropdown.tsx` | Styled dropdown for Parent / Calc Rule / Status |

## 2. Hooks & logic

| File | Role |
|---|---|
| `useChartOfAccounts.ts` | `useChartOfAccountsList(params)` → `{ rows, restrictedCodes, initialLoading, error, refetch }`; `useChartOfAccountsMutations()` → `{ create, update, remove, bulkRemove, bulkDeactivate, submitting, error }` |
| `useExcelUpload.ts` | `useChartOfAccountsExcelUpload()` — SheetJS parse + per-row validation (header/positional column resolution, depth ≤ 3 in-file walk, in-file dup) |
| `mappers.ts` | wire ↔ in-memory mapping (`toFormValues`, snake→camel) |
| `types.ts` | `ChartOfAccountsRow` (group/child discriminated union), `ChartOfAccountsFormValues`, `ChartOfAccountsStatus`, `InlineRowMode`, `ChartOfAccountsAudit` |

## 3. API client & wire types

| File | Role |
|---|---|
| `lib/api/chartOfAccounts.ts` | `fetchChartOfAccounts`, `fetchChartOfAccountsTree`*, `fetchChartOfAccount`*, `createChartOfAccount`, `updateChartOfAccount`, `deleteChartOfAccount`, `bulkCreateChartOfAccounts`, `bulkDeleteChartOfAccounts`, `bulkDeactivateChartOfAccounts` (*defined but currently unused — CA-G15) |
| `lib/types/api.ts:3040-3145` | `ApiChartOfAccountRow`, `ApiChartOfAccountListResponse`, `ApiChartOfAccountCreateRequest`/`UpdateRequest`, `ApiChartOfAccountBulkUploadRequest`/`Response`, `ApiChartOfAccountBulkActionRequest`/`Response`, `ApiChartOfAccountTreeNode`/`TreeResponse` |

## 4. Shell / nav / i18n

| File | Role |
|---|---|
| `components/settings/SettingsModal.tsx:201` | Panel mount (`panel === "chart_of_accounts"`) |
| `components/settings/SettingsNav.tsx:64` | Nav entry — `settings.nav.chart_of_accounts`, perm `settings-core-chart-of-accounts` |
| `lib/viewSettingScreens.ts` | `SCREEN_IDS.SETTINGS_CHART_OF_ACCOUNTS = "chart-of-accounts"` reserved (no popover — OQ-6) |
| `locales/{en,ko,vi}.json` | `settings.chart_of_accounts.*` (~82 keys: title, columns, status, actions, bulk_*, confirm_*, inline placeholders, upload.*, restricted.acc_0x) |

## 5. In-memory type shapes

```ts
type ChartOfAccountsStatus = "active" | "inactive";

type ChartOfAccountsRow =
  | { kind: "group"; chartAcctSeqNo; accountCode; accountTypeEn/Vi/Ko;
      restricted: true; chartAcctLevel: 1; audit }
  | { kind: "child"; chartAcctSeqNo; accountCode; accountTypeEn/Vi/Ko;
      parentCode: string|null; calcRule: "+"|"-"|null; status: ChartOfAccountsStatus;
      restricted: false; chartAcctLevel: number|null; audit };

type ChartOfAccountsFormValues = {
  accountCode; nameEn; nameVi; nameKo;
  parentCode: string;            // "" ⇒ null on wire (required via validation)
  calcRule: "+"|"-"|"";          // "" ⇒ null on wire
  status: ChartOfAccountsStatus;
};
```

Naming: wire types are snake_case (`lib/types/api.ts`); in-memory types are camelCase semantic; stable identifier values (`P`/`M`/`A`/`I`) stay as-is. Translation at the boundary in `mappers.ts`.

Cross-links: [api-consumption.md](api-consumption.md) · backend [source-code-index](../../../../../wecms-api/docs/features/settings/chart-of-accounts/source-code-index.md).
