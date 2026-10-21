---
name: wecms-web-docs
description: Maintain WECMS refactor frontend (Next.js) documentation under wecms-web/docs/. Use when creating, editing, restructuring, or cross-linking web/frontend docs — feature/screen specs, architecture, routes/components/hooks, references (page-mapping, legacy), audits, or UI design notes. Enforces menu/screen-aligned structure, reuse-before-create, and link validation.
---

# wecms-web-docs

Maintains the **refactor frontend** documentation tree at `wecms-web/docs/`. This is the Next.js R&D target. JEX trees and `docs/jex/` are read-only functional reference — never write there.

## When this skill applies

Trigger when the task involves any of:
- **Writing the dated implementation record that docs-first requires — before the detailed investigation, and therefore before any application code change** (see the GATE and "Docs-first implementation records" below) — bug fix, issue, feature, **audit / investigation**, functional-behaviour / business-rule / API / UI change, legacy-JEX parity resolution, functional refactor, SIT/UAT behaviour fix, or an integration change with observable effect.
- **Any request whose intent is to investigate, analyse, verify, diagnose, or review a defect or behaviour** — judged **semantically, never by the words used** (`wecms-web/CLAUDE.md` §18) — the record comes first, then the investigation (`wecms-web/CLAUDE.md` §2a).
- Creating or editing a frontend feature/screen spec (`wecms-web/docs/features/...`).
- Writing or updating architecture docs (components, hooks, routes, state, integrations, view-setting).
- Adding or revising references (page-mapping, legacy) or audits under `audits/`.
- Documenting a route/page, its components, filters, table columns, dialogs, API integration, or validation.
- Reorganizing or cross-linking anything under `wecms-web/docs/`.

Do **not** apply this skill to backend docs (`wecms-api/docs/` → use `wecms-api-docs`), to JEX docs (`docs/jex/`), or to application source code.

## ⛔ GATE — check this before any code-tracing workflow

**Added 2026-08-18 after a governance test failed.** A request to *check a Transfer-button error* was
answered with a full UI → API → DB → legacy investigation and **no record was ever created**.

**Before running any source-search, code-tracing, Git-history, or DB-inspection workflow for a
meaningful AUDIT / INVESTIGATION / BUG / ISSUE / FEATURE / PARITY REVIEW / BEHAVIOUR CHANGE, answer
one question:**

> **Has the required governed record been created?**

```
NO   → create it FIRST, verify the file exists, report its path — then investigate
YES  → proceed, and write findings into that record as they are found
FAIL → STOP. Report "DOCS-FIRST BLOCKED — documentation record could not be created."
       Do not continue the investigation.
```

```
NO DOC FILE  →  NO DETAILED INVESTIGATION  →  NO IMPLEMENTATION
```

**Orientation is allowed before the record; investigation is not.** Reading enough to know *which
screen this is and which folder the record belongs in* is orientation. Tracing the fault, following the
component/hook chain, inspecting the request the UI sends, comparing against legacy, or forming a root
cause is investigation — and it happens inside a record. Full rule: `wecms-web/CLAUDE.md` §2a.

**Never defer the record** with *"I'll investigate first and document once I understand it."* The record
starts at `Investigation Status: IN PROGRESS` with `## Root Cause — Pending investigation`; that is what
the status is for.

## Docs-first implementation records (mandatory)

**Adopted 2026-08-17.** For every meaningful behaviour-changing task, the **dated Markdown
implementation record is created BEFORE the detailed investigation begins — and therefore before any application code is modified**, with
`**Status:** IN PROGRESS`, and is completed in place afterwards. Documentation is part of the
implementation workflow, not an afterthought — never ask *"do you want me to document this?"* for a
clearly meaningful behaviour change.

