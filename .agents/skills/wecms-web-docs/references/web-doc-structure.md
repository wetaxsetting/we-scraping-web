# wecms-web-docs — Folder Structure & Placement Guide

Authoritative map for where frontend docs go under `wecms-web/docs/`. Read alongside `web-doc-rules.md`.

> **Refreshed 2026-08-17** to match the real tree. Corrections in this pass: `archive/` was deleted
> (2026-06-23) and is gone from the map; `references/screen-flows/` was collapsed (2026-08-17) and is
> gone; `audits/`, `e-sign/`, `bug-reports/`, `change-log/`, and `tech-debt.md` are real areas that
> the map never listed. This file is mirrored at `.agents/skills/wecms-web-docs/references/` — keep
> the two byte-identical.

## Directory map

```
wecms-web/docs/
├── README.md                      # docs root index — every folder below must appear in it
├── frontend-project-rules.md
├── workflow.md   prd.md   permissions.md    # pointer stubs — authoritative copies live
│                                            # in the shared workspace docs, OUTSIDE this repo
├── tech-stack.md
├── ui-component-guide.md
├── tech-debt.md                   # knowingly-deferred pre-existing issues
│
├── features/                      # SCREEN-ALIGNED / FEATURE-FIRST specs — primary home
│   ├── README.md
│   ├── auth/  common/  banking/  payment/  addon-service/  settings/
│   └── …/{screen}/                # each screen folder carries the standard 6-doc set:
│                                  #   README · screen-flow · ui-specification
│                                  #   component-index · api-consumption · test-scenarios
│                                  # CURRENT behaviour only — dated bug/issue records go below
│
├── bugs/                          # ADDED 2026-08-17 — dated BUG implementation records
│   └── README.md                  #   purpose / what belongs / filename / relationship to
│                                  #   features + audits
├── issues/                        # ADDED 2026-08-17 — dated ISSUE implementation records (non-bug)
│   └── README.md
│
├── architecture/                  # cross-cutting frontend architecture
│   ├── README.md
│   ├── components/                # shared/reusable components + main-page-ui-rule.md
│   ├── hooks/                     # real hook inventory (NO TanStack Query — see below)
│   ├── routes/                    # App Router structure + the proxy.ts auth gate
│   ├── state-management/          # Context + localStorage (NO Zustand — see below)
│   ├── integrations/              # browser-side integrations (NXiSAS, client-side doc generation)
│   └── view-setting/              # global column visibility / order / size feature
│
├── audits/                        # CANONICAL HOME FOR FRONTEND AUDITS
│   └── README.md                  # index — parity audits, gap analyses, readiness assessments
│
├── references/
│   ├── README.md
│   ├── api-contract.md            # FRONTEND API CONSUMPTION CONTRACT — envelope, unwrap(),
│   │                              # ApiCallError, JWT, 401/session-expiry, casing boundary,
│   │                              # pagination, binary/download exceptions. Link here instead
│   │                              # of deep-linking wecms-api for consumption-side concepts.
│   ├── page-mapping/              # JEX _view.jsp → Next.js route mapping
│   └── legacy/                    # vendor/legacy captures (nxisas_api.js) — NOT app source
│
├── e-sign/                        # PRE-IMPLEMENTATION SOURCE MATERIAL / design handoff.
│                                  # No e-sign code exists in this repo. Not shipped-product docs.
│
├── testing/                       # frontend testing
│   ├── README.md
│   └── testing-strategy.md        # the REAL setup: npm test, Vitest+jsdom+RTL, include globs,
│                                  # test inventory, and what is absent (no coverage thresholds,
│                                  # no e2e runner, no CI test stage)
└── bug-reports/  change-log/      # pointer stubs — trackers are cross-system, outside this repo
```

## Placement decision guide

