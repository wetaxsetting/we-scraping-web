# Chart of Accounts — API Consumption (Frontend)

Endpoints called by the panel, via `lib/api/chartOfAccounts.ts` (Axios `api`, JWT auto-attached). Wire is lowercase snake_case. Full contract: backend [wecms-api/…/interface-specification.md](../../../../../wecms-api/docs/features/settings/chart-of-accounts/interface-specification.md).

Base: `/api/v1/settings/chart-of-accounts`.

---

## 1. Endpoints used

| Action | Client fn | Method + path | Notes |
|---|---|---|---|
| List | `fetchChartOfAccounts(params)` | `GET /` | params: `search`, `sortField`→`sort_field`, `sortDir`→`sort_dir` |
| Tree | `fetchChartOfAccountsTree()` | `GET /tree` | **defined but unused** (panel derives parents from flat list) — CA-G15 |
| Detail | `fetchChartOfAccount(seqNo)` | `GET /{seqNo}` | **defined but unused** — CA-G15 |
| Create | `createChartOfAccount(body)` | `POST /` | via `mutations.create` |
| Update | `updateChartOfAccount(seqNo, body)` | `PUT /{seqNo}` | via `mutations.update`; also the single-row (de)activation path (status flip) |
| Delete | `deleteChartOfAccount(seqNo)` | `DELETE /{seqNo}` | via `mutations.remove` |
| Bulk upload | `bulkCreateChartOfAccounts(items)` | `POST /bulk-upload` | from `ExcelUploadDialog` |
| Bulk delete | `bulkDeleteChartOfAccounts(seqNos)` | `POST /bulk-delete` | via `mutations.bulkRemove` |
| Bulk deactivate | `bulkDeactivateChartOfAccounts(seqNos)` | `POST /bulk-deactivate` | via `mutations.bulkDeactivate` |

**Not consumed (do not exist):** no `bulk-activate`, no `export`. Re-activation = `PUT` status flip; no file export.

---

## 2. Request shapes

**Create / Update** (`ApiChartOfAccountCreateRequest`):
```jsonc
{
  "chart_acct_cd": "1007010",
  "chart_acct_nm_en": "Collection 5",
  "chart_acct_nm_vn": "Thu 5" | null,
  "chart_acct_nm_ko": null,
  "chart_acct_type": null,
  "parent_chart_acct_cd": "ACC-01" | null,   // required (sent non-null after validation)
  "cal_rule": "P" | "M" | null,              // null unless level-3 + chosen
  "stts": "A" | "I"
}
```
- Update: seqNo in the path; body never echoes `chart_acct_seq_no` / `biz_key`. Code field is read-only in edit mode.
- Status change: same Update body with the new `stts`.

**Bulk upload** (`ApiChartOfAccountBulkUploadRequest`):
```jsonc
{ "items": [ { /* create request */, "stts": "A" }, ... ] }   // only error-free rows
```

**Bulk delete / deactivate** (`ApiChartOfAccountBulkActionRequest`):
```jsonc
{ "chart_acct_seq_nos": ["99","100"] }
```

---

## 3. Response shapes

**List** (`ApiChartOfAccountListResponse`):
```jsonc
{ "items": [ ApiChartOfAccountRow ], "total_count": 12, "restricted_codes": ["ACC-01","ACC-02","ACC-03"] }
```

**Row** (`ApiChartOfAccountRow`): `chart_acct_seq_no, chart_acct_cd, chart_acct_nm_en/vn/ko, chart_acct_type, parent_chart_acct_cd, cal_rule, stts, chart_acct_level (1..3|null), has_children, restricted, reg_id, reg_dtm, mod_id, mod_dtm`.

**Bulk upload** → `{ created, failed }` · **Bulk action** → `{ processed, failed }`.

`mappers.ts` translates `ApiChartOfAccountRow` → `ChartOfAccountsRow` (group when `restricted`, else child), parsing `cal_rule` `P`/`M` → `+`/`-` and `stts` `A`/`I` → `active`/`inactive`.

---

## 4. Error handling

Errors surface as `ApiCallError { code, message, traceId }` from the unwrapped envelope. Pages route non-401 errors to `useDialog().open({ type: "error", errorCode, traceId })`; 401 is handled by the global session-expired interceptor.

Reachable COA error codes:
`WBE_CHART_OF_ACCOUNTS_NOT_FOUND`, `..._DUPLICATE_CODE`, `..._PARENT_NOT_FOUND`, `..._PARENT_REQUIRED`, `..._RESTRICTED_CODE`, `..._CYCLE`, `..._DEPTH_EXCEEDED`, `..._SELF_PARENT`, `..._CAL_RULE_LEVEL3_ONLY`, `WBE_VALIDATION`.

Bulk endpoints return `WBI0000` with a `{processed/created, failed}` tally even when some rows fail (per-row failures do not fail the call).

---

## 5. Refetch

`mutations.*` success → panel bumps its refresh trigger → `useChartOfAccountsList` refetches so the tree, parent options, and `has_children` stay current. No optimistic patching.

Cross-links: [screen-flow.md](screen-flow.md) · [component-index.md](component-index.md) · backend [interface-specification](../../../../../wecms-api/docs/features/settings/chart-of-accounts/interface-specification.md).
