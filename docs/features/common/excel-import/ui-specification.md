# Excel Import — UI Specification (Frontend)

**Part of:** Common → excel-import
**Last verified:** 2026-06-23

Spec for the shared `<ExcelUploadDialog>` shell (`components/shared/excel-upload/ExcelUploadDialog.tsx`). Authoritative chrome rules: `wecms-web/CLAUDE.md` §3a. Typography follows the global tokens (no ad-hoc sizes).

## Modal shell

- shadcn `<Dialog>` / `<DialogContent>`, `stackLevel` defaults to **2** (opens from inside Settings L1). Pass `1` for standalone use.
- Content: `flex max-h-[85vh] max-w-[1120px] flex-col rounded-md p-0`.
- **Header bar** — bottom border `#e0e0e0`, `px-5 py-5 pr-14`, title `text-wb-18 font-semibold text-wb-dark`.
- **Body** — two panes: left step panel (`w-[320px]`, right border) + right preview section (`flex-1`).
- **Footer** — top border, right-aligned, `Close` (secondary) + `Upload` (primary). `Upload` is disabled-grey (`bg-[#d4d4d4]`) until `uploadDisabled=false`, then brand (`bg-brand` + `hover:bg-brand-hover`).

## Left step panel (`StepPanel`)

Numbered step badges (`<StepBadge>` — `bg-wb-ntrl-3` rounded chip). Badge numbering is auto-computed by the shell:

| Layout | Step numbering |
|---|---|
| Default (single variant) | Download = 1, Browse = 2 |
| With `selectStep` | Select = 1, Download = 2, Browse = 3 |
| With `extraStep` | …, Extra = (Browse + 1) |

Optional sections (all caller-driven, shell paints the chrome):

- **`selectStep`** — pre-Step-1 "Select Upload Option" radio block (Contacts: Local vs Overseas).
- **`optionsStep`** — post-Browse "Choose Upload Options" radio block with per-option helper text (VAS: Add new vs Reset-and-replace). Tightened spacing so the left panel doesn't outgrow the preview region.
- **`extraStep` / `customStep3`** — caller-owned Step-3 content (Payment withdrawal-account picker).

### Download Template button

- Default content-width (`w-fit`); `downloadFullWidth` stretches to panel width (VAS).
- Icon: `downloadIcon="download"` → `/assets/common/ico-download.svg`; `"excel"` → `/assets/common/ico-excel.svg` (green Excel mark, VAS).

### Browse / Re-Select control

- Button label toggles **Browse → Re-Select** automatically, driven by `fileName` (shell-owned, no per-page ternary).
- **Stacked** layout (default): file-name chip on its own row, Browse button below with a `RefreshCcw` icon.
- **`browseInline`** layout (VAS): chip + button on one row, chip truncates with ellipsis, no `RefreshCcw` icon.
- Empty-state chip shows `filePlaceholder` at reduced opacity; selected filename at `opacity-60`. Chip border is `border-black/15` (documented inline-hex exception, no `wb` token).

## Right preview section (`PreviewSection`)

- **Summary chips** (top-right): Completed (`text-[#04662e]`) + Error (`text-[#cb0d0d]`), each `text-wb-13 font-medium`, fed by `completedCount` / `errorCount`.
- **Three sibling tables share ONE `<colgroup>`** (`SharedColgroup`) so header / body / footer columns align byte-for-byte:
  - Header table — pinned at top, `bg-wb-bg-sidebar`, header cell `text-wb-13 font-semibold text-wb-dark`, optional red `*` for `required` columns.
  - Body table — scrollable region (`min-h-[450px] flex-1`, vertical scroll only). Cells `text-wb-13 font-medium text-wb-ink`, truncate with ellipsis.
  - Footer table — `Total N` row pinned at bottom (`totalLabel`).
- **Column widths come from config**, never hardcoded: each `ExcelUploadColumn.widthPx` drives its `<col>` via inline `style`. The sum drives the inner stack `min-width`, engaging horizontal scroll when columns exceed the panel.
- **Error cells**: `cell.error` tints the `<td>` red (`bg-[#ffe1e3]`); paired `errorMessage` renders a custom dark hover tooltip (Contacts uses this for "Contact Code is invalid").

## Trigger button (`<ExcelUploadButton>`)

- `components/shared/ExcelUploadButton.tsx` — brand-green chip `bg-[#1f7a4d]` + `hover:bg-[#196439]`, native-coloured Excel glyph (`ico-excel.svg`, NOT `brightness-0 invert`).
- Owns chrome only; caller manages open/close + handlers + label. Contacts uses a different green (`bg-[#15803d]`) per its own Figma — documented exception in CLAUDE.md §3b.F.

## Data-shape props (from caller)

- `columns: ExcelUploadColumn[]` — `{ id, label, required?, widthPx, align? }`.
- `rows: ExcelUploadRow[]` — `{ id, cells: Record<colId, { value, error?, errorMessage? }> }`.
- Plus pre-translated chrome strings + counts + handlers (`onDownload`, `onReSelect`, `onUpload`, `uploadDisabled`). The shell is **i18n-free** — callers resolve `t(...)`.

## Related

- [screen-flow.md](screen-flow.md) · [component-index.md](component-index.md) · [README.md](README.md)
- Backend interface: [`../../../../../wecms-api/docs/features/common/excel-import/interface-specification.md`](../../../../../wecms-api/docs/features/common/excel-import/interface-specification.md)