| You are documenting… | Put it under… |
|---|---|
| **A dated BUG implementation record** (docs-first — implemented behaviour is incorrect · something that worked is broken · behaviour differs from an accepted requirement · a defect causes wrong behaviour · parity behaviour is wrong and the task is to fix it) | `bugs/` as `descriptive-name-YYYY-MM-DD.md` — **never** `features/`, **never** `audits/` |
| **A dated ISSUE implementation record** (docs-first, non-bug — needed work that is not clearly a product defect · operational / configuration correction · an unresolved implementation concern · a tracked problem that does not fit BUG cleanly; **when unclear, prefer ISSUE**) | `issues/` as `descriptive-name-YYYY-MM-DD.md` — **never** `features/` |
| A screen/page's UI (route, filters, columns, dialogs, validation) | `features/{domain}/{screen}/` |
| A reusable component | `architecture/components/` |
| A cross-page UI standard | `architecture/components/` (see `main-page-ui-rule.md`) |
| A custom hook | `architecture/hooks/` |
| Routing structure / conventions | `architecture/routes/` |
| State management approach | `architecture/state-management/` |
| A browser-side integration (SDK, engine, client-side file generation) | `architecture/integrations/` |
| View Setting (column config) behavior | `architecture/view-setting/` |
| **A parity audit, gap analysis, wiring verification, or readiness assessment** | **`audits/`** — never inside `features/` |
| JEX `_view.jsp` → Next.js route mapping | `references/page-mapping/` |
| A UI flow for one screen | that screen's `screen-flow.md` under `features/` |
| A genuinely cross-screen flow reference | `references/` directly, named for what it is |
| A test plan | `testing/` |
| A knowingly-deferred issue you are NOT fixing | `tech-debt.md` |
| **A database change artifact (`.sql`)** — migration file, manual DBA script, seed, backfill, corrective SQL | **nowhere in this repository.** DB artifacts are backend-owned: `wecms-api/src/main/resources/db/migration/` (new table / new DB function) or `wecms-api/docs/sql/<YYYY>/` (existing-table change, index, constraint, any data change). A frontend record states the dependency and cross-links the backend record. See `wecms-web/CLAUDE.md` §12g. |

## Feature domains

The six top-level domains are fixed: **auth, common, banking, payment, addon-service, settings**. Every screen doc maps to exactly one, mirroring the WeCMS menu structure. Cross-link when a screen spans domains, but give it one canonical home.

## Placement rules

- A new screen doc → `features/{domain}/{screen-slug}/` with the 6-doc set. Keep the slug identical to its JEX and backend counterparts.
- **Dated implementation records** (docs-first — a **team-wide** rule binding every developer and every tool, see `wecms-web/CLAUDE.md` §"Docs-First Implementation Workflow (MANDATORY)" + §12 "Who must follow this") are named `descriptive-name-YYYY-MM-DD.md`, lowercase kebab-case, ISO date, subject-descriptive. **One task → one canonical record per repository** — never a per-developer copy (`…-dev-a-…`, `sokny-fix.md`); a second developer continuing the work updates the existing record. Never a work-code / sequence filename (`a1-01-…`, `k9-fix.md`, `p1-update.md`, `task-03.md`, `final-fix.md`); internal IDs go in the document metadata as `**Issue:**`. **Placement (revised 2026-08-17):** a BUG record lives in `bugs/`, an ISSUE record in `issues/` — **not** beside the screen. They are the one sanctioned exception to "reuse before create" (always their own new file), and are finalized in place rather than superseded by a second "final" file. Their `Status: IN PROGRESS / COMPLETE / CLOSED / PARTIAL / BLOCKED` is a work-item lifecycle field and **not** a sixth value in the status vocabulary below.
- **Audits do not live in `features/`.** A document that records what was true on a date — parity audit, verification, investigation, legacy comparison, migration verification, architecture review, gap analysis, historical validation, cross-feature analysis — belongs in `audits/` with a date and a status in its header. Feature docs describe current behaviour; audits describe findings; dated *implementation records* live in `bugs/` / `issues/`. An audit is **never** converted into an implementation record — if it leads to a fix, the audit stays put and a separate record is created in `bugs/` / `issues/`.
- Never duplicate the same content in two places — pick the canonical home and cross-link. Where a legacy single-file summary still sits beside its feature folder, the **folder is authoritative**; the flat file must say so in its first lines. A dated record and the screen's 6-doc set are **not** duplication: `bugs/` and `issues/` are change history (*why the change happened*), the 6-doc set says *how the system works now*.
- Always update the nearest `README.md` index when adding a file — and `docs/README.md` when adding a top-level area.
- Every screen doc should link to: its `page-mapping` entry, the components/hooks it uses, and the matching backend doc.
- **`wecms-api` is a separate repository.** Relative links into it resolve only when both repos are checked out side by side; they break in a standalone `wecms-web` clone. Prefer naming the backend document over deep-linking it.

## Status vocabulary (five values, no others)

Every doc must let a reader tell, from its first ~10 lines, whether it describes shipped behaviour.
Use a bold **Status: …** line or a leading blockquote.

