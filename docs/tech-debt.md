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

## TD-2 — Two unreferenced frontend Excel writers (`xlsx-js-style` residue)

- **Logged:** 2026-08-17
- **Files:** [../lib/reportExcel.ts](../lib/reportExcel.ts) · [../lib/dailyCashExport.ts](../lib/dailyCashExport.ts)
- **Symptom:** both import `xlsx-js-style` and build workbooks client-side, which CLAUDE.md §13b
  forbids on an export path. Neither is reachable:
  - `exportReportExcel` (`lib/reportExcel.ts`) has **zero importers**.
  - `exportDailyCashExcel` (`lib/dailyCashExport.ts`) is **never imported** — `DailyCashPage` imports
    only the sibling `printDailyCashReport` from that file.
- **Status:** **dead code**, verified 2026-08-17. Every live export path calls the backend, so §13b
  is satisfied in behaviour; these are residue from that migration. `reportExcel.ts`'s docblock still
  claims it is "used by every Banking > Reports page", which is stale, and its "Departure from
  CLAUDE.md §13b … pragmatic interim" note now describes a state that no longer exists.
- **Why not fixed here:** surfaced during a documentation-remediation pass whose scope excluded
  source changes. Deleting `reportExcel.ts` outright and dropping `exportDailyCashExcel` (keeping
  `printDailyCashReport`) is behaviour-neutral, but it is still a source edit and belongs in its own
  MR with a test run.
- **Safe fix:** (1) delete `lib/reportExcel.ts`; (2) remove `exportDailyCashExcel` +
  `reportTimestampSuffix` and the `xlsx-js-style` import from `lib/dailyCashExport.ts`, keeping
  `printDailyCashReport` and its `escapeHtml`/`formatAmount` imports; (3) drop `xlsx-js-style` from
  `package.json` **only after** confirming no other importer — `xlsx` itself must stay, it is used
  for upload parsing; (4) run `npm run lint`, `npx tsc --noEmit`, `npm test`.
- **Do not** wire a new call site to either function while this entry is open.
- **Reference:** [references/api-contract.md § XLSX generation policy](references/api-contract.md#xlsx-generation-policy)
  · CLAUDE.md §13b "Compliance audit (2026-08-17)".

---

## TD-3 — `useEInvoiceScrape.test.ts` fails on a stale `vi.mock` factory

- **Logged:** 2026-08-17
- **File:** [../components/addon/sales-einvoices/useEInvoiceScrape.test.ts](../components/addon/sales-einvoices/useEInvoiceScrape.test.ts)
- **Symptom:** `npm test` reports **11 failed / 141 passed (152)** across **1 failed / 13 passed (14)**
  files. Every failure is in this one file:
  ```
  [vitest] No "decryptEInvoiceEngineData" export is defined on the "@/lib/api/addon" mock.
  ```
- **Cause:** the test replaces the whole module with a two-export factory:
  ```ts
  vi.mock("@/lib/api/addon", () => ({
      scrapeEInvoices: h.scrapeEInvoices,
      scrapeEInvoiceDetails: h.scrapeEInvoiceDetails,
  }));
  ```
  A `vi.mock` factory is a whitelist. `decryptEInvoiceEngineData` was later added to
  [../lib/api/addon.ts](../lib/api/addon.ts) and is called by the hook under test, so it resolves to
  `undefined`. **Test rot, not a source defect** — the production path is unaffected.
- **Why not fixed here:** surfaced during a documentation-remediation pass whose scope excluded
  source/test changes.
- **Safe fix:** switch the factory to preserve real exports and stub only what the test drives:
  ```ts
  vi.mock("@/lib/api/addon", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/api/addon")>()),
      scrapeEInvoices: h.scrapeEInvoices,
      scrapeEInvoiceDetails: h.scrapeEInvoiceDetails,
  }));
  ```
  Then confirm the 11 cases assert what they intend (several expect a thrown `"persist boom"` that is
  currently masked by the mock error).
- **Aggravating factor:** **no CI stage runs the tests** — `.gitlab-ci.yml` is a downstream trigger
  only — so a red suite does not block a merge or a deploy. That is why this went unnoticed.
- **Reference:** [testing/testing-strategy.md § The suite is not currently green](testing/testing-strategy.md#the-suite-is-not-currently-green).

---

## How to use this file

- Add an entry when a task surfaces a pre-existing problem it deliberately does
  not fix. Include: file, rule/symptom, location, why deferred, and a safe-fix
  sketch.
- Remove an entry when the debt is paid (and note the fixing MR in the
  change-log).
