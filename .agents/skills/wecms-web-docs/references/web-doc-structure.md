# wecms-web-docs — Folder Structure & Placement Guide

Authoritative map for where frontend docs go under `docs/`. Read alongside `web-doc-rules.md`.
This file is mirrored at `.claude/skills/wecms-web-docs/references/` and
`.agents/skills/wecms-web-docs/references/` — keep the two byte-identical.

> **Rewritten 2026-11-03.** The repository now renders **WeInvoice**; the WeCMS docs and code were
> removed. If this file and the root `CLAUDE.md` disagree, `CLAUDE.md` wins — fix this file.

## Directory map

```
docs/
├── README.md                      # docs root index, docs-first summary, status vocabulary
├── frontend-project-rules.md      # pointer to AGENTS.md / CLAUDE.md
├── tech-debt.md                   # knowingly-deferred issues
├── features/                      # module / screen docs — CURRENT behaviour only
│   ├── README.md
│   └── weinvoice/                 # README (routes, architecture, rules) · test-scenarios · dated feature records
├── bugs/                          # dated BUG implementation records
├── issues/                        # dated ISSUE implementation records (non-bug)
├── audits/                        # audits / investigations (HISTORICAL)
└── testing/                       # testing-strategy.md + results/ (test-result records)
```

## Placement decision guide

| You are documenting… | Put it under… |
|---|---|
| **A dated BUG implementation record** (implemented behaviour is wrong / something broke / differs from an accepted requirement) | `bugs/` as `descriptive-name-YYYY-MM-DD.md` — never `features/`, never `audits/` |
| **A dated ISSUE implementation record** (needed work that is not clearly a defect; **when unclear, prefer ISSUE**) | `issues/` as `descriptive-name-YYYY-MM-DD.md` |
| A screen / module's current behaviour (route, filters, columns, dialogs, data access, rules) | `features/weinvoice/README.md`, or `features/weinvoice/<screen>/` with the 6-doc set once a screen outgrows the module README |
| Shared components, hooks, routing, state, data layer | `features/weinvoice/README.md` § Architecture + `CLAUDE.md` § WeInvoice Project Rules |
| **An audit, parity review, gap analysis, verification, investigation** | **`audits/`** — never inside `features/` |
| Manual test scenarios | the module's `test-scenarios.md` |
| Evidence of an executed test run | `testing/results/descriptive-name-test-result-YYYY-MM-DD.md` |
| A knowingly-deferred issue you are NOT fixing | `tech-debt.md` |
| **A database change artifact (`.sql`)** | **nowhere in this repository** — DB artifacts are backend-owned (`CLAUDE.md` §12g) |

## Placement rules

- **Dated implementation records** (docs-first, a team-wide rule — `CLAUDE.md` §1–§2a, §12) are named
  `descriptive-name-YYYY-MM-DD.md`, lowercase kebab-case, ISO date. One task → one canonical record;
  never a per-developer copy, never a work-code filename (internal IDs go in `**Issue:**`). They are
  finalized in place. `Status: IN PROGRESS / COMPLETE / CLOSED / PARTIAL / BLOCKED` is a work-item
  field, not a sixth status-vocabulary value.
- **Audits do not live in `features/`.** An audit is never converted into an implementation record;
  a fix gets its own record in `bugs/` / `issues/` that links the audit.
- Never duplicate content — one canonical home, cross-link the rest.
- Update the nearest `README.md` index when adding a file — and `docs/README.md` for a new top-level area.
- Run `node scripts/check-doc-links.mjs` after editing; in-repo broken links must be 0.

## Status vocabulary (five values, no others)

Normative definition: `docs/README.md` § Status vocabulary — that section wins on any disagreement.

| Status | Means | Applies to |
|---|---|---|
| **CURRENT** | Exists in this repo now; safe to build from | Module docs, index READMEs, `testing/testing-strategy.md` |
| **LEGACY** | Describes a predecessor system — functional reference only | Legacy parity baselines |
| **PLANNED** | Scoped, agreed, NOT built | Design docs written ahead of implementation |
| **HISTORICAL** | Point-in-time finding record, true on its stated date | Everything in `audits/` |
| **SUPERSEDED** | Kept for traceability; another doc is authoritative — must name it | — |

**CURRENT is a promise.** A doc describing something absent from the code is PLANNED, LEGACY or SUPERSEDED.

## Facts that documentation here must not contradict

- **P1 is a static UI on mock data.** No backend is called; `lib/api/weinvoice/*` is a mock over an
  in-memory store seeded by `mockData.ts`. **Login is real** (`/api/v1/auth/*`). Do not describe any
  data screen as "wired to the API" until its endpoint is.
- **No SSR data fetching, no server actions, no route handlers.**
- **Auth is gated server-side by `proxy.ts`** (presence cookie `wecms_token`). There is no `?preview=1` bypass.
- **No Excel file is generated in the browser.** Excel buttons report "not available in this build" until the backend exists.
- **The test suite:** 3 files, 18 tests, green as of 2026-11-03; **no CI stage runs tests**.
- **The app deploys** from `sit` / `uat` pushes — a push is a deployment, and the mock build must not be deployed as a product.