| Status | Means | Applies to |
|---|---|---|
| **CURRENT** | Exists in this repo now; safe to build from | Feature docs for implemented screens, architecture docs, index READMEs, `references/api-contract.md`, `testing/testing-strategy.md` |
| **LEGACY** | Describes JEX, not this system — functional reference only | `legacy-spec.md`, `references/legacy/`, JEX parity baselines |
| **PLANNED** | Scoped, agreed, NOT built — no route/component/API exists | Design docs written ahead of implementation |
| **HISTORICAL** | Point-in-time finding record, true on its stated date | Everything in `audits/` |
| **SUPERSEDED** | Kept for traceability; another doc is authoritative — must name it | Flat single-file summaries beside their feature folders |

Rules:

- A qualifier is fine (`CURRENT — partially wired`, `HISTORICAL — closed 2026-06-27`); the keyword must be one of the five.
- **CURRENT is a promise.** A doc describing something absent from the code is PLANNED, LEGACY, or SUPERSEDED — never CURRENT. Mis-marking this is the most damaging error in this tree.
- **Audits are HISTORICAL by definition**, even when the finding still holds. Never retro-stamp or rewrite an audit's findings; amend its header instead. Per-audit internal vocabularies (MATCH/PARTIAL/MISSING, Confirmed/Likely) are untouched by this section.
- **SUPERSEDED must point somewhere.** No pointer = worse than no doc.
- Pre-implementation source material is **not** PLANNED — it is classified in its own folder README (see `e-sign/`).
- **Normative definition lives in `wecms-web/docs/README.md` § Status vocabulary.** If this table and that section ever disagree, that section wins.

## Facts that documentation here must not contradict

Verified against source; these have been written wrongly before.

- **No TanStack Query / react-query / SWR, no Zustand / Redux.** There is no server-cache library and no global store. Data fetching is `useApiData` (fetch on mount, refetch when `deps` change); state is React Context + `localStorage` + component-local `useState`.
- **No SSR data fetching and no server actions.** The app is a client-rendered SPA.
- **One Next.js route handler exists** (overseas-payment Excel preview) and is **not on the runtime path**. Business APIs are consumed from `wecms-api`.
- **The app deploys** — SIT and UAT, from the `sit` / `uat` branches. It is not "local-only R&D".
- **Auth is gated server-side by `proxy.ts`** (Next.js 16's renamed `middleware`), not by a client guard. The old client-side guard in `app/(dashboard)/layout.tsx` and its **`?preview=1` bypass were removed as a security hole** — the guard was defeatable by disabling JS. Never document `?preview=1` as an auth bypass. (Unrelated `?preview=session-expired` / `?preview=nxisas` dev hooks still exist and are not auth bypasses.)
- **`ApiCallError` carries only `code` and `message` — NOT `traceId`.** Only `LoginError` (`lib/auth/client.ts`) and `ApprovalBoxApiError` (`lib/api/approvalBox.ts`) carry `traceId`. See `references/api-contract.md`.
- **`unwrap()` adoption is partial by design.** 12 of 35 `lib/api/` modules use the shared helper in `lib/api/common/unwrap.ts`; the rest keep a local copy because their envelope semantics genuinely differ. Do not describe adoption as complete, and do not describe the local copies as duplication to be cleaned up.
- **No frontend-generated Excel is on the runtime path.** Every live export calls the backend. `lib/reportExcel.ts` and `exportDailyCashExcel` in `lib/dailyCashExport.ts` are unreferenced residue; the remaining `xlsx` imports are Excel **upload parsing**, which CLAUDE.md §13b does not scope. See `references/api-contract.md` § XLSX generation policy.
- **The automated test suite is not green** (11 of 152 tests fail, one file, stale `vi.mock` factory) and **no CI stage runs tests** — `.gitlab-ci.yml` is a downstream trigger only. Do not claim tests pass or that CI verifies them. See `testing/testing-strategy.md`.
- **Out-of-repo links are expected to be unresolvable in a standalone clone** — 424 links across 278 files: **381** into a sibling `../wecms-api/` checkout (tier 2) and **43** into the multi-tree workspace root (tier 3 — `docs/jex/`, `docs/_shared/`, workspace `CLAUDE.md`). Documented dependency, not a broken link. Every **in-repo** link must resolve. Rules: (a) prefer `references/api-contract.md` over a backend deep-link for consumption-side concepts; (b) every tier-2/3 link must be recognizable as out-of-repo from its own line — carry the repo prefix in the link text (`[wecms-api/…/interface-specification.md](…)`) or say "backend" in the prose, never a bare `[interface-specification.md](…)`; (c) do NOT bulk-delete tier-2 links to make a clone look clean — they carry real authority. Tier table: `references/README.md` § Out-of-repo links. Verify with `node scripts/check-doc-links.mjs` (repo-aware) and `--standalone`.
