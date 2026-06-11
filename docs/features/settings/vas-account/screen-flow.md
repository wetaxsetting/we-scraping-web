# Settings > VAS Account — Screen Flow (Frontend)

User journeys and interaction flows. Layout detail in [ui-specification.md](ui-specification.md);
components in [component-index.md](component-index.md). Backend behaviour:
[wecms-api/docs/features/settings/vas-account/business-flow.md](../../../../../wecms-api/docs/features/settings/vas-account/business-flow.md).
JEX source of truth: [docs/jex/features/vas-account/business-flow.md](../../../../../docs/jex/features/vas-account/business-flow.md).

---

## 1. Entry & host

```
Top nav → Settings → <SettingsModal> opens (stackLevel 1)
        → <SettingsNav> left rail → "VAS Account" (key vas_account, icon ico-vas-account.svg)
        → SettingsModal renders <VasAccountPanel /> in the panel column
```

No URL change — the panel lives inside the modal, not a route. Visibility is gated on the menu code
`settings-core-vas-account` being in `allowedMenuCds` (non-admins) via `isSettingsPanelVisible`.

## 2. Initial load

```
<VasAccountPanel> mount
   ↓ params = { searchWd: "", statuses: ["A","I"], all: true }   // both checkboxes default checked
   ↓ useVasAccountList(params)
   ↓   statuses non-empty → fetchVasAccounts(params)  → GET /api/v1/settings/vas-account?stts=A&stts=I&all=true
   ↓   rawRows = res.list ; rows = buildTree(res.list)            // client-side prefix grouping
   → grid renders parents (bold) + indented children; empty → "No Data Found"
```

**Empty-statuses short-circuit:** if the user unchecks **both** Active and Inactive, `statuses` is
`[]` and the hook returns empty arrays **without** a wire call (mirrors legacy "no checkbox ticked =
no rows").

## 3. Search / filter flow

```
SearchInput onChange ──► keyword state ──► trimmed into params.searchWd ──► useEffect re-fetch
Active checkbox  ──► activeChecked   ──┐
Inactive checkbox ─► inactiveChecked ──┴─► statuses memo (["A"], ["I"], or ["A","I"]) ──► re-fetch
```

| Control | Component | Effect |
|---|---|---|
| Keyword | shared `<SearchInput>` | `search_wd` query param (code or name match) |
| Active | local checkbox | adds `"A"` to `statuses` |
| Inactive | local checkbox | adds `"I"` to `statuses` |

There is **no parent filter** (no hierarchy data) and **no status dropdown** — only the two checkboxes.

## 4. Add / Edit flow

```
"+ Add VAS Account" button ─► addDialogOpen = true ─► <AddVasAccountDialog mode="add">
Row kebab → Edit          ─► editingRow set       ─► <AddVasAccountDialog mode="edit" key=edit-${id}>
   ↓ fields: VAS Code (required), VAS Account Name (required), Status (Active/Inactive radio pills)
   ↓ submit → Zod validate (vasAccountSchema) → first error → useDialog({ type: "error" })
   ↓ add  → mutations.create(toCreateRequest(values))   → POST  /api/v1/settings/vas-account
   ↓ edit → mutations.update(seqNo, toUpdateRequest(v)) → PUT   …/{seqNo}
   → onSaved() → panel.refetch() → dialog closes
```

The dialog deliberately omits **English Name**, **Type**, and **Notes** fields (PO call 2026-05-11);
the backend defaults Type→Dual on create and preserves existing values on update.

## 5. Delete flow

```
Row kebab → Delete ─► openDeleteConfirm(row)
   ↓ re-entry guard (deletingIds set)
   ↓ useDialog({ type: "confirmation" })   // NOT destructive-red — standard blue Continue (PO call)
   ↓ confirm → mutations.remove(row.seqNo) → DELETE …/{seqNo} → refetch()
   → error → useDialog({ type: "error" }) ; finally → deletingIds cleanup
```

No bulk delete, no row-selection checkbox.

## 6. Excel template / preview / import flow

```
"Excel Upload" chip ─► excelUploadOpen ─► <ExcelUploadDialog> (wraps shared shell, stackLevel 2)
   ↓ choose upload option: "Add New" (A) | "Reset and replace" (R)
   ↓ Download template → downloadVasAccountTemplate(locale)  // static asset, no HTTP
   ↓ Browse file → handleFileChange
   ↓   isExcelFilename guard → error dialog upload.error_file_type on non-.xls/.xlsx
   ↓   validateExcelTemplate(file, VAS_ACCOUNT_TEMPLATE_SPEC) → mismatch → error "template_mismatch"
   ↓   previewVasAccountExcel(file) → POST …/excel/preview → preview rows + counts
   ↓ Reset/Replace mode drops dup_db errors client-side (backend wipes before insert)
   ↓ Upload (blocked if errored > 0) → confirmation dialog
   ↓   importVasAccountExcel({ upld_optn, rows }) → POST …/excel/import
   → success dialog upload.success.* (Done → onSaved → refetch) | failure dialog (modal stays open)
```

## 7. Picker consumption (cross-feature)

```
Settings → Bank Account → Edit dialog → <VasAccountPicker>
   ↓ first open → fetchVasAccountLookup() → GET …/lookup (active+live only)
   ↓ cached; client-side substring filter on code/name
   → select → { seqNo:number, code, name } written onto the bank-account form
```

## 8. State diagram (panel)

```
            ┌───────────── loading (sticky) ─────────────┐
 mount ───► fetch ──► rows>0 → grid ──► (add/edit/delete/import) ──► refetch ──► fetch
                       │                                                          ▲
                       └─ rows==0 → "No Data Found" ──────────────────────────────┘
            statuses==[] → short-circuit empty (no fetch)
            error → useDialog({ type:"error", errorCode })
```

## 9. Synchronization (not on this screen)

VAS Account has no bank/sync dependency — it is a pure CRUD list. (Unlike Account Inquiry, there is no
NXiSAS/Coocon pull.) The only cross-feature link is the **read-side picker** (§7) and the banking
transaction-assign flow, both of which consume VAS codes; neither writes back into this panel.
