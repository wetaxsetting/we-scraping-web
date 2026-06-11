# Chart of Accounts — Screen Flow (Frontend)

**Route:** none (Settings-modal panel). Entry: Top nav → **Settings** → `<SettingsNav>` "Chart of Accounts" → `<ChartOfAccountsPanel>`.
Nav entry: `SettingsNav.tsx:63` — label key `settings.nav.chart_of_accounts`, permission `settings-core-chart-of-accounts`. Panel switch: `SettingsModal.tsx:197` (`panel === "chart_of_accounts"`).

---

## 1. Composition

```
<SettingsModal>                       (L1 shell, 1300×760, owns Esc/X + scroll lock)
  ├─ <SettingsNav>                    left rail; selects "Chart of Accounts"
  └─ <ChartOfAccountsPanel>           right pane
       ├─ Header                      title + subtitle + "+ Add A New Account" + Excel Upload chip
       ├─ Filter row                  <SearchInput> (keyword) ; bulk Delete / Deactivate buttons when rows selected
       ├─ Scroll region (custom-scrollbar)
       │    └─ <ChartOfAccountsTable> bare <table> + shared <colgroup>, sticky thead
       │         ├─ group rows        ACC-01/02/03 (bold, no checkbox/status/actions)
       │         ├─ child rows        indented by level; checkbox + edit/delete
       │         └─ <ChartOfAccountsInlineRow>  add (bottom) / edit (in place)
       └─ (no pagination — load-all)
  └─ <ExcelUploadDialog>              opened from the Excel Upload chip (stackLevel=2)
```

No detail page; no pagination. All system feedback routes through `useDialog()`.

---

## 2. Navigation / load flow

```
Open panel
   │
   ├─ useChartOfAccountsList() → GET /api/v1/settings/chart-of-accounts
   │      → rows sorted (restricted roots → other roots → orphans), restrictedCodes set
   │
   ▼
Render table (group + child rows). Initial loading → spinner in scroll region.
```

---

## 3. Create flow (inline)

```
Click "+ Add A New Account"
   → InlineRowMode = { kind: "add" } ; <ChartOfAccountsInlineRow> mounts at table bottom
   → user fills Code / Name EN / (VN/KO) / Parent / (Calc Rule if level 3) / Status
   → client validation: code required/≤10/pattern, name_en required, parent required
   → Save → mutations.create(values) → POST /  →
        success: success dialog + list refetch + close row
        error  : ApiCallError → error dialog (errorCode + traceId); row stays open
```

## 4. Edit flow (inline)

```
Click row pencil (disabled on restricted rows)
   → InlineRowMode = { kind: "edit", row } ; that row's cells become inputs
   → Code input DISABLED (immutable); Calc Rule enabled only when prospective level === 3
   → Save → mutations.update(seqNo, values) → PUT /{seqNo} → success/refetch | error dialog
   → Cancel → discard local state, back to read row
```

## 5. Status (activate / deactivate)

```
Single  : edit row → Status dropdown (active/inactive) → Save (PUT)   ← only re-activation route
Bulk    : select child rows (checkboxes) → header "Deactivate" → confirmation dialog
              → mutations.bulkDeactivate(ids) → POST /bulk-deactivate
              → result dialog (success { processed } | partial { processed, failed })
Bulk Activate : NOT available (no button) — by design (backend has no bulk-activate)
```

## 6. Delete flow

```
Single  : row trash (disabled on restricted) → confirmation dialog (code+name) → mutations.remove(seqNo) → DELETE /{seqNo}
Bulk    : select rows → header "Delete" (red, destructive) → confirmation → mutations.bulkRemove(ids) → POST /bulk-delete
              → result dialog (success { processed } | partial { processed, failed })
Selection cleared + list refetched after success.
```

## 7. Excel import flow

```
Click "Excel Upload" chip → <ExcelUploadDialog> opens (L2)
   Step 1: Download template (per-locale EN/VI/KO .xlsx from /templates/chart-of-accounts/)
   Step 2: Browse file → validateExcelTemplate() → useChartOfAccountsExcelUpload() parses (SheetJS)
              per-row validation: code required/≤10/pattern, in-file duplicate, name_en required,
                                  parent required, depth ≤ 3 (in-file parent walk)
   Preview table: per-cell error highlight + tooltip ; Completed / Error count chips
   Upload (disabled while any error) → per-row POST /bulk-upload  → { created, failed }
              → result dialog (success { created } | partial { created, failed }) → list refetch
```

There is **no export** action — the template download is the only file output.

---

## 8. Refresh discipline

Every successful create / update / delete / bulk action / import refetches the list so the tree, parent options, and `has_children` stay current. No optimistic row patching.

Cross-links: [ui-specification.md](ui-specification.md) · [api-consumption.md](api-consumption.md) · backend [business-flow](../../../../../wecms-api/docs/features/settings/chart-of-accounts/business-flow.md).
