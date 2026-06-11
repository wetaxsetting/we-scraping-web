# Approval Line — UI Specification

Visual + interaction contract for the Settings → Approval Line panel and its dialog. Components live
under [components/settings/approval-line/](../../../../components/settings/approval-line/). Backend
contract: [wecms-api/docs/features/settings/approval-line/interface-specification.md](../../../../../wecms-api/docs/features/settings/approval-line/interface-specification.md).

---

## 1. Panel layout

`<ApprovalLinePanel>` follows the Settings panel composition (`§3a` of `wecms-web/CLAUDE.md`):
header (title + description + "+ Add Approval line") → search row → scrollable table → no pagination
footer (load-all). Header title `text-wb-18 font-semibold tracking-wb-tight text-wb-dark`; description
`mt-1 text-wb-13 font-normal text-wb-muted`.

---

## 2. Search / filter

- A single search input ("Search Approval line name", `settings.approval_line.search_placeholder`).
- **Client-side** filter over the loaded rows (`apprLineNm` case-insensitive substring). No server
  round-trip per keystroke.

---

## 3. Grid columns (`<ApprovalLineTable>`)

`<colgroup>`: 32% / 38% / 130px / 180px. Header + body text `text-wb-13`.

| # | Header (i18n key) | Sort field | Body |
|---|---|---|---|
| 1 | Approval Line Name (`settings.approval_line.col.name`) | `APPR_LINE_NM` | line name |
| 2 | Approver name (`settings.approval_line.col.approver`) | `APPRVR_NM` (sorts on `approvers[0].name`) | primary approver name + `+N` count chip (`extraCount = max(approvers.length - 1, 0)`) with a `ChevronDown` toggling `<ApproverListPopover>` |
| 3 | Create Date (`settings.approval_line.col.create_date`) | `REG_DTM` | `regDtm` (`yyyyMMddHHmmss`) formatted to `yyyy-MM-dd` |
| 4 | (actions, `aria-label` only) | — | Edit pill (`Pencil`, white) + Delete pill (`Trash2`, red border), both `h-8 text-wb-13` |

Sort glyphs cycle default → ASC → DESC (client-side); special/hidden-column rules N/A (no View Setting
here). The approver count chip uses `rounded-[4px]` (documented intentional micro-radius, `§3b.F` of
`wecms-web/CLAUDE.md`).

---

## 4. Add / Edit dialog (`<ApprovalLineDialog>`)

- One component, discriminated by `mode: "add" | "update"`. Update adds `apprLineNo` + `loadDetail`.
- `stackLevel={2}` (opened from inside the L1 Settings modal), `max-w-[880px]`, `hideClose`,
  `aria-describedby={undefined}`.
- **Edit pre-fill:** on mount in update mode, `loadDetail(apprLineNo)` fetches the full chain and seeds
  name + approvers (the panel row only carried the primary + count).
- **Name** input (`settings.approval_line.add_dialog.name_placeholder`).
- **Approver chain table** — columns `#` · Name · Position · Department · (Remove). Inner rows `h-12`
  (Figma spec, distinct from the 60px panel row). The `#` cell renders `index + 1` straight from array
  position.
- **"+ Add Approver"** opens `<AddApproverPopover>`.
- **Count hint** "{current} of {max}" (`settings.approval_line.add_dialog.count`) — max = 5.
- Footer: Cancel (white) + Save/Update (brand). Mode switches the title + primary label
  (`add_dialog.title` / `update_dialog.title`, `add_dialog.save` / `update_dialog.update`).

### Approver picker (`<AddApproverPopover>`)

- Receives `available: ApproverRow[]` (the dialog's `fetchTenantUsers` directory minus already-chained
  approvers) + `capacity` (= `MAX_APPROVERS - approvers.length`).
- Multi-select via shadcn `Checkbox` (`selectedIds: Set<string>`), case-insensitive name search,
  Clear-all, empty state ("No matching approvers").
- **"Add N Approver"** (`add_count` / `add_short`) adds the selected rows, sliced to `capacity`.
- Rendered inline (no portal) to stay within the dialog's Radix focus scope; ESC / outside-click
  dismiss; autofocus on the search input.

---

## 5. Drag-and-drop reorder

**Native HTML5 drag-and-drop — no library.** Each approver `<tr>` in the dialog's chain table is
`draggable` (when not submitting) and wires the full native handler set:

```tsx
const [dragIndex, setDragIndex] = useState<number | null>(null);

<tr
  draggable={!props.submitting}
  onDragStart={() => setDragIndex(i)}
  onDragOver={(e) => e.preventDefault()}
  onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) handleReorder(dragIndex, i); setDragIndex(null); }}
  onDragEnd={() => setDragIndex(null)}
  className={cn("h-12 border-b border-wb-table-border", dragIndex === i && "opacity-50")}
>
```

- **Drag handle:** a per-row `GripVertical` icon (`cursor-grab`) — purely visual; the **entire `<tr>`**
  carries `draggable`. A second `GripVertical` + hint text sits in the sticky strip
  (`settings.approval_line.add_dialog.drag_hint` — "You can adjust the payment order by dragging and
  dropping with your mouse.").
- **Visual feedback:** the dragged row dims to `opacity-50`.
- **Reorder logic** (`handleReorder(from, to)`): array splice (`splice(from,1)` → `splice(to,0,moved)`),
  bounds-guarded, no-op when `from === to`.
- **Persistence:** the array order **is** the persisted order. The create/update payload omits
  `apprvr_disp_ord`; the backend re-numbers `1..N` from array position; the `#` column renders
  `index + 1`. Reopening shows the saved order (read path orders `APPRVR_DISP_ORD ASC`).
- This closes **AL-GAP-01** and matches the legacy jQuery-UI `.sortable()` contract (submit in DOM
  order, server renumbers).

---

## 6. Validation (client-side)

Zod [schema.ts](../../../../components/settings/approval-line/schema.ts):

- `apprLineNm` — trim, `.min(1, "settings.approval_line.validation.name.required")`, `.max(100, "…name.max")`.
- `approvers` — `.min(1, "…approvers.required")`, `.max(MAX_APPROVERS, "…approvers.too_many")` (= 5).
- `.superRefine` — duplicate-`id` guard: adds a `custom` issue at `["approvers", i, "id"]` with key
  `"…approvers.duplicate"`.
- Messages are **translation keys** (not literal strings); `validateApprovalLine` returns `null` or
  `{ path, key }[]`; the dialog renders per-field issues inline. The backend re-checks the same rules
  and the panel maps any backend code via `resolveBackendMessage`.

---

## 7. States

| State | UI |
|---|---|
| Loading | `settings.approval_line.loading` ("Loading…") while the list fetches |
| Empty | `settings.approval_line.empty` ("Approval Line Not Found") |
| Save success | system `success` dialog (`create_success` / `update_success`) |
| Delete confirm | system `confirmation` dialog (`confirm_delete.*`) |
| Delete success | system `success` dialog (`delete_success`) |
| Error | system `error` dialog (mapped `WBE_APPROVAL_LINE_*` message) |

---

## 8. i18n keys

All under `settings.approval_line.*` (+ `settings.nav.approval_line` for the nav label). EN values
live in [locales/en.json](../../../../locales/en.json); KO/VI carry the same namespace. Notable keys:

`title` · `description` · `search_placeholder` · `add` · `loading` · `empty` ·
`col.{name,approver,create_date,actions}` · `actions.{edit,delete,edit_aria,delete_aria,show_approvers_aria}` ·
`add_dialog.{title,name_placeholder,add_approver,drag_hint,drag_aria,col.*,remove,remove_aria,count,approvers_assigned,cancel,save,search_placeholder,selected_count,clear_all,add_count,add_short,empty_search_title,empty_search_hint}` ·
`update_dialog.{title,update}` · `create_success` · `update_success` · `delete_success` ·
`confirm_delete.{title,description,confirm,cancel}` ·
`validation.name.{required,max}` · `validation.approvers.{required,too_many,duplicate}` ·
`error.{not_found,too_many_approvers,duplicate_approver,approver_not_in_tenant,empty_approvers,name_blank}`.

---

## 9. Typography & tokens

All text via `text-wb-*` tokens (no raw px). No new font family. The brand-green / inline-hex
exceptions do not apply to this screen. Micro-radius `rounded-[4px]` on the count badge / remove-row /
popover row and the `h-12` inner approver rows are the documented intentional exceptions in
`wecms-web/CLAUDE.md` §3b.F.
