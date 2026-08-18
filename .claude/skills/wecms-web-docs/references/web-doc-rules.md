# wecms-web-docs — Documentation Rules

Content conventions for maintaining `wecms-web/docs/`. Read alongside `web-doc-structure.md`.

## Core principles

- **Doc-only.** Never touch application source. This tree is local R&D.
- **In-place by default.** Do not move or rename existing files unless explicitly asked.
- **Reuse over create.** A new file is the last resort. First try: extend an existing doc, add a section, or cross-link. **One carve-out:** the dated implementation record that docs-first requires (see below) is **always a new file** — never folded into an existing doc, and never skipped because an authoritative feature doc already exists.
- **Preserve content.** Never delete prose, tables, decisions, or open questions without confirmation. Mark superseded content as such rather than removing it. A dated implementation record is never deleted when work stalls — it moves to `Status: BLOCKED` or `Status: PARTIAL`.

## Docs-first implementation records

**Adopted 2026-08-17.** A meaningful behaviour-changing task (bug fix · issue · feature · audit /
parity review / investigation · functional behaviour / business-rule / API / UI / integration change ·
legacy-JEX parity resolution · functional refactor · SIT/UAT behaviour fix) gets its dated Markdown
record **created before the detailed investigation begins — and therefore before any application code is modified**, at `Status: IN PROGRESS`, and completed in
place afterwards.

> **HARD PRECONDITION — `NO DOC FILE → NO DETAILED INVESTIGATION → NO IMPLEMENTATION`.**
> Added 2026-08-18 after a governance test failed: a *"can you check this error?"* request produced a
> full technical investigation and no record. **Orientation** — reading enough to classify the task and
> place its record — is allowed before the file exists. **Investigation** — tracing the fault, following
> the component/hook chain, inspecting the request the UI sends, comparing against legacy, forming a
> root cause — is not. Create the record, **verify it exists**, report its path, and only then
> investigate; if it cannot be created, stop and report `DOCS-FIRST BLOCKED`. Never defer it with
> *"I'll document once I understand the issue"* — an unknown root cause is written as
> `Pending investigation`. Full rule: `wecms-web/CLAUDE.md` §2a.

**This is a project-wide TEAM rule, binding every developer and every tool** — manual work, Claude
Code, Cursor, other AI assistants, IDE tooling, scripts, pair programming — on every branch and
environment including `sit` / `uat` and PROD hotfixes. **One task → one canonical record per
repository**, owned by the task rather than by a developer: check for an existing record before adding
another, update it when the scope matches, and merge documentation conflicts like source code rather
than dropping someone else's updates.

**Authoritative rule + both templates: `wecms-web/CLAUDE.md` §"Docs-First Implementation Workflow
(MANDATORY)".**

**Placement (revised 2026-08-17)** — four record categories, one home each:

| Record type | Home |
|---|---|
| **BUG** (implemented behaviour is incorrect · something that worked is broken · behaviour differs from an accepted requirement · a defect causes wrong behaviour · parity behaviour is wrong and the task is to fix it) | `docs/bugs/` |
| **ISSUE** (needed work that is not clearly a product defect · operational / configuration correction · an unresolved implementation concern · a tracked problem that does not fit BUG cleanly — **when unclear, prefer ISSUE**) | `docs/issues/` |
| **FEATURE** (current + permanent 6-doc set — **structure unchanged**) | `docs/features/<domain>/<feature>/` |
| **AUDIT** (audit · parity review · verification · investigation · legacy comparison · migration verification · architecture review · historical validation · cross-feature analysis) | `docs/audits/` |

Dated bug/issue records never live inside `docs/features/`; the earlier "no global `bugs/` or `issues/`
folder" instruction is withdrawn. Never create duplicate BUG + ISSUE records for one task, never open a
bug/issue record merely because feature work is large, and never convert an audit into an
implementation record — a fix an audit triggers gets its own record in `docs/bugs/` / `docs/issues/`.

Content conventions specific to writing the record:

- **Wording before implementation** — use `PLANNED` · `PROPOSED` · `EXPECTED` · `TO BE IMPLEMENTED` ·
  `PENDING VERIFICATION`. Do **not** write "the system now does X" until it is verified. After
  implementation, rewrite to CURRENT facts. This is the same discipline as **CURRENT is a promise** in
  the status vocabulary.
- **Never present** planned behaviour as implemented · legacy JEX behaviour as current refactor
  behaviour · a test plan as a successful test result · an assumed root cause as a verified root cause.
- **Finalize the same file** — never a second "final" record. Keep planning history when it explains a
  design decision, but label **Initial plan** vs **Actual implementation** distinctly.
- **`Status: IN PROGRESS / COMPLETE / CLOSED / PARTIAL / BLOCKED` is the record's own lifecycle field**,
  independent of the five-word doc-classification vocabulary (`CURRENT` · `LEGACY` · `PLANNED` ·
  `HISTORICAL` · `SUPERSEDED`). It is not a sixth value; both axes may appear on one document.
- **Parity records** must distinguish legacy JEX behaviour · refactor behaviour before the fix · target
  parity behaviour · actual behaviour after implementation, and must record *what was actually
  compared* — never just "matched legacy".
- **Cross-repo (WEB + API)** work gets a record in **both** repositories before either side's code is
  modified. Keep frontend component detail out of the backend record and backend internals out of the
  frontend record, cross-link the pair, and make the cross-link recognizable as out-of-repo (carry the
  `wecms-api/…` prefix in the link text, or say "backend" in the prose).
- **Database work is backend-owned — no `.sql` in this repository.** Migration files and manual DBA
  scripts live in `wecms-api` (`src/main/resources/db/migration/` for a new table or DB function;
  `docs/sql/<YYYY>/` for existing-table changes, indexes, constraints, and any data change). A frontend
  record declares `## Database Impact` as `NONE (frontend) — database dependency only` plus a cross-link
  to the owning backend record, at the depth needed to explain the frontend dependency and no further —
  **never embed executable SQL**. A frontend task is not `COMPLETE` while the depended-on backend DB
  change is unapplied in the target environment. Writing or reviewing SQL is never executing it, and no
  DDL/DML is executed from a documentation task. Full rule: `wecms-web/CLAUDE.md` §12g · backend
  authority: `wecms-api/CLAUDE.md` §14.

## Implementation quality gate — writing the verification evidence

**Added 2026-08-18.** The record is opened by docs-first and **closed by the quality gate**: a
meaningful task is not complete when the code is written, only when it has been self-audited, tested,
verified, and honestly reported. **Authoritative rule: `wecms-web/CLAUDE.md` §14.** It binds every team
(**Cambodia · Vietnam · Korea · any future contributor**) and every tool. Content conventions for
writing that evidence:

- **`## Verification` is the closing section of every BUG / ISSUE record** — `### Automated Tests` ·
  `### Test Scenarios` · `### Regression Review` · `### Manual Verification`, applicable subsections
  only. It supersedes the older single `## Test Results` heading; records already using
  `## Test Results` keep theirs.
- **Result vocabulary is fixed:** `PASS` · `FAIL` · `NOT RUN` · `BLOCKED` · `NOT APPLICABLE`. Write the
  reason next to the non-PASS states (`NOT RUN — app not started`,
  `BLOCKED — backend DB script not applied`). **Never write `PASS` without evidence**, never restate a
  planned test case as a result, and **never record visual verification for a UI that was not actually
  run and inspected** — the same discipline as *"never present a test plan as a successful test
  result"* above.
- **State what was actually run**, not "tests pass": the command (`npm test`, or
  `npx vitest run components/<area>`) and the observed counts. There is **no CI test stage** in this
  repository, so the stated run is the only evidence that exists.
- **A bug record carries a `## Regression Test` block** — test file · test case · behaviour protected —
  or an explicit justification for why an automated regression test is impractical, plus manual
  evidence. *"No test needed"* alone is not acceptable.
