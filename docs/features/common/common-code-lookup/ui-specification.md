# Common Code Lookup — UI Specification (Frontend)

**Part of:** Common → common-code-lookup
**Last verified:** 2026-06-23

## `SearchSelect` — generic inline search-dropdown foundation

Figma 1983:20746. Single component behind every editable code+name picker (Reporting Account,
Purpose, VAS Account, Contact Name) across Transaction History, Card Transactions, and the Smart
Organizer dialog. `SearchSelect.tsx:80`.

### Trigger states (`SearchSelect.tsx:188-265`)

| State | Resting render | Hover affordance |
|---|---|---|
| empty | transparent text placeholder | pencil button (`bg-wb-bg-sidebar`, `size-6`, `Pencil size-3.5`) → assign |
| assigned + `onClear` | value text (`text-wb-13 font-medium text-wb-ink`, truncate + `title`) | × clear button (`bg-wb-ntrl-8` circle) — clear-first flow |
| assigned, no `onClear` | value text | pencil → re-open to re-pick |
| editing | white chip `h-8 rounded-md border-wb-ntrl-4`, value/placeholder + `ChevronDown size-3.5` | — |
| `alwaysEditable` | always the chip (e.g. Organizer Settings rows) | — |

### Popover (`SearchSelect.tsx:267-332`)

- Portal to `document.body`; `fixed z-[60]`, anchored at trigger `bottom + 4px`, left-aligned.
- Width `280px` by default; `matchTriggerWidth` locks it to the trigger's measured width.
- `max-h-[250px]` (Figma frame 236×250) — search row pinned, section list scrolls
  (`custom-scrollbar-y`).
- 3-layer ambient shadow, no border, inner `p-1`.
- **Pinned search row**: borderless `Search size-4` + autofocus input, `text-wb-13 font-medium`,
  placeholder = `common.search`.
- **Sections** (`Section`, `:341-392`): title row (`text-wb-12 font-medium text-wb-ntrl-5`,
  RECENT uppercase) over `gap-0.5` single-line rows (`p-2 rounded`, `text-wb-13 font-medium
  text-wb-ntrl-8`, ellipsis + native `title`). Active row → `bg-wb-bg-active`.
- Empty filter → `common.no_rows`.

## `FilterSelect` — filter-row single-select popover (`FilterSelect.tsx:67`)

- Trigger `h-[var(--h-wb-filter-btn)]` (32px), `text-wb-13 font-medium text-wb-ink`; `flush`
  variant drops border/shadow; default has `rounded-md border-wb-ntrl-4 bg-white shadow-wb-btn`.
- Optional `triggerPrefix` / `triggerLabel` / `triggerIcon` (e.g. flag for currency picker, swap
  chevron for calendar/hamburger; `null` hides the glyph).
- Popover `min-w-full` list; selected row `text-brand` + `Check size-3.5` (unless
  `hideSelectedCheck`); outside-click closes.

## `FilterDropdown` — filter-row click-to-cycle trigger (`FilterDropdown.tsx:27`)

- Bare 32px trigger, `shadow-wb-btn`, `text-wb-14-tight font-medium text-wb-ntrl-8`, optional
  `prefixIcon`, trailing chevron SVG (`hideChevron` to suppress). No built-in popover — the
  consumer owns open behaviour.

## Typography / tokens

All sizes via `text-wb-*` tokens (13/12/14-tight) per `wecms-web/CLAUDE.md` §"Typography & tokens".
No raw `text-[Npx]`. Scrollbars use the shared `custom-scrollbar-y` utility.

## Related

- Screen flow: [`screen-flow.md`](screen-flow.md) · Components: [`component-index.md`](component-index.md)
