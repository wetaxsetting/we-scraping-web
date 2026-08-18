# Audit Log — UI Specification (Frontend)

**Part of:** Common → audit-log
**Last verified:** 2026-06-23

Verified against `components/shared/popups/AuditLogsDialog.tsx`. Figma refs in the component:
166:25291 (Bank Account) / 3435:22565 (Login Credentials).

## Modal frame

| Property | Value | Source |
|---|---|---|
| Stack level | `stackLevel={2}` | `:104` |
| Max width | `max-w-[860px]` | `:105` |
| Max height | `max-h-[calc(100vh-120px)]` | `:105` |
| Radius | `rounded-2xl` | `:105` |
| Close affordances | top-right X (from `<DialogContent>`), Close button, ESC | `:78-79` |

## Header (`:107-121`)

- Container `flex shrink-0 flex-col items-start justify-center gap-1.5 px-6 pb-4 pt-6`.
- Title — `<DialogTitle asChild><h2 className="whitespace-nowrap text-wb-16 font-semibold text-wb-dark">`.
- Optional description — `<DialogDescription asChild><p className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">`,
  hidden when omitted.

## Body table (`:123-157`)

- Scroll region `custom-scrollbar-y min-h-0 flex-1 overflow-y-auto px-6`.
- `<table className="w-full table-fixed border-collapse">` with a 4-`<col>` `<colgroup>`:
  `w-[121px]` (Date/Time) · `w-[105px]` (User) · `w-[214px]` (Activity) · auto (Details).
- Sticky header cells (`HeaderCell`, `:174-180`): `sticky top-0 z-10 … bg-wb-bg-sidebar px-3 py-3 text-left
  text-wb-13 font-semibold tracking-wb-tight text-wb-dark`.
- Column labels default to the audit-logs vocabulary keys (`DEFAULT_COL_KEYS`, `:53-58`) and can be
  overridden per-caller via `columnLabels`.
- Empty `rows` → centered `t("common.no_data")` placeholder below the header (`:152-156`).

## Body row (`AuditLogTableRow`, `:182-213`)

- `<tr className="h-16 border-b border-wb-table-border">`.
- **Date/Time** cell — two-line stack: date `text-wb-13 font-medium text-wb-ink`, time `text-wb-13
  font-medium text-wb-ntrl-6`.
- **User / Activity / Details** — `truncate text-wb-13 font-medium text-wb-ink`.

## Footer (`:159-168`)

- `flex shrink-0 items-center justify-end px-6 py-4`.
- Single Close button: `h-8 … rounded-md bg-white px-3 text-wb-14-tight font-medium … text-wb-ntrl-10
  shadow-wb-btn hover:bg-black/[0.03]`, label `t("common.close")`.

## Typography / token compliance

All sizes use WB365 `text-wb-*` tokens; no inline px/font styles. Consistent with the global typography
rules and the Settings dialog system.
