# wecms-web — Documentation

Frontend documentation for the **Next.js 16** side of the WeCMS JEX → Spring/Next.js refactor (`wecms-web`). A client-rendered SPA inside the App Router — no SSR data fetching, no server actions. Business data comes from `wecms-api` _(external reference — not included in this repository)_ over HTTP; see [Architecture facts](#architecture-facts) for the one route handler that exists in source and why it is not on the runtime path.

> **Deployment.** This is **not** a local-only project. GitLab CI deploys from the `sit` and `uat` branches — see [Environments](#environments) below and [../README.md](../README.md) for the evidenced per-environment values.

> ⚠️ **Next.js 16 differs from earlier versions** — read [../AGENTS.md](../AGENTS.md) before writing code.

> **Reorganized 2026-06-01 — feature-first.** Docs are now organized by the **live WeCMS menu** so developers, QA, and new team members navigate by the product they see. Per-screen design lives under [features/](features/); reference material under [references/](references/). *(The `archive/` folder was removed 2026-06-23 by project decision — it held only an empty placeholder.)*

> **Field-name casing (project-wide standard).** Legacy JEX APIs used UPPER_SNAKE field names. The Spring/Next.js refactor intentionally uses lowercase snake_case JSON field names via global Jackson SNAKE_CASE configuration. This is an approved modernization under CTO directive dated 2026-05-08 and is not a legacy parity gap. The frontend mirrors this: snake_case wire types in `lib/types/api.ts`, camelCase in-memory after `lib/api/mappers.ts`. A source-verified backend + frontend inventory exists on the `wecms-api` side as `field-casing-parity-audit-2026-06-06.md` (under `wecms-api/docs/audits/historical/`); it resolves only when both repos are checked out side by side.

## Architecture facts

Verified against current source, 2026-08-17. These three statements are the ones most often
mis-stated in older docs.

| Fact | Evidence |
|---|---|
| **No SSR data fetching, no server actions.** Every screen is client-rendered; `"use server"` appears nowhere in the tree. | grep over `app/`, `components/`, `lib/`, `hooks/` |
| **Business APIs are consumed from `wecms-api`**, never implemented here, via the shared Axios instance whose `baseURL` is `NEXT_PUBLIC_API_BASE_URL`. | [`lib/axios.ts`](../lib/axios.ts) + the 33 per-domain clients in [`lib/api/`](../lib/api/) (35 `.ts` files incl. `mappers.ts` + `useApiData.ts`). Consumption contract: [references/api-contract.md](references/api-contract.md) |
| **One Next.js route handler exists in source** — `POST` [`app/api/v1/payment/overseas-payment/excel-preview/route.ts`](../app/api/v1/payment/overseas-payment/excel-preview/route.ts) (added 2026-05-14), which parses an uploaded overseas-payment XLSX. **It is not on the runtime path**: its only would-be caller, `previewOverseasPaymentExcel()` in [`lib/api/payment.ts`](../lib/api/payment.ts), posts the same path through the shared Axios instance — so the request reaches the **`wecms-api` origin**, not Next.js — and unwraps the `ApiResponse<T>` envelope, which the handler does not emit. Treat it as a superseded local prototype. | Route file + `lib/api/payment.ts` + `lib/api/common/unwrap.ts` |

`wecms-web` is a frontend. It is **not** a backend and must not become one — new endpoints belong in
`wecms-api`.

## Environments

`wecms-web` deploys. Older docs describing it as "local-only R&D with no deploy target" are
**withdrawn**. Evidence: [`.gitlab-ci.yml`](../.gitlab-ci.yml), [`.env.example`](../.env.example),
[`.env.uat.example`](../.env.uat.example), and the `sit` / `uat` branches on `origin`.

| Env | Frontend | Backend origin | Trigger |
|---|---|---|---|
| **LOCAL** | `http://localhost:3000` | `http://localhost:8080` | Manual (`npm run dev`) |
| **SIT** | `wecms.kosign.dev` (the NXiSAS-licensed origin) | Not committed here | Push to `sit` |
| **UAT** | `https://test2.wecms.vn` (host `42.96.47.184`) | `https://test2-api.wecms.vn` | Push to `uat` |
| **PROD** | **Not evidenced in this repository** — no prod env file, CI rule, or branch. Do not infer one. | — | — |

CI here is a **trigger only** — it hands off to a downstream pipeline in another GitLab project
(`$URL` / `$FILE` CI variables); the build and deploy steps are not in this repository. Full
per-variable detail: [../README.md](../README.md) § Environments.

**The "Trigger" column is a human action.** `Push to sit` / `Push to uat` **is** the deployment, so
those pushes — and every commit, merge, and tag leading to them — are performed **manually by the
developer or the team**. No AI assistant pushes a deploying branch on its own initiative; AI-assisted
work stops at **`READY FOR MANUAL COMMIT`**. See
[Manual Git & deployment](#manual-git--deployment--the-workflow-ends-at-ready-for-manual-commit) below
and [../CLAUDE.md](../CLAUDE.md) §15.

## Start Here

> **You do not need JEX knowledge to begin development.** This is a **Next.js 16** codebase —
> start from the rules, the feature docs, and the code. JEX is **historical / functional reference only**
> (it tells you *what* a screen must do); you consult it only when porting a screen.
>
> **Source-of-truth split:** JEX is the **functional / behavioral** source of truth (*what* the screen does);
> the **Next.js code is the implementation source of truth** (*how* it is built). Build from the Next.js code,
> never from JEX.

**New to this frontend? Read in this order.** All documentation is in **English**. WeCMS is a refactor of the
legacy **JEX** system, so a few business terms are Korean (결재라인 → *approval line*, 사용용도 → *purpose*);
unfamiliar JEX/Korean terms are explained in the backend glossary (linked below) — you never have to read JEX
itself to get started. This guide is for new joiners, including developers in **Cambodia** and **Vietnam**.

1. **[../AGENTS.md](../AGENTS.md)** — ⚠️ Next.js 16 differs from earlier versions; read this first.
2. **[../CLAUDE.md](../CLAUDE.md)** + **[frontend-project-rules.md](frontend-project-rules.md)** — the frontend rules (components, tokens, dialogs, naming).
3. **[tech-stack.md](tech-stack.md)** — stack & versions · **[ui-component-guide.md](ui-component-guide.md)** — component/layout architecture.
4. **[README.md](README.md)** — *(this file)* — how the docs are organized.
5. **[Implementation records (docs-first)](#implementation-records-docs-first)** — ⚠️ **read before your
   first change.** Every developer on the team writes the dated record **before** implementing a
   meaningful behaviour change — this is a project rule, not an AI-only rule, and it applies however
   you write the code. Read the
   **[implementation quality gate](#implementation-quality-gate--verify-before-complete)** in the same
   pass: the task is not finished when the code is written, it is finished when the change has been
   audited, tested, verified, and honestly reported.
6. **Feature/screen design** — open the screen you're working on: `features/<module>/<screen>/README.md`
   (e.g. [features/settings/contacts/README.md](features/settings/contacts/README.md)). Each screen folder has the
   same 6-doc set (README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios).
7. **`screen-flow.md`** then **`ui-specification.md`** — the UX flow and the visual/layout spec.
8. **`api-consumption.md`** — which `wecms-api` endpoints the screen calls and how the wire data maps to UI state.
9. **[references/api-contract.md](references/api-contract.md)** — how this client consumes HTTP in general:
   the `ApiResponse<T>` envelope, `status.error`, `unwrap()`, `ApiCallError`, JWT transport, 401 /
   session-expiry handling, the snake_case ↔ camelCase boundary, pagination, and the binary/download
   exceptions. Read it once and every screen's `api-consumption.md` becomes easier.
10. **[testing/testing-strategy.md](testing/testing-strategy.md)** — how to run and write tests here.
11. **Backend contract + parity history** — the API spec and the backend-side audits are maintained in
    the `wecms-api` repository. It is a **separate repo**: relative links to it resolve only when both
    repos are checked out side by side.

**Also useful:** [tech-debt.md](tech-debt.md) (knowingly-deferred issues) · [audits/](audits/README.md) (parity + readiness findings) · [workflow.md](workflow.md) · [permissions.md](permissions.md) · [prd.md](prd.md).

## Implementation records (docs-first)

**Adopted 2026-08-17.** Every meaningful behaviour-changing task — bug fix, issue, feature, audit /
parity review / investigation, functional behaviour / business-rule / API / UI / integration change,
legacy-JEX parity resolution, functional refactor, or SIT/UAT behaviour fix — gets a **dated Markdown
implementation record created BEFORE the detailed investigation begins — and therefore before any application code is modified**, with `**Status:** IN
PROGRESS`. The record is then completed in place after implementation and its status moved to
`COMPLETE` / `CLOSED` / `PARTIAL` / `BLOCKED`.

> **⛔ HARD PRECONDITION — `NO DOC FILE → NO DETAILED INVESTIGATION → NO IMPLEMENTATION`**
> *(strengthened 2026-08-18 after a governance test failed — a "can you check this error?" request
> produced a full UI → API → DB → legacy investigation and no record).*
> **Orientation** — reading enough to classify the task and place its record — is allowed before the
> file exists. **Investigation** — tracing the fault, following the component/hook chain, inspecting
> the request the UI sends, comparing against legacy, forming a root cause — is not. Create the record,
> **verify it exists**, report its path, and only then investigate; write findings into that same record
> as they are found. An unknown root cause is written `Pending investigation` — never a reason to
> postpone the record. If the record cannot be created, **stop** and report `DOCS-FIRST BLOCKED`. Full
> rule: [../CLAUDE.md](../CLAUDE.md) §2a.

> **This applies to the whole team, not just to AI sessions.** Every developer contributing a
> meaningful behaviour-changing change follows docs-first — **manually, with Claude Code, with Cursor,
> with any other AI assistant, with IDE tooling, via scripts, or pair programming.** No one is exempt
> because they did not use an AI tool, because the work is on their own branch, because the change is
> small but behaviour-changing, or because it is frontend-only. The requirement belongs to the
> **project**, not to a person or a tool. AI assistants **enforce** this rule; they do not own it.
>
> The **developer who starts the change** is responsible for ensuring the record exists before code
> implementation begins. **One task → one canonical record per affected repository** — if a second
> developer continues the work, they update the *same* record, never add a per-person copy. The rule
> holds on every branch and environment, **including `sit` / `uat` and PROD hotfixes**. Team detail
> (parallel work, review expectations, the emergency-hotfix exception):
> [../CLAUDE.md](../CLAUDE.md) §12 "Who must follow this".

The full rule — mandatory order, Definition of Done, filename + date standards, both initial
templates, planned-vs-current wording, the parity and cross-repo rules, and the exception list — is
**authoritative in [../CLAUDE.md](../CLAUDE.md) §"Docs-First Implementation Workflow (MANDATORY)"**.
This section is a pointer; if the two disagree, `CLAUDE.md` wins.

- **Filename:** `descriptive-name-YYYY-MM-DD.md`, lowercase kebab-case, ISO date only — e.g.
  `approval-box-detail-navigation-fix-2026-08-17.md`. Never a work-code or sequence filename
  (`a1-01-…`, `k9-fix.md`, `p1-update.md`, `task-03.md`, `final-fix.md`).
- **Internal issue / task IDs** (`A1-01`, `K9`, `TH-01`, `P0`, `Task-03`, …) go in the document
  metadata as `**Issue:**`, not in the filename.
- **Where it goes** *(placement policy revised 2026-08-17)* — four record categories, one home each:
  | Record type | Home |
  |---|---|
  | **BUG** — dated bug-fix implementation record | [bugs/](bugs/) |
  | **ISSUE** — dated non-bug issue / behavioural / operational / tracked implementation record | [issues/](issues/) |
  | **FEATURE** — current + permanent screen documentation (**structure unchanged** — the 6-doc set) | [features/](features/)`<domain>/<feature>/` |
  | **AUDIT** — audit · parity review · verification · investigation · legacy comparison · migration verification · architecture review · historical validation · cross-feature analysis | [audits/](audits/README.md) |

  Dated bug/issue records **no longer** live inside the feature folder; the earlier "no global `bugs/`
  or `issues/` folder" instruction is **withdrawn**. [architecture/](architecture/) ·
  [testing/](testing/) · [references/](references/) and the existing source-material locations (e.g.
  [e-sign/](e-sign/README.md), marked **PLANNED / PRE-IMPLEMENTATION**) keep their existing purposes as
  **permanent reference** material — a bug/issue that touches one of them still gets its dated record in
  `bugs/` / `issues/` and the permanent doc updated afterwards. A knowingly-deferred issue you are *not*
  fixing still belongs in [tech-debt.md](tech-debt.md), not `issues/`.
- **BUG vs ISSUE:** BUG = implemented behaviour is incorrect / something broke / behaviour differs from
  an accepted requirement / a defect causes wrong behaviour / parity behaviour is wrong and the task is
  to fix it. ISSUE = needed implementation work that is not clearly a product defect / operational or
  configuration correction / an unresolved implementation concern / a tracked problem that does not fit
  BUG cleanly. **When unclear, prefer ISSUE.** Never file duplicate BUG + ISSUE records for one task.
- **A record for a screen is not an audit, and an audit is never converted into one.** An audit records
  what was true on a date (→ [audits/](audits/README.md)); an implementation record explains a change
  (→ [bugs/](bugs/) or [issues/](issues/)). If an audit leads to a fix, the audit stays put and a
  **separate** record is created for the fix.
- **A large feature is still a feature** — do not open a bug/issue record just because feature work is
  big.
- **Database work is backend-owned — no `.sql` in this repository** *(added 2026-08-17)*. Migration
  files and manual DBA scripts live in `wecms-api` (`src/main/resources/db/migration/` for a new table or
  DB function; `docs/sql/<YYYY>/` for existing-table changes, indexes, constraints, and any data change).
  A frontend record declares `## Database Impact` as **`NONE (frontend) — database dependency only`**
  plus a cross-link to the backend record that owns the SQL, documented only to the depth needed to
  explain the frontend dependency. Never embed executable SQL in a frontend doc. A frontend task is not
  `COMPLETE` while the backend DB change it depends on is unapplied in the target environment.
  Frontend developers do not execute database changes. Full rule: [../CLAUDE.md](../CLAUDE.md) §12g;
  backend authority: `wecms-api/CLAUDE.md` §14 *(separate repository)*.
- **`Status: IN PROGRESS / COMPLETE / CLOSED / PARTIAL / BLOCKED` is the record's own lifecycle
  field — not a sixth value** in the five-word [Status vocabulary](#status-vocabulary) below. The two
  axes are independent: a finished record is typically `HISTORICAL` as a document *and*
  `Status: COMPLETE` as a work item.
- **Dated record ≠ permanent docs.** [bugs/](bugs/) and [issues/](issues/) are **change history**; they
  do not replace [features/](features/). The dated record explains *why the change happened*; the
  screen's 6-doc set describes *how the system works now*. Update the permanent docs after
  implementation when the authoritative behaviour changed — and never treat a dated record as the only
  source of truth for current behaviour.
- **An existing authoritative feature doc does not remove the docs-first requirement.**
- **Cross-repo work** (WEB + API) creates the record in **both** repositories before either side's
  code is modified — `wecms-web/docs/bugs/` ↔ `wecms-api/docs/bugs/` for a BUG,
  `wecms-web/docs/issues/` ↔ `wecms-api/docs/issues/` for an ISSUE, same descriptive subject + date
  where appropriate, cross-linked. For a cross-repo **audit**, prefer the repository that owns the
  primary audit scope; if both sides need their own evidence, scope one record per repository and
  cross-link. The backend counterpart is `wecms-api/docs/README.md` § the same section *(separate
  repository)*.
- **Validate before declaring complete** — run `node scripts/check-doc-links.mjs` (see
  [Validating this tree](#validating-this-tree)). Expected: 0 broken links.

### Implementation quality gate — verify before COMPLETE

**Added 2026-08-18.** Docs-first opens the task; the **quality gate closes it**. After the code is
written, a meaningful BUG / ISSUE / FEATURE / parity fix / behaviour, business-rule, API, UI or
integration change is **not complete until it has been verified**:

```
DOCS-FIRST RECORD → implementation → implementation self-audit → tests
  → test scenarios → regression review → DB verification (if applicable)
  → security / permission verification (if applicable) → documentation update
  → final evidence → COMPLETE
```

**The full rule is authoritative in [../CLAUDE.md](../CLAUDE.md) §14 "Implementation quality gate".**
This is a pointer; if the two disagree, `CLAUDE.md` wins. In short:

- **Self-audit the actual Git diff** (`git status` · `git diff` · `git diff --stat`) — not the original
  ticket text. Unrequested changes in the diff are a finding, not a bonus (§14b, §14s).
- **Decide the appropriate tests and add them where in scope.** A bug fix normally carries a
  **regression test** that fails before the fix and passes after; if that is impractical, the record
  says **why** and supplies manual evidence. *"No test needed"* with no justification is not
  acceptable (§14c, §14d).
- ⚠️ **Put the test where Vitest actually collects it.** Only `components/**` and `lib/**` are in the
  include globs — a test in `hooks/` or `app/` is **silently skipped** and passes by never running.
  See [testing/testing-strategy.md](testing/testing-strategy.md).
- **Run the relevant scope** (`npm test`, or `npx vitest run components/<area>` first) and **report
  exactly what was run** (§14i). There is **no CI test stage** — running it is a manual responsibility.
  Failing tests are classified — caused-by-this-change / pre-existing / environment / test-data /
  unresolved — never hidden (§14j).
- **Update `features/**/test-scenarios.md`** when permanent screen behaviour changed; the dated record
  keeps only this change's evidence. A scenario listed there is **not** evidence that an automated test
  covers it (§14f).
- **Verify what applies**: API consumption contract · UI (route, loading, empty, error, validation,
  permission visibility, navigation, dialogs, localization EN/KO/VI, the actual request the UI sends) ·
  DB **dependency** (§12g — no SQL here) · legacy/JEX parity · security & permissions · performance &
  concurrency · error handling (§14k–§14q).
- **Do not claim visual verification if the UI was not actually run and inspected** (§14l).
- **Record the evidence** in the record's **`## Verification`** section, with honest states —
  `PASS` / `FAIL` / `NOT RUN` / `BLOCKED` / `NOT APPLICABLE`. A test plan is never reported as a test
  result (§14g, §14h).
- **Write the durable evidence to a test-result record** *(added 2026-08-18)*. Once verification
  actually runs, the command, counts, environment, build under test, and pre-existing-vs-new failures
  go into [testing/results/](testing/results/)`descriptive-name-test-result-YYYY-MM-DD.md`; the
  implementation record gains a **`## Test Evidence`** section linking to it, and the result links back.
  `## Verification` stays the summary. **`Implementation Status: COMPLETE` requires test evidence that
  supports it** — if tests fail, the honest pair is `Test Status: FAIL` + `BLOCKED` / `PARTIAL` (§17).
  Rules: [testing/results/README.md](testing/results/README.md).
- **`COMPLETE` only when every required part is done** — otherwise `PARTIAL` / `BLOCKED` /
  `READY FOR SIT` / `READY FOR DEPLOYMENT` (§14u).
- **Cross-repo work is not complete because one repository is green** — both sides verify, then the
  integration is verified end-to-end (§14r).
- **Risk-based, not boilerplate.** Every check is *required when applicable*; a CSS fix does not need a
  DB audit, and a payment-approval UI change needs a great deal more (§14x).

**Same team scope as docs-first:** Cambodia · Vietnam · Korea · any future WeCMS contributor, and every
tool — manual, Claude Code, Cursor, another AI assistant, IDE tooling, scripts, pair programming. **No
team runs a weaker Definition of Done** (§14a). Reviewer checklist: §14v. AI assistants enforce the
same rule and may not stop at "the code compiles" (§14w).

### Manual Git & deployment — the workflow ends at READY FOR MANUAL COMMIT

**Added 2026-08-18.** The quality gate finishes the *work*; it does not ship it.

```
QUALITY GATE COMPLETE  →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

> ⚠️ **In this repository a push IS a deployment** — CI runs on `sit` and `uat` and triggers the
> downstream build/deploy pipeline (see [Environments](#environments)). `git push origin sit` and
> `git push origin uat` are **release actions against real environments**.

**The full rule is authoritative in [../CLAUDE.md](../CLAUDE.md) §15 "Manual Git & deployment rule".**
This is a pointer; if the two disagree, `CLAUDE.md` wins. In short:

- **No AI assistant automatically performs** `git commit` · `git push` · `git merge` · `git rebase` onto
  a shared branch · tag creation/push · push to `sit` / `uat` / `prod` · a deployment trigger · a
  promotion between environments · any release command. These are **manual developer / team
  responsibilities** (§15a).
- **Read-only Git inspection is expected** — `git status`, `git diff`, `git log`, `git branch` are part
  of the quality gate (§14b, §14s). The boundary is between *observing* the repository and *changing
  shared history or a running environment*.
- **The AI-assisted workflow ends at `READY FOR MANUAL COMMIT`** — never at `COMMITTED`, `PUSHED`, or
  `DEPLOYED`. After that, the developer reviews `git status` / `git diff`, stages, commits, pushes the
  intended branch, merges per team process, and promotes to SIT / UAT / PROD (§15b).
- **Explicit-request exception only** (§15c): if the user asks in the current conversation for one
  specific operation ("commit this", "push this branch", "merge this branch"), the assistant may assist
  with **that operation only**. It does not extend to the operations that usually follow, nor to the
  rest of the session. **SIT / UAT / PROD deployment and promotion stay manual regardless** — and since
  pushing `sit` / `uat` *is* deploying, such a request is a deployment request and gets an explicit
  branch + environment confirmation first.
- **Never infer permission** from *"done"*, *"finish it"*, *"deploy-ready"*, *"complete"*, or *"ready to
  merge"* — none of those means commit, push, or deploy.
- **Never report** `PUSHED` · `MERGED` · `DEPLOYED` · `SIT COMPLETE` · `UAT COMPLETE` · `PROD COMPLETE`
  unless the responsible team actually performed and verified the action — and `SIT COMPLETE` means the
  deployed build was checked, not that a pipeline started (§15d).

**Team-wide** — Cambodia · Vietnam · Korea · future contributors · Claude Code · Agents · Cursor · any
other AI tool. Git and environment promotion remain human-controlled steps (§15e).

### Human approval gate — investigation does not authorize implementation

**Added 2026-08-18.** The full chain, from a request to a hand-over:

```
INVESTIGATE  →  DOCUMENT FINDINGS  →  HUMAN APPROVAL  →  implement  →  quality gate
   →  READY FOR MANUAL COMMIT  →  HUMAN Git / deployment process
```

**The full rule is authoritative in [../CLAUDE.md](../CLAUDE.md) §16 "Human approval gate between
investigation and implementation".** This is a pointer; if the two disagree, `CLAUDE.md` wins.

- **The record is the pre-implementation review contract** (§16a). Before code changes, a reviewer must
  be able to read it and know what is wrong, what the system does now, why, what is recommended, which
  repositories are affected, the DB/API/UI impact, the risks, and the tests required.
- **The record exists first — and the assistant proves it** (§16b) by naming the actual file path,
  classification, and the three statuses. *"Docs-first followed"* is not evidence; the file must exist.
- **Three request classes** (§16c): **A · check / investigate / review / audit / analyze / design**
  authorizes documentation and read-only inspection and then **stops for human approval** — never
  source, tests, SQL, migrations, or config. **B · "investigate and fix"** already carries approval; do
  not ask twice. **C · "implement / fix this"** is explicitly authorized. Docs-first applies to all
  three. **Ambiguous → treat as A.**
- **The human decides** — `APPROVE IMPLEMENTATION` · `DENY` · `NEEDS MORE INVESTIGATION` (§16e).
  *"OK"* · *"thanks"* · *"looks good"* · *"done"* · *"understood"* · *"check again"* are **not**
  approval.
- **If denied** (§16g): no source, no tests, no DB change, no migration — record the decision, preserve
  the evidence, stop. **The record stays as engineering history; it is never deleted because
  implementation was denied.**
- **AUDIT → BUG/ISSUE → implementation** (§16i): the audit stays in [audits/](audits/README.md); the
  approved fix gets its own record in [bugs/](bugs/) / [issues/](issues/) that **links to the audit as
  evidence** rather than copying it. **`Audit: COMPLETE` never means the defect is fixed** (§16n).
- **Three status dimensions** — Investigation / Approval / Implementation — recorded as metadata and
  mapped onto the existing canonical `Status:` work-item vocabulary; this is **not** a second
  vocabulary, and it is unrelated to the five-word doc-classification vocabulary below (§16k).
- **Implementation approval ≠ DB execution approval** (§16m). Frontend code may be `APPROVED` while the
  backend SQL it depends on is still `READY FOR DBA`.

**Team-wide** — Cambodia · Vietnam · Korea · future contributors · Claude Code · Agents · Cursor · any
other AI tool (§16p). One canonical record per repository; a recorded denial binds everyone until a
later authorized decision changes it.

## Where things live

Every folder in `docs/` appears here. If something exists on disk and is not in this table, the table
is wrong — fix it.

| Folder / file | Contents |
|---|---|
| [features/](features/) | **Per-feature / per-screen design**, grouped by the WeCMS top menu → [banking/](features/banking/) · [payment/](features/payment/) · [addon-service/](features/addon-service/) · [settings/](features/settings/) · plus cross-cutting [auth/](features/auth/) and [common/](features/common/). Each screen folder carries the same 6-doc set. **Current + permanent** behaviour — dated bug/issue records live in `bugs/` / `issues/`, not here. |
| [bugs/](bugs/) | **Added 2026-08-17.** Dated **bug-fix** implementation records — `descriptive-name-YYYY-MM-DD.md`, created *before* the code change at `Status: IN PROGRESS` and completed in place. Change history, not current-behaviour documentation. Rules: [bugs/README.md](bugs/README.md) |
| [issues/](issues/) | **Added 2026-08-17.** Dated **issue** implementation records (non-bug: behavioural, operational, configuration, tracked implementation work) — same filename + docs-first rules. Rules: [issues/README.md](issues/README.md) |
| [architecture/](architecture/) | Cross-cutting frontend architecture — [routes/](architecture/routes/) · [components/](architecture/components/) · [hooks/](architecture/hooks/) · [state-management/](architecture/state-management/) · [integrations/](architecture/integrations/) · [view-setting/](architecture/view-setting/) |
| [audits/](audits/README.md) | **Canonical home for frontend audits** — parity audits, verifications, investigations, legacy comparisons, migration verifications, architecture reviews, gap analyses, historical validation, cross-feature analysis, the mobile-WebView readiness assessment. Point-in-time findings, not current-behaviour docs. An audit is **never** converted into an implementation record — a fix it triggers gets its own record in [bugs/](bugs/) or [issues/](issues/). |
| [references/](references/) | Reference material — **[api-contract.md](references/api-contract.md)** (frontend API consumption contract: envelope, auth, 401, casing boundary, pagination, binary) · [page-mapping/](references/page-mapping/) (JEX `_view.jsp` → Next.js route) · [legacy/](references/legacy/) (vendor captures kept for traceability, **not** application source) |
| [e-sign/](e-sign/README.md) | ⚠️ **Pre-implementation source material / design handoff** — product + legal research, a standalone browser prototype, presentation material. **No e-Sign route, component, API client, menu entry, or locale key exists in this repository.** Not documentation of shipped behaviour. |
| [testing/](testing/) | Frontend testing — **[testing-strategy.md](testing/testing-strategy.md)** documents the real setup (`npm test`, Vitest + jsdom + React Testing Library, include globs, the 14-file / 152-test inventory, and what is absent: no coverage thresholds, no e2e runner, no CI test stage). **[testing/results/](testing/results/)** *(added 2026-08-18)* holds durable per-change **test-result records** (`descriptive-name-test-result-YYYY-MM-DD.md`; rules at [testing/results/README.md](testing/results/README.md)). Per-screen manual QA checklists live with their feature as `test-scenarios.md`. |
| [tech-debt.md](tech-debt.md) | Knowingly-deferred pre-existing issues, with the reason and a safe-fix sketch each |
| [bug-reports/](bug-reports/) · [change-log/](change-log/) | Pointer stubs — the authoritative trackers are cross-system and maintained outside this repository |
| [tech-stack.md](tech-stack.md) | Stack & versions |
| [ui-component-guide.md](ui-component-guide.md) | Component / layout architecture guide |
| [workflow.md](workflow.md) · [prd.md](prd.md) · [permissions.md](permissions.md) | Pointer stubs. These are cross-system documents maintained in the **shared workspace docs, outside this repository** — they are not part of the `wecms-web` clone. |
| [frontend-project-rules.md](frontend-project-rules.md) | Frontend rules (pointers to [../AGENTS.md](../AGENTS.md) + [../CLAUDE.md](../CLAUDE.md)) |

## Validating this tree

After editing any doc, run the link checker — zero dependencies, plain Node:

```bash
node scripts/check-doc-links.mjs               # repo-aware; exits 1 on any broken link
node scripts/check-doc-links.mjs --standalone   # model a clone without the sibling trees
node scripts/check-doc-links.mjs --detail       # list every finding
node scripts/check-doc-links.mjs --json         # machine-readable summary
```

It is CommonMark-aware where naive checkers fail: balanced parentheses in destinations (so
`app/(dashboard)/…` works), fenced code blocks and inline code spans masked, angle-bracket
destinations, link titles, and nested brackets. It classifies every link into the three tiers in
[references/README.md § Out-of-repo links](references/README.md#out-of-repo-links--three-tiers), so
out-of-repo links are reported as a **dependency count, never a failure**.

**Green means:** in-repo broken = 0, out-of-repo broken = 0, unsafe = 0. Current state (2026-08-17):
all three are 0 across 449 files and 3,649 links.

Nothing in CI runs this — [.gitlab-ci.yml](../.gitlab-ci.yml) is a downstream trigger only — so it is
a manual step. Anchor *targets* are not verified (heading slugs are renderer-specific).

## Status vocabulary

**This section is the normative definition.** Five values, and no others. A reader must be able to
tell, from a document's first lines, whether it describes shipped behaviour.

| Status | Means | Typical use |
|---|---|---|
| **CURRENT** | Describes behaviour that exists in this repository **now**. Safe to build from. Keep it updated as the code moves. | Feature READMEs and the 6-doc set for an implemented screen; architecture docs; index READMEs; `references/api-contract.md`; `testing/testing-strategy.md` |
| **LEGACY** | Describes the **JEX** system, not this one. Functional/behavioural reference only — never an implementation spec for `wecms-web`. | `legacy-spec.md` files; `references/legacy/`; JEX parity baselines |
| **PLANNED** | Scoped and agreed, **not yet built**. No route/component/API exists. | A design doc written ahead of implementation |
| **HISTORICAL** | A **point-in-time finding record**. True on its stated date; not maintained afterwards. Amend the header if the conclusion changes — never rewrite the findings. | Everything in [audits/](audits/README.md) |
| **SUPERSEDED** | Retained for traceability, but **another document is authoritative**. Must name its replacement in its first lines. | The flat single-file summaries that still sit beside their feature folders |

### Rules

- **Put the status in the first ~10 lines**, as a bold `**Status: …**` line or a leading blockquote.
  Add a qualifier freely (`CURRENT — partially wired`, `HISTORICAL — closed 2026-06-27`); the
  keyword must be one of the five.
- **CURRENT is a promise.** If a doc describes something not in the code, it is not CURRENT — it is
  PLANNED, LEGACY, or SUPERSEDED. Mis-marking this is the single most damaging documentation error
  in this tree, and the reason the P0/P1 remediation passes were needed.
- **Pre-implementation source material is not PLANNED.** Material gathered before any scoping
  decision — research, handoffs, prototypes — is classified in its own folder README. See
  [e-sign/](e-sign/README.md), which is *source material*, not a plan.
- **Audits are HISTORICAL by definition**, even when their finding still holds. Feature docs get
  updated; audits get superseded.
- **SUPERSEDED must point somewhere.** A superseded doc with no pointer to its replacement is worse
  than no doc.
- **Do not retro-stamp historical audits.** Their existing per-audit vocabularies (`MATCH` /
  `PARTIAL` / `MISSING`, `Confirmed` / `Likely` / `Not Confirmed`) are internal to those documents
  and are not affected by this section.

### Adoption status (2026-08-17)

Rolled out where ambiguity actually existed, not by mass-stamping every file:

| Metric (65 feature READMEs) | Before | After |
|---|---|---|
| No status marker of **any** kind — a reader could not tell whether the doc described shipped behaviour | **18** | **0** |
| No **five-keyword** status — carries a descriptive marker (`**Status:** Implemented full-stack`, `**Last verified:** …`) but not one of the five values | 64 | **38** |

The 38 remaining are **not ambiguous** — each states its condition in prose, so a reader is not
misled. Normalizing them onto the keyword vocabulary is a mechanical follow-up worth doing during
each feature's next stabilisation pass; it was deliberately **not** done as a bulk rewrite here.

Architecture indexes, the [audits index](audits/README.md) (HISTORICAL by definition), and the
[e-sign index](e-sign/README.md) (source material, classified in its own README) already state their
classification and were left as they are.

Authoring rules mirror this in `.claude/skills/wecms-web-docs/references/web-doc-structure.md` (and
its `.agents/` twin). If the two ever disagree, **this section wins**.

## Navigate by WeCMS menu

### Banking — [features/banking/](features/banking/)

| Group | Folder |
|---|---|
| Current & Savings (VND) | [current-savings-vnd/](features/banking/current-savings-vnd/) — account-inquiry · transaction-history |
| Current & Savings (FCY) | [current-savings-fcy/](features/banking/current-savings-fcy/) — account-inquiry · transaction-history |
| Smart Organizer | [smart-organizer/](features/banking/smart-organizer/) — its own top-menu group; **one page serves VND + FCY** |
| Internal Transfer (VND) | [internal-transfer-vnd/](features/banking/internal-transfer-vnd/) — [own-account-transfer/](features/banking/internal-transfer-vnd/own-account-transfer/) (`/banking/transfer-own-accounts`) · [transfer-history/](features/banking/internal-transfer-vnd/transfer-history/) (`/banking/transfer-history`) |
| Reports | [reports/](features/banking/reports/) — daily-cash · daily-financial (+ `-hs` variant) · cash-flow |

> **Internal Transfer naming.** The doc folder is `internal-transfer-vnd/`, but the live routes are
> `/banking/transfer-own-accounts` and `/banking/transfer-history`. There is **no**
> `/banking/internal-transfer/*` route — that prefix belongs to **Payment**
> (`/payment/internal-transfer/…`), a different module. `/banking/own-account-transfer` still
> resolves but is a permanent redirect kept for old bookmarks.

### Payment — [features/payment/](features/payment/)

[approval-box/](features/payment/approval-box/) · [internal-transfer/](features/payment/internal-transfer/) · [vendor-payment/](features/payment/vendor-payment/) · [expense-payment/](features/payment/expense-payment/) · [payroll/](features/payment/payroll/) · [overseas-payment/](features/payment/overseas-payment/) · [exchange-rate-inquiry/](features/payment/exchange-rate-inquiry/) · [corporate-card/](features/payment/corporate-card/)

### Add-on Service — [features/addon-service/](features/addon-service/)

[sales-e-invoices/](features/addon-service/sales-e-invoices/) · [expenses-e-invoices/](features/addon-service/expenses-e-invoices/) · [operation-status-inquiry/](features/addon-service/operation-status-inquiry/) · [tax-filing/](features/addon-service/tax-filing/) *(VAT declaration — documented 2026-08-17)*

### Settings — [features/settings/](features/settings/)

Twelve Settings-modal panels, each with its own 6-doc folder: [purpose/](features/settings/purpose/) · [vas-account/](features/settings/vas-account/) · [contacts/](features/settings/contacts/) · [approval-line/](features/settings/approval-line/) · [chart-of-accounts/](features/settings/chart-of-accounts/) · [login-credentials/](features/settings/login-credentials/) · [bank-account/](features/settings/bank-account/) · [preferences/](features/settings/preferences/) · [user-management/](features/settings/user-management/) · [transaction-history/](features/settings/transaction-history/) (ERP) · [firm-banking-settings/](features/settings/firm-banking-settings/) · [firm-banking-history/](features/settings/firm-banking-history/). See the [settings README](features/settings/README.md) for the doc ↔ API cross-links.

> **The folder is authoritative, not the same-named flat file.** Fifteen features still carry a
> legacy single-file summary beside their folder (`settings/contacts.md` next to
> `settings/contacts/`, and similar).
>
> **The invariant: every one of those flat files explicitly identifies its feature folder as the
> authoritative documentation location.** The wording varies — some say `Status: SUPERSEDED`, others
> "Primary home moved", "preserved as the original concise spec", or "the detailed source of truth
> is …" — so do not grep for a single phrase. *(Corrected 2026-08-17: this note previously claimed
> all fifteen carry the literal marker "SUPERSEDED SUMMARY". They do not, and that exact string is
> not used anywhere.)*
>
> **Always link to the folder.** Three of the fifteen are large design-history blueprints kept
> deliberately (`settings/approval-line.md`, `settings/transaction-history.md`,
> `settings/chart-of-accounts.md`); the rest are short pointer stubs.

## Related

- Backend docs, JEX functional spec, and backend-tracked open questions live **outside this repository** (the `wecms-api` backend repo and the legacy JEX source / shared workspace docs). They are not part of the `wecms-web` clone.
- Project rules (in-repo): [../CLAUDE.md](../CLAUDE.md) + [../AGENTS.md](../AGENTS.md). Cross-tree workspace rules are maintained outside this repo.