> **This is a TEAM rule that this skill enforces — it is not an AI-only obligation.** Every developer
> contributing a meaningful behaviour-changing change to WeCMS follows docs-first, however the work is
> done (manually · Claude Code · Cursor · another AI assistant · IDE tooling · scripts · pair
> programming). When operating this skill, **check whether a record already exists for the task and
> update it** rather than adding a second one — **one task → one canonical record per repository**, and
> the document belongs to the task, not to a developer or a session. Team detail (responsibility,
> parallel work, review expectations, branch/environment independence, emergency-hotfix exception):
> `wecms-web/CLAUDE.md` §12 "Who must follow this".

**The authoritative rule is `wecms-web/CLAUDE.md` §"Docs-First Implementation Workflow (MANDATORY)"**
— mandatory order, Definition of Done, filename + date standards, both initial templates,
finalization rule, planned-vs-current wording, parity + cross-repo rules, exception list. Read it
before writing the record; if this skill and that section disagree, **CLAUDE.md wins**.

Quick reference:

- **Filename:** `descriptive-name-YYYY-MM-DD.md` — lowercase kebab-case, ISO date only (e.g. `approval-box-detail-navigation-fix-2026-08-17.md`). Never `a1-01-…`, `k9-fix.md`, `p1-update.md`, `task-03.md`, `final-fix.md`.
- **Internal issue / task IDs** (`A1-01`, `K9`, `TH-01`, `P0`, `Task-03`, …) go in the document metadata as `**Issue:**`, not in the filename.
- **Placement** *(policy revised 2026-08-17 — the earlier "no global `bugs/` or `issues/` folder" instruction is withdrawn)*:
  | Record type | Home |
  |---|---|
  | **BUG** | `docs/bugs/` |
  | **ISSUE** (non-bug: behavioural · operational · configuration · tracked implementation work) | `docs/issues/` |
  | **FEATURE** (current + permanent 6-doc set — structure unchanged) | `docs/features/<domain>/<feature>/` |
  | **AUDIT** (audit · parity review · verification · investigation · legacy comparison · migration verification · architecture review · historical validation · cross-feature analysis) | `docs/audits/` |

  Dated bug/issue records never go inside `docs/features/`. `docs/architecture/`, `docs/testing/`, `docs/references/` and the existing source-material locations (marked **PLANNED / PRE-IMPLEMENTATION**) remain **permanent reference** homes — a bug/issue touching them still records in `docs/bugs/` / `docs/issues/` and updates the permanent doc afterwards. A knowingly-deferred issue you are *not* fixing belongs in `docs/tech-debt.md`, not `docs/issues/`.
- **Classification is SEMANTIC — intent + verified nature, never keywords** (`wecms-web/CLAUDE.md` §18). Never route on the words "bug" / "check" / "issue" / "feature"; the same request in Korean, Vietnamese or Khmer classifies identically. Two separate questions: **Current Work Classification** (what the user authorized — usually `AUDIT` when implementation is not authorized) and **Finding Classification** (what the evidence proves — `BUG` / `ISSUE` / `FEATURE` / `NO DEFECT` / `UNRESOLVED`). When the nature of the problem is unclear, the answer is **AUDIT**, not ISSUE. The definitions below are **meanings, not triggers**:
- **BUG vs ISSUE:** BUG = implemented behaviour is incorrect · something that worked is broken · behaviour differs from an accepted requirement · a defect causes wrong behaviour · parity behaviour is wrong and the task is to fix it. ISSUE = needed work that is not clearly a product defect · operational/configuration correction · an unresolved implementation concern · a tracked problem that does not fit BUG cleanly. **When unclear, prefer ISSUE.** Never create duplicate BUG + ISSUE records for one task.
- **A record for a screen is not an audit, and an audit is never converted into one** — an audit records what was true on a date (`docs/audits/`); an implementation record explains a change (`docs/bugs/` / `docs/issues/`). If an audit leads to a fix, the audit stays put and a **separate** record is created.
- **A large feature is still a feature** — do not open a bug/issue record just because feature work is big.
- **`Status: IN PROGRESS / COMPLETE / CLOSED / PARTIAL / BLOCKED` is the record's own lifecycle field, not a sixth value** in the five-word status vocabulary (`CURRENT` · `LEGACY` · `PLANNED` · `HISTORICAL` · `SUPERSEDED`). Both axes may appear on the same document.
- **Finalize the same file** — never create a second "final" record. Move `Status:` off `IN PROGRESS`, and update the screen's permanent 6-doc set when the authoritative behaviour changed.
- **An existing authoritative feature doc does not remove this requirement.**
- **Database work is backend-owned — never write a `.sql` file into `wecms-web`** *(added 2026-08-17)*. Migration files and manual DBA scripts live in `wecms-api` (`src/main/resources/db/migration/` for a new table or DB function; `docs/sql/<YYYY>/` for existing-table changes, indexes, constraints, and any data change). A frontend record declares `## Database Impact` as `NONE (frontend) — database dependency only` plus a cross-link to the backend record, documented only to the depth needed to explain the frontend dependency; never embed executable SQL. A frontend task is not `COMPLETE` while the depended-on backend DB change is unapplied in the target environment. **Never execute DDL/DML** against any environment. Full rule: `wecms-web/CLAUDE.md` §12g · backend authority: `wecms-api/CLAUDE.md` §14.