- ⚠️ **Never document a test that Vitest does not collect.** Only `components/**` and `lib/**` are in
  the include globs; a test under `hooks/` or `app/` is silently skipped, so recording it as coverage is
  a false statement. See `wecms-web/docs/testing/testing-strategy.md`.
- **Failing tests are documented, not omitted**, and classified: caused by this change (the task is
  **NOT COMPLETE**) · pre-existing (with the evidence that it predates the work — the known
  `useEInvoiceScrape.test.ts` failures are the standing example) · environment · test data / stale mock ·
  unresolved.
- **Permanent vs dated:** scenarios describing how the screen behaves **now** go to
  `docs/features/<domain>/<feature>/test-scenarios.md`; the dated record keeps only this change's
  verification evidence. **Never duplicate a long scenario suite in both**, and never present a manual
  scenario as proof that an automated test exists.
- **Record only the checks that apply** — API-consumption contract · UI (route, loading, empty, error,
  validation, permission visibility, navigation, dialogs, localization EN/KO/VI, the request the UI
  sends) · DB **dependency only** (no `.sql` here) · legacy parity (naming what was compared) ·
  security & permissions · performance & concurrency · error handling. A page of "N/A" lines is
  boilerplate, not verification.
- **Final `Status:` must be honest** — `COMPLETE` only when every required part is done; otherwise
  `READY FOR MANUAL COMMIT` · `PARTIAL` · `BLOCKED` · `READY FOR SIT` · `READY FOR DEPLOYMENT`.
- **Cross-repo work is not complete because one side is green** — each record states its own side's
  verification and cross-links the other.

## Human approval gate — writing an investigation record

**Added 2026-08-18.** Authoritative rule: `wecms-web/CLAUDE.md` §16. Content conventions that follow
from it:

- **An investigation record ends at the gate, not at a fix.** Close it with the three dimensions:

  ```
  Investigation Status:  COMPLETE
  Approval Status:       PENDING
  Implementation Status: NOT STARTED
  ```

  That is a **valid final state** for a *"can you check this?"* request — `Audit: COMPLETE` never means
  the defect is fixed.
- **`## Recommended Implementation` is a recommendation, not a licence.** Write the proposed fix in full
  — component, approach, risk — and leave the code untouched.
- **The three dimensions are metadata, not a second vocabulary.** The record keeps its canonical
  `**Status:**` work-item field (itself independent of the five-word doc-classification vocabulary);
  map the dimensions onto it per §16k. `Approval Status: NOT REQUIRED` is the honest value when the
  user's own request carried the decision.
- **Never write an approval a person did not give.** *"OK"* · *"thanks"* · *"looks good"* · *"done"* are
  not approval. This is the same honesty rule as never writing `PASS` for an unrun test, or claiming
  visual verification for a UI that was never run.
- **A denied record keeps everything** — set `Approval Status: DENIED`, record *who decided and why*,
  preserve the full investigation, and never delete the file.
- **Investigation sections are risk-based like everything else**: use the headings that apply
  (`## Observed Behavior`, `## Frontend Trace`, `## Root Cause`, `## Evidence`,
  `## Missing Regression Coverage`, `## Recommended Implementation`, `## Risks`,
  `## Affected Repositories`, …) and omit the rest. An empty heading is noise, not thoroughness.
- **An approved fix gets its own record** in `docs/bugs/` / `docs/issues/` that **links to the audit** —
  do not duplicate the audit's body into it.

## Test-result records — writing the execution evidence

**Added 2026-08-18.** Authoritative rule: `wecms-web/CLAUDE.md` §17. Content conventions:

- **Location and filename:** `docs/testing/results/descriptive-name-test-result-YYYY-MM-DD.md` —
  subject first, lowercase kebab-case, ISO date; internal IDs in `**Issue:**`, never the filename.
  Never under `docs/bugs/`, `docs/issues/`, or `docs/audits/`.
- **The record is written from an execution, not from a plan.** Never author a `PASS` result before the
  run; never write `PASS` for a check that was not executed. Non-PASS states carry their reason
  (`NOT RUN — browser environment unavailable`, `BLOCKED — backend DBA script not applied`).
