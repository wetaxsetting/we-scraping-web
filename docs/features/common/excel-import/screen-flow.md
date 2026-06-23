# Excel Import — Screen Flow (Frontend)

**Part of:** Common → excel-import
**Last verified:** 2026-06-23

The shared import modal flow as the user experiences it. All screens reuse the same `<ExcelUploadDialog>` shell (`components/shared/excel-upload/ExcelUploadDialog.tsx`); only chrome strings, columns, rows, and handlers differ per feature.

## Flow

```
Settings panel
   │  click brand-green "Excel Upload" chip  (<ExcelUploadButton>)
   ▼
┌─ Excel Upload modal (Dialog, stackLevel=2 — opens above Settings L1) ──────┐
│                                                                            │
│  LEFT: step panel                         RIGHT: preview                   │
│  ─────────────────                        ───────────────                  │
│  [1] Download Excel Template              Completed N · Error M  (chips)    │
│       → onDownload (static asset)                                          │
│                                           ┌── header row (frozen) ──────┐   │
│  [2] Browse / Re-Select Excel Form        │  scrollable body            │   │
│       → file picker → templateValidator   │  (error cells tinted red)   │   │
│         (client header check)             └── Total N row (pinned) ─────┘   │
│       → multipart preview call                                             │
│                                                                            │
│  (optional: selectStep / optionsStep / extraStep per feature)              │
│                                                                            │
│  FOOTER:                          [ Close ]   [ Upload ]                    │
│                                               ▲ disabled until valid       │
└────────────────────────────────────────────────────────────────────────┘
```

## Steps

1. **Open.** User clicks the brand-green "Excel Upload" chip (`<ExcelUploadButton>`, `bg-[#1f7a4d]`) on a Settings panel. The host mounts the per-feature wrapper, which renders `<ExcelUploadDialog>` at `stackLevel=2` (Settings is L1).
2. **Download template.** Step 1 button downloads the static `.xlsx` template (from `public/templates/`). Single-variant flows show badge `1`; flows with a pre-step `selectStep` (Contacts: Local vs Overseas) shift Download to badge `2`.
3. **Browse / Re-Select.** Step 2 file picker. The button reads **"Browse"** before a file is chosen and **"Re-Select"** after (the shared shell owns this toggle via `fileName`). On pick, `templateValidator.validateExcelTemplate(file, SPEC)` runs a client-side header check.
4. **Preview.** On a valid template, the wrapper parses rows (`lib/xlsxReader` → `readXlsxQuiet`) and/or calls the backend preview; the preview table fills with rows. Cells with validation errors are tinted red (`bg-[#ffe1e3]`), optionally with a hover tooltip carrying the message. The Completed / Error chips update.
5. **Upload.** The **Upload** button stays disabled (grey) until the host enables it; on click it posts the rows to the feature's import endpoint. Result drives a system dialog (success / error per `useDialog()` variant rules).

## Validation rejections (client-side, before/instead of upload)

`templateValidator` returns one of four typed reasons; the wrapper surfaces a `type:"error"` system dialog (per CLAUDE.md dialog-variant rule — file-type/validation errors are **errors**, never warnings):

| Reason | When |
|---|---|
| `parse_error` | corrupt / unreadable workbook |
| `no_sheet` | workbook has no sheets |
| `no_headers` | no header row found in scan window |
| `wrong_template` | required columns missing, or a forbidden tell-tale column from another template present (e.g. Contacts headers in the Purpose dialog) |

Server-side workbook rejections (`WBE2041/2042/2043`) come back from the preview call for the canonical features (Purpose, VAS).

## Per-feature variants

- **Contacts:** adds `selectStep` (Local vs Overseas) before Download — badges shift to Select=1 / Download=2 / Browse=3.
- **VAS Account:** adds `optionsStep` (Add new vs Reset-and-replace) below Browse, full-width Download button, inline file chip + Browse on one row, green Excel download icon.
- **Payment** uploads (Vendor / Expense / Payroll / Internal Transfer / Overseas): use `extraStep` / `customStep3` for the "Withdrawal Bank/Account No." picker.

## Related

- [ui-specification.md](ui-specification.md) · [component-index.md](component-index.md) · [README.md](README.md)
- Backend flow: [`../../../../../wecms-api/docs/features/common/excel-import/business-flow.md`](../../../../../wecms-api/docs/features/common/excel-import/business-flow.md)
