# Frontend Technical Debt — wecms-web

Pre-existing issues that are **knowingly deferred** (not fixed in the task that
surfaced them) because fixing them risks behavior change outside the task's
scope. Each entry records what it is, why it was left, and what a safe fix would
need. Tag new entries with the date they were logged.

---

## TD-1 — `react-hooks/set-state-in-effect` in `SearchSelect`

- **Logged:** 2026-06-27
- **File:** [components/shared/SearchSelect.tsx](../components/shared/SearchSelect.tsx)
- **Rule:** `react-hooks/set-state-in-effect` (ESLint, `eslint-plugin-react-hooks`)
- **Location:** the search-reset effect around line 108/110:
  ```tsx
  useEffect(() => {
      if (open) setSearch("");
  }, [open]);
  ```
  The lint error reports "Calling setState synchronously within an effect can
  trigger cascading renders."
- **Status:** **pre-existing** — present on the committed `HEAD` independent of
  any recent change (verified via `git stash` + `eslint`: the same single error
  reports with the working-tree changes removed). It is the **only** ESLint
  problem in the file.
- **Why not fixed here:** this effect clears the in-dropdown search text when the
  popover opens/closes — it is part of the **selection-reset behavior** of the
  shared `SearchSelect`. `SearchSelect` is consumed by Banking (Transaction
  History pickers, Smart Organizer) **and** Payment (Card Transactions,
  Internal-Transfer detail). Changing how/when the search field resets could
  alter dropdown behavior across all those consumers, which was explicitly out of
  scope for the tooltip task that surfaced it. The tooltip change (native
  `title` → shared `EllipsisTooltip`) introduced **zero** new lint problems.
- **Safe-fix sketch (future, deliberate):** move the reset out of the effect —
  e.g. clear `search` inside the same handler that toggles `open` (`toggle` /
  `startEdit` / `commit` / outside-click close), or guard with a ref so the
  state write is event-driven rather than effect-driven. Must be verified across
  **all** SearchSelect consumers (Banking + Payment) before landing, since it
  touches shared selection behavior.

---

## TD-2, TD-3 — closed 2026-11-03

Both entries described WeCMS code (`lib/reportExcel.ts`, `lib/dailyCashExport.ts`,
`useEInvoiceScrape.test.ts`) that was removed in the WeInvoice transformation. Nothing left to fix;
the history is in git.

---

## TD-4 — Leftovers from the WeInvoice transformation

**Opened:** 2026-11-03 · **Source:** [weinvoice-p1-ui-transformation-2026-11-03.md](features/weinvoice/weinvoice-p1-ui-transformation-2026-11-03.md)

`CLAUDE.md`, `README.md` and the docs tree were rewritten for WeInvoice (link check green). Still
open: generic shared UI kept for future screens but currently unused (`DataTableShell`,
`ReportLayout`, date pickers, `lib/print.ts`, …); spec-inherited UI gaps (untranslated "MST" in the
sidebar company block, a few inline hex colours, supplier drawer as a custom portal); pre-existing
`react-hooks/set-state-in-effect` lint errors in untouched shared components.

## How to use this file

- Add an entry when a task surfaces a pre-existing problem it deliberately does
  not fix. Include: file, rule/symptom, location, why deferred, and a safe-fix
  sketch.
- Remove an entry when the debt is paid (and note the fixing MR in the
  change-log).