- **Record what was actually run** — the command (`npm test`, `npx vitest run components/<area>`), the
  observed counts, the environment, and the build under test. `Commit: NOT COMMITTED` is valid and
  expected, since the workflow ends at `READY FOR MANUAL COMMIT`.
- **Two repo-specific honesty traps:** a test placed under `hooks/` or `app/` is not collected by
  Vitest — documenting it as coverage is a false statement; and **no CI runs the suite**, so the
  recorded command is the only evidence of execution.
- **Separate `## Existing Failures` from `## New Failures`.** Pre-existing failures are declared with
  the evidence that they predate the work (the `useEInvoiceScrape.test.ts` failures are the standing
  example); a new failure means the task is not complete.
- **`## Not Tested` is a required honesty section** when relevant checks were skipped — say which, and
  why. Never claim visual verification for a UI that was not run.
- **Bug records answer the regression question in words**: *did a regression test cover the original
  defect? YES/NO*, with test file, test case, and result — or the reason it is impractical.
- **Link both ways**: the implementation record's `## Test Evidence` → the result; the result's
  `**Related Record:**` → the implementation record. Do not copy the result document into the record,
  and do not copy the record's narrative into the result.
- **Do not confuse the three documents:** `test-scenarios.md` specifies, the result record evidences,
  the bug/issue/feature record explains. List only the scenarios actually executed.
- **Cross-repo:** each repository writes its own result record for its own side; cross-link for
  integration behaviour rather than duplicating evidence.
- **Never back-fill history** — this applies to new and in-flight work only.

## Manual Git & deployment — the record ends at the handover point

**Added 2026-08-18.** Authoritative rule: `wecms-web/CLAUDE.md` §15. Documentation conventions that
follow from it:

