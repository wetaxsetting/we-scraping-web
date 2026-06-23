# Common Code Lookup — Screen Flow (Frontend)

**Part of:** Common → common-code-lookup
**Last verified:** 2026-06-23

## Shared inline search-select (`SearchSelect` → `PurposeSelect` / `ReportingAccountSelect`)

```
Resting cell
  • empty            → hover shows pencil (assign)
  • assigned + onClear → value text + hover × (clear-first)
  • assigned, no onClear → value text + hover pencil (re-open)
        │ click pencil / toggle
        ▼
Editing chip (white, chevron)  ──► popover opens beneath (portal to document.body)
        │
        ▼
Popover (Figma 1983:20746)
  ┌──────────────────────────────┐
  │ 🔍  [pinned search input]     │   ← borderless, autofocus
  ├──────────────────────────────┤
  │ RECENT            (if any)    │   ← recentIds, order preserved
  │   • row  • row                │
  │ <sectionTitle>                │   ← filtered main list
  │   • row (active = highlight)  │
  │   • row …                     │
  │ (No rows → common.no_rows)    │
  └──────────────────────────────┘
        │ type → filters both sections by label (case-insensitive)
        │ pick a row
        ▼
commit(opt) → onChange(domain option) → popover closes, editing exits
        │
   ESC / outside-click → close + discard (no commit)
```

Source: `SearchSelect.tsx:80-335` (state, outside-click/ESC `:110-135`, filter `:137-158`,
commit `:182-186`, popover render `:267-332`).

## Filter-row controls

- **`FilterSelect`** — click trigger → popover list; pick a row → `onChange(value)` + close;
  selected row gets `text-brand` + optional check glyph; outside-click closes
  (`FilterSelect.tsx:80-167`).
- **`FilterDropdown`** — bare click-to-fire trigger (no built-in popover); the consumer owns the
  open behaviour (`FilterDropdown.tsx:27-61`).

## Country / phone picker (`PhoneCountryPicker`)

```
Mount → countries = FALLBACK_COUNTRIES (offline-safe)
      → fetchCountries() resolves
          → filter to ALLOWED_ISO2 {kh,kr,vn}
          → setCountries(mapped); re-resolve selected
      → on error: keep FALLBACK_COUNTRIES (graceful degradation)

Click trigger → list opens (flag + +dial + name)
Pick row → selected text turns blue, hidden input ships dial code, list closes
ESC / outside-click → close
```

Source: `PhoneCountryPicker.tsx:106-247` (mount fetch `:117-142`).

## Related

- UI spec: [`ui-specification.md`](ui-specification.md) · Components: [`component-index.md`](component-index.md)