> **This skill stays documentation-only.** Docs-first describes the *surrounding implementation
> workflow*: the record is written first (this skill's job), then the application code is changed
> **outside** this skill under the repo's own Refactor Rule and Figma-first rule. Hard rule 1 below is
> unchanged.

## Implementation quality gate — the record is finalized from evidence (mandatory)

**Added 2026-08-18.** Docs-first opens the task; the **quality gate closes it**. A meaningful task is
**not complete when the code is written** — it is complete when the change has been self-audited,
tested, verified, and honestly reported. **Authoritative rule: `wecms-web/CLAUDE.md` §14**
("Implementation quality gate"); if this skill and that section disagree, **CLAUDE.md wins**.

> **Team rule, not an AI rule.** It binds **Cambodia · Vietnam · Korea · any future WeCMS
> contributor**, and every tool — manual, Claude Code, Cursor, another AI assistant, IDE tooling,
> scripts, pair programming. **No team may run a weaker Definition of Done** (§14a).

What this means when operating this skill:

- **Do not finalize a record from the plan.** The `Status`, the `## Verification` section, and every
  "the screen now does X" statement are written from what the verification pass actually produced — the
  Git diff (§14b, §14s), the tests that were run (§14i), and the checks that were performed.
- **Every BUG / ISSUE record ends with `## Verification`** (§14g) — `### Automated Tests` ·
  `### Test Scenarios` · `### Regression Review` · `### Manual Verification`, applicable subsections
  only. This supersedes the older single `## Test Results` heading; records that already use
  `## Test Results` keep it.
- **Honest states only:** `PASS` · `FAIL` · `NOT RUN` · `BLOCKED` · `NOT APPLICABLE`. **Never write
  `PASS` without evidence, never turn a planned test case into a test result, and never record visual
  verification for a UI that was not actually run and inspected** (§14h, §14l) — the same discipline as
  the planned-vs-current wording rule and *"CURRENT is a promise"*.
- **A bug record documents its regression test** (`## Regression Test` — test file, test case, behaviour
  protected) or explains why an automated one is impractical and gives manual evidence (§14d). ⚠️ Note
  in the record that the test sits under `components/` or `lib/` — a test in `hooks/` or `app/` is
  **silently skipped** by the Vitest include globs (§14c).
- **Test scenarios split by permanence:** permanent screen behaviour → the screen's
  `docs/features/<domain>/<feature>/test-scenarios.md`; this change's evidence → the dated record. **Do
  not duplicate a long scenario suite in both**, and never present a manual scenario as proof that an
  automated test exists (§14f).
- **Record the verification that applies** — API-consumption contract · UI (route, loading, empty,
  error, validation, permission visibility, navigation, dialogs, localization EN/KO/VI, the request the
  UI actually sends) · DB **dependency only** (§12g — no `.sql` here) · legacy/JEX parity (what was
  actually compared, never just "matched legacy") · security & permissions · performance & concurrency ·
  error handling (§14k–§14q). Risk-based, not boilerplate: a checklist of "N/A" lines is noise (§14x).
- **Final status honesty:** `COMPLETE` only when every required part is genuinely done; otherwise
  `PARTIAL` · `BLOCKED` · `READY FOR SIT` · `READY FOR DEPLOYMENT` (§14u).
- **Cross-repo:** one repository being green does not complete the task — both sides verify and the
  integration is verified end-to-end (§14r).
- Reviewer checklist: **§14v**. AI-specific enforcement (never stop at "the code compiles"): **§14w**.

> **This skill still does not run tests or modify source.** It records what the surrounding
> implementation workflow produced, and it **refuses to write an outcome that was not observed** — an
> unrun test is documented as `NOT RUN`, never as `PASS`.

## Human approval gate — investigation does not authorize implementation (mandatory)

**Added 2026-08-18. Authoritative rule: `wecms-web/CLAUDE.md` §16.**

```
INVESTIGATE → DOCUMENT FINDINGS → HUMAN APPROVAL → implement → quality gate
  → READY FOR MANUAL COMMIT → HUMAN Git / deployment process
```

- **Classify the request before doing anything.** *Check · investigate · review · audit · analyze ·
  design* is **class A**: documentation and read-only inspection only, ending at **STOP for human
  approval**. *"Investigate and fix"* (B) and *"implement / fix this"* (C) already carry approval.
  **Ambiguous → class A.** Docs-first applies to all three.
- **Class A never authorizes**: modifying source · writing implementation tests · modifying SQL,
  migrations, or configuration · committing · pushing · merging · deploying.
- **Prove docs-first with the file path**, not the phrase. Report the record, classification, and the
  three statuses (§16b).
- **This skill's own placement rules already fit**: an investigation goes to `docs/audits/`; the
  **approved** fix gets its own record in `docs/bugs/` / `docs/issues/` that **links to the audit as
  evidence** — never a copy, never a conversion (§16i). **`Audit: COMPLETE` never means the defect is
  fixed** (§16n).
- **Write the three dimensions into the record metadata** — `Investigation Status` · `Approval Status` ·
  `Implementation Status` — and map them onto the existing canonical `Status:` work-item field per §16k.
  This is **not** a second status vocabulary, and it is unrelated to the five-word doc-classification
  vocabulary.
- **Never record an approval that a person did not give.** *"OK"* · *"thanks"* · *"looks good"* ·
  *"done"* · *"understood"* · *"check again"* are not approval (§16e). `Approval Status: NOT REQUIRED`
  is the honest value for class-B/C work.
- **A denied record is preserved, never deleted** — write `Approval Status: DENIED`, keep every piece of
  evidence, stop (§16g).
- **A Figma design task is class A by default** — read the frames, produce the spec, stop. *"Build this
  screen"* is class C. The Figma-first rule applies to both.
- **Implementation approval ≠ backend DB execution approval** (§16m) **≠ permission to push** (§15).

> **For an investigation-only task, this skill's deliverable is the record and the recommendation —
> and then it stops.** Do not ask *"shall I continue?"* as a nudge, and do not start implementing while
> waiting for the answer.

## Test-result records — durable execution evidence (mandatory)

**Added 2026-08-18. Authoritative rule: `wecms-web/CLAUDE.md` §17.**

- **When verification actually runs on a meaningful change, write a test-result record** at
  `docs/testing/results/descriptive-name-test-result-YYYY-MM-DD.md` — subject first, ISO date, never
  `test.md` / `result.md` / `p0-test.md` / `dev-a-test.md`.
- **Never in `docs/bugs/`, `docs/issues/`, or `docs/audits/`**, and never a second competing location.
  `docs/testing/testing-strategy.md` keeps its own job (what the Vitest setup *is*); `results/` is per
  **implemented change**.
- **Link both directions** — the implementation record gains `## Test Evidence` pointing at the result;
  the result's `**Related Record:**` points back. The record's `## Verification` (§14g) becomes the
  **summary**; command, counts, environment, build under test, and pre-existing-vs-new failures live in
  the result record. Validate with `node scripts/check-doc-links.mjs`.
- **Three documents, three jobs:** `test-scenarios.md` = the **specification** · a test-result record =
  the **evidence** · the bug/issue/feature record = **why the change happened**. Never let one stand in
  for another.
- **Never pre-write a `PASS` record before the tests run**, and never write `PASS` for a check that was
  not executed — `NOT RUN` / `BLOCKED` / `NOT APPLICABLE` **with the reason**. `Commit: NOT COMMITTED`
  is a valid, honest entry (§15), and **visual verification is never claimed for a UI that was not run**
  (§14l).
- **Two repo-specific traps to record honestly:** a test under `hooks/` or `app/` was never collected by
  Vitest (that is `NOT RUN`, not `PASS`), and **no CI runs the suite** — so the command written in the
  record is the only evidence that anything executed.
- **Bug records answer the regression question explicitly** — *did a regression test cover the original
  defect? YES/NO* + test file, test case, result, or the reason why not (§17f).
- **Status follows evidence** (§17h): `Implementation Status: COMPLETE` requires test evidence that
  supports it; failing tests mean `Test Status: FAIL` + `BLOCKED` / `PARTIAL`. Passing tests are not a
  deployment — and here a push to `sit` / `uat` *is* the deployment.
- **Audit-only work needs no test-result record** (§17j) — diagnostic tests run as investigation
  evidence belong inside the audit.
- **Not retroactive** (§17m): do **not** back-fill result files for historical work. Report an in-flight
  gap as a **TEST RESULT MIGRATION CANDIDATE** instead.

Folder contract: `docs/testing/results/README.md`.

## Manual Git & deployment — stop at READY FOR MANUAL COMMIT (mandatory)

**Added 2026-08-18.** The documented work ends at the handover point, not at a push.

```
QUALITY GATE COMPLETE  →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

**Authoritative rule: `wecms-web/CLAUDE.md` §15 "Manual Git & deployment rule".**

> ⚠️ **In this repository a push IS a deployment** — CI runs on `sit` and `uat` and triggers the
> downstream build/deploy pipeline. Pushing either branch is a release action against a real
> environment.

- **Never** `git commit` · `git push` · `git merge` · `git rebase` onto a shared branch · create or push
  a tag · push to `sit` / `uat` / `prod` · trigger a deployment · promote between environments · run a
  release command **on your own initiative**. These are **manual developer / team responsibilities** —
  for every tool and every team (Cambodia · Vietnam · Korea · future contributors).
- **Read-only Git is fine and expected** — `git status`, `git diff`, `git log`, `git branch` back the
  self-audit (§14b, §14s).
- **Only an explicit request in the current conversation** ("commit this", "push this branch", "merge
  this branch") authorizes **that one operation** — it never extends to the operation that usually
  follows, nor to the rest of the session, and **SIT / UAT / PROD deployment stays manual regardless**.
  **Do not infer permission** from *"done"*, *"finish it"*, *"deploy-ready"*, *"complete"*, or *"ready
  to merge"*.
- **Record the honest terminal state.** `READY FOR MANUAL COMMIT` is the normal end state of AI-assisted
  work; `READY FOR DBA` · `READY FOR SIT` · `READY FOR UAT` · `READY FOR DEPLOYMENT` · `PARTIAL` ·
  `BLOCKED` cover the rest. **Never write `PUSHED` · `MERGED` · `DEPLOYED` · `SIT COMPLETE` ·
  `UAT COMPLETE` · `PROD COMPLETE` into a record unless the responsible team actually performed and
  verified the action** — and `SIT COMPLETE` means the deployed build was checked, not that a pipeline
  started.

## Hard rules

1. **Never modify application source code.** Documentation only.
2. **Never move or reorganize existing docs** unless the user explicitly asks. Default to in-place edits.
3. **Write only under `wecms-web/docs/`** (plus the workspace cross-cutting folders the root CLAUDE.md allows: `docs/_shared/`, `docs/security/`, `docs/testing/`, `docs/bug-reports/`). Never write into `wecms-api/docs/` or `docs/jex/`.
4. **Audit before creating.** Never create a new doc without first checking whether one already covers the topic. **Exception — the dated implementation record required by docs-first is always a new file**, even when an authoritative feature doc already covers the topic; audit first to place it correctly and cross-link it, not to skip creating it.
5. **Reuse, cross-link, and preserve.** Extend existing docs; link related docs; never delete content without confirmation. Same exception as rule 4: a dated implementation record is never folded into an existing doc to avoid a new file, and is never deleted when work stalls — it moves to `Status: BLOCKED` / `Status: PARTIAL`.
6. **Identifier naming = kebab-case slugs**, not legacy JEX WSVC ids (`firm-banking-settings`, never `comm_0220_001`). Next.js routes, feature folders, and screenIds all use slugs. Legacy ids appear only as JEX file:line citations or migration-traceability prose.
7. **Feature names match across systems** — a frontend feature slug must match its JEX and backend counterparts (e.g. `view-setting`).

## Structure principle — menu/screen-aligned, feature-first

Frontend documentation **must follow the actual WeCMS menu / screen structure**. Each documented screen corresponds to a real Next.js route/page and a real menu entry, grouped under the six feature domains:
`auth`, `common`, `banking`, `payment`, `addon-service`, `settings`.

Every feature/screen doc lives under `wecms-web/docs/features/{domain}/`.

## Folder structure

```
wecms-web/docs/
├── README.md
├── frontend-project-rules.md
├── workflow.md  prd.md  permissions.md  tech-stack.md  ui-component-guide.md
├── features/              # feature-first / screen-aligned specs (6-doc set per screen)
│   ├── auth/  common/  banking/  payment/  addon-service/  settings/
├── bugs/                  # ADDED 2026-08-17 — dated BUG implementation records (docs-first)
├── issues/                # ADDED 2026-08-17 — dated ISSUE implementation records (non-bug)
├── architecture/
│   ├── components/  hooks/  routes/  state-management/
│   ├── integrations/  view-setting/
├── audits/                # CANONICAL home for frontend audits — never under features/
├── references/
│   ├── api-contract.md    # FRONTEND API CONSUMPTION CONTRACT (envelope/auth/401/casing/paging)
│   ├── page-mapping/      # JEX _view.jsp → Next.js route
│   └── legacy/            # vendor/legacy captures — NOT application source
├── e-sign/                # PRE-IMPLEMENTATION source material; no e-sign code exists
├── testing/               # testing-strategy.md = the real Vitest setup + what is absent
├── tech-debt.md
└── bug-reports/  change-log/   # pointer stubs (trackers live outside this repo)
```

> Map refreshed 2026-08-17: `archive/` was deleted 2026-06-23 and `references/screen-flows/`
> collapsed 2026-08-17; `audits/`, `e-sign/`, `tech-debt.md`, `bug-reports/`, `change-log/` were
> missing. See `references/web-doc-structure.md` for the full map and the "facts documentation must
> not contradict" list.
>
> Added 2026-08-17 (P2): `references/api-contract.md` and `testing/testing-strategy.md`. The
> **status vocabulary** (CURRENT / LEGACY / PLANNED / HISTORICAL / SUPERSEDED) is normatively defined
> in `wecms-web/docs/README.md` § Status vocabulary and mirrored in
> `references/web-doc-structure.md`. Validate links with `node scripts/check-doc-links.mjs`.

See `references/web-doc-structure.md` for placement rules and `references/web-doc-rules.md` for content conventions.

## What a frontend feature/screen doc must include

Every screen doc should cover, in order:

1. **Route / page** — the Next.js route path and the menu/screen it maps to (link page-mapping).
2. **Components** — key components used (link architecture/components).
3. **Filters** — search/filter controls and their bindings.
4. **Table columns** — column list, labels, formatting, View Setting behavior.
5. **Dialogs / popups** — modals, confirmations, detail popups.
6. **API integration** — which backend endpoints it calls.
7. **Validation** — client-side validation rules.
8. **Related API docs** — cross-link to the matching `wecms-api/docs/` feature/api-spec doc.

## Required workflow

Follow these steps in order for any doc task:

0. **If this is a behaviour-changing implementation task, write the dated record first.** Inspect the source, inspect the docs, inspect tests/Git history where needed, place the record per the placement rules, set `**Status:** IN PROGRESS`, and document the requirement · verified current behaviour · target behaviour · scope · out of scope · initial investigation · proposed plan · testing plan — **before** any application code is modified. Full order + templates: `wecms-web/CLAUDE.md` §"Docs-First Implementation Workflow (MANDATORY)".
0b. **First decide whether implementation is authorized at all.** A request to *check · investigate ·
    review · audit · analyze · design* is investigation-only: create the record, investigate, document
    the findings and the **recommended** implementation, set `Approval Status: PENDING`, and **stop for
    a human decision** — do not modify source, tests, SQL, migrations, or config
    (`wecms-web/CLAUDE.md` §16).
0c. **The record comes before the investigation, not after it.** Create it, **verify the file exists**,
    and report its path *before* the first code-tracing step (the GATE above · `wecms-web/CLAUDE.md`
    §2a). Then write every finding into that same record as it is discovered — the chat summarizes the
    file, it never replaces it. If the record cannot be created, **stop** and report
    `DOCS-FIRST BLOCKED`.
1. **Audit existing docs first.** Glob/grep `wecms-web/docs/` (especially `features/{domain}/`, `references/page-mapping/`, and `README.md` index files) for the topic. List what already exists before writing anything.
2. **Reuse / move / cross-link before creating.** Prefer extending an existing doc. If a new doc is truly needed, place it per the structure rules and link it from the relevant `README.md` index and from sibling docs (including the matching backend doc). *(Does not apply to a dated implementation record — that is always its own new file; see Hard rules 4–5.)*
3. **Preserve open questions.** Frontend open questions / TODOs embedded in docs must not be deleted or marked resolved without explicit user confirmation. Add new ones freely; the human closes them.
4. **Validate links.** Run `node scripts/check-doc-links.mjs` (zero-dependency, CommonMark-aware: balanced parens, `app/(dashboard)/` paths, fenced-code masking, three-tier classification). It exits 1 on any broken link. Green = in-repo broken 0, out-of-repo broken 0, unsafe 0. Out-of-repo links into `../wecms-api/` or the workspace root are a documented **dependency**, not a failure — do not "fix" them by deletion. Use `--detail` to list findings and `--standalone` to model a clone without the sibling trees. Report the counts.
4b. **For an implementation task, finalize the record from the quality gate's evidence.** The
    `## Verification` section, the `## Regression Test` block on a bug record, the updated
    `test-scenarios.md`, and the final `Status:` all come from what was actually audited, run, and
    observed — never from the plan. Unrun checks are written as `NOT RUN` / `BLOCKED`, and visual
    verification is claimed only if the UI was really run. Full rule: `wecms-web/CLAUDE.md` §14.
5. **Provide a final report, and hand over — do not ship.** Summarize files created/edited, cross-links added (incl. backend cross-links), open questions touched, and link-validation results. For an implementation task, also report the dated record's path, its final `Status:`, and the verification evidence it now carries (what was run, and what was `NOT RUN` / `BLOCKED` and why). **Close at `READY FOR MANUAL COMMIT`** — never commit, push, merge, tag, or deploy as part of finishing the task, and never push `sit` / `uat` (which deploys) without an explicit request (`wecms-web/CLAUDE.md` §15).

## References

- `references/web-doc-rules.md` — content conventions, naming, the screen-doc checklist, cross-linking.
- `references/web-doc-structure.md` — directory map and placement decision guide.