```
QUALITY GATE COMPLETE  →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

- **`READY FOR MANUAL COMMIT` is the normal terminal `Status:` for AI-assisted work** — the change is
  complete and verified, and is waiting for a human to review, stage, commit, and push.
- **Never write `PUSHED` · `MERGED` · `DEPLOYED` · `SIT COMPLETE` · `UAT COMPLETE` · `PROD COMPLETE`**
  into a record unless the responsible team actually performed and verified that action. An action
  nobody performed is not a status — the same rule as "never write `PASS` without evidence". `SIT
  COMPLETE` means the deployed build was checked, not that a pipeline started.
- **Committing, pushing, merging, rebasing onto a shared branch, tagging, deploying, and promoting
  between environments are manual developer / team actions**, never something a documentation task or an
  AI assistant does on its own initiative. ⚠️ Here a push to `sit` / `uat` **is** a deployment. Read-only
  `git status` / `git diff` / `git log` inspection is expected and is not covered by that prohibition.
- **Do not infer permission** from *"done"*, *"finish it"*, *"deploy-ready"*, *"complete"*, or *"ready to
  merge"*; only an explicit request for one named operation, in the current conversation, authorizes it —
  and **SIT / UAT / PROD deployment stays manual regardless**.
- This binds every team — **Cambodia · Vietnam · Korea · future contributors** — and every tool.

## Menu/screen-aligned, feature-first

- Frontend docs follow the **actual WeCMS menu / screen structure**. Each screen doc maps to a real Next.js route/page and a real menu entry.
- Organized by the six feature domains: `auth`, `common`, `banking`, `payment`, `addon-service`, `settings`.
- A screen doc belongs under `wecms-web/docs/features/{domain}/`.

## Naming

- **Dated implementation / change records** use `descriptive-name-YYYY-MM-DD.md` — lowercase
  kebab-case, ISO date only, subject-descriptive (e.g.
  `approval-box-detail-navigation-fix-2026-08-17.md`,
  `transaction-history-memo-feature-2026-08-17.md`). **Never** a work-code, sequence, or vague
  filename: `a1-01-account-filter-fix.md`, `d1-d2-d3-check.md`, `k9-fix.md`, `p0-fix.md`,
  `p1-update.md`, `th-01-verification.md`, `task-03.md`, `issue-04.md`, `final-fix.md`,
  `new-feature.md`. **A developer name is equally forbidden** (`dev-a-fix.md`, `sokny-fix.md`,
  `mr-kang-update.md`) — one task, one canonical record, named after the subject rather than the person
  or session. Internal identifiers (`A1-01`, `K9`, `TH-01`, `P0`, `Task-03`, …) belong in the
  document metadata as `**Issue:**`, not the filename — keep one in a filename only when the exact
  identifier is an externally fixed contract, vendor specification, or machine-consumed name.
- Dates are ISO `YYYY-MM-DD` everywhere. Never `20260817`, `17-08-2026`, or `08-17-2026`. Never a fake
  date.
- All new identifier surfaces use **kebab-case slugs**: feature folders, doc filenames, Next.js route segments, View Setting screenIds, i18n key prefixes. Example: `banking-account-inquiry-vnd.md`, not `comm_0220_001.md`.
- Legacy JEX WSVC / menu ids are allowed **only** as JEX `file:line` citations or migration-traceability prose.
- **Feature slugs must match across systems** (JEX `docs/jex/features/`, backend `wecms-api/docs/features/`, frontend `wecms-web/docs/features/`).

## Screen-doc checklist (required sections)

Every feature/screen doc must document:

1. **Route / page** — Next.js route path + the menu/screen it maps to (link `references/page-mapping/`).
2. **Components** — key components (link `architecture/components/`).
3. **Filters** — search/filter controls, their fields and bindings.
4. **Table columns** — columns, labels, formatting, and View Setting behavior (link `architecture/view-setting/`).
5. **Dialogs / popups** — modals, confirmations, detail/edit popups.
6. **API integration** — backend endpoints consumed.
7. **Validation** — client-side validation rules.
8. **Related API docs** — cross-link to the matching `wecms-api/docs/` feature or api-spec doc.

Keep API contract detail in the backend docs and link to it — do not duplicate full request/response tables on the frontend side.

## Typography & UI consistency

- The live WeCMS system is the typography source of truth; the refactor consumes the Tailwind token scale defined in the root `CLAUDE.md`. Doc examples must reference semantic tokens (`text-page-title`, `text-table-header`, …), never raw `text-[14px]`.
- View Setting is a global/common feature — document per-screen column widths/visibility through the View Setting mechanism, not as one-off page logic.

## Cross-linking

- Use relative markdown links between docs.
- When you add a doc, link it from the nearest `README.md` index, from sibling docs, and from the matching backend feature doc.
- Cross-link `references/page-mapping/` entries (JEX `_view.jsp` → Next.js route) to/from the screen doc.

## Link validation

After every edit — and, for an implementation task, **before** the work is declared complete (part of
the docs-first Definition of Done, `wecms-web/CLAUDE.md` §3, and of the quality gate,
`wecms-web/CLAUDE.md` §14t):
- Run `node scripts/check-doc-links.mjs`. Green = in-repo broken 0, out-of-repo broken 0, unsafe 0.
- Verify each relative link in touched files points to an existing file, including moved / renamed doc
  references.
- Where practical, confirm heading anchors exist for `#anchor` links.
- Report broken or suspicious links; fix the ones you introduced. **Expected result: 0 broken links.**
- Out-of-repo links into `../wecms-api/` or the workspace root are a documented **dependency**, not a
  failure — never "fix" them by deletion.

## Final report (always)

Close every task with:
- Files **created** (full paths).
- Files **edited** (full paths + one-line summary).
- Cross-links added or updated (including backend cross-links).
- Open questions / TODOs touched.
- Link-validation result (clean / list of issues).
- For an implementation task: the dated record's path, its final `Status:`, and the verification
  evidence recorded — what was run, and what is `NOT RUN` / `BLOCKED` and why.
- **The handover, not a shipment:** close at `READY FOR MANUAL COMMIT`. Never commit, push, merge, tag,
  or deploy as part of finishing the task.
