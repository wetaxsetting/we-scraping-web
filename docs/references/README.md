# References

Cross-feature reference material for `wecms-web` frontend docs — material that supports the feature
docs but is not itself a per-screen design.

## Contents

| Item | Purpose |
|---|---|
| **[api-contract.md](api-contract.md)** | **Frontend API consumption contract** — the `ApiResponse<T>` envelope, `status.error`, `unwrap()`, `ApiCallError`, JWT transport, 401 / session-expiry handling, the snake_case ↔ camelCase boundary, pagination conventions, and the binary/download exceptions. The in-repo answer to "how does this client talk HTTP", so a standalone clone does not need the backend checkout to find out. |
| [page-mapping/](page-mapping/) | JEX `_view.jsp` → Next.js route mapping — the cross-feature [page-mapping.md](page-mapping/page-mapping.md) plus per-feature mapping notes |
| [legacy/](legacy/) | Legacy / vendor reference material kept for traceability. Currently holds [`nxisas_api.js`](legacy/nxisas_api.js) — see the caveat below |

## Out-of-repo links — three tiers

Every relative link in this docs tree falls into one of three tiers. **Tier 1 always resolves;
tiers 2 and 3 do not resolve in a standalone `wecms-web` clone.** That is a documented dependency,
not a broken link.

Measured 2026-08-17 by `node scripts/check-doc-links.mjs` over all 449 Markdown files in `docs/`,
`.claude/`, `.agents/`, `README.md`, `CLAUDE.md`, and `AGENTS.md` (tier counts sum to more files
than the 278 total because some files link into both outer trees):

| Tier | Target | Links | Files | Resolves when… |
|---|---|---|---|---|
| **1 — in-repo** | anything inside `wecms-web/` | 3,198 | — | always |
| **2 — sibling backend** | `../wecms-api/…` | **381** | **275** | `wecms-api` is checked out beside `wecms-web` |
| **3 — workspace root** | `../../docs/jex/…`, `../../docs/_shared/…`, workspace `CLAUDE.md`, … | **43** | **29** | the full multi-tree workspace is present |
| | **total out-of-repo** | **424** | **278** | |

```
<workspace>/                 ← tier 3 targets live here (docs/jex, docs/_shared, CLAUDE.md)
├── wecms-web/               ← this repository        (tier 1)
└── wecms-api/               ← the backend repository (tier 2)
```

Tier 2 is the paired backend feature documentation — the authoritative endpoint contracts, business
rules, and DB mapping. Tier 3 is the legacy JEX functional spec and the cross-cutting shared
references, which are workspace-level and belong to neither project repo.

### Reading these without the other trees

**The authority split is fixed:** the backend repo owns endpoint contracts, business rules, and DB
mapping; this repo owns *how the client consumes them*. When you only need the consumption side —
envelope, `status.error`, `unwrap()`, JWT transport, 401 handling, the casing boundary, pagination,
binary downloads — read **[api-contract.md](api-contract.md)**. It exists precisely so a standalone
clone does not need tier 2 to answer those questions.

Per-screen endpoint usage stays in each feature's `api-consumption.md` (tier 1).

### Conventions for authors

- **Every tier-2 / tier-3 link must be recognizable as out-of-repo from its own line** — either the
  link text carries the repo prefix (`[wecms-api/…/interface-specification.md](…)`) or the
  surrounding prose says "backend" / "sibling repository". A bare `[interface-specification.md](…)`
  is not acceptable: a reader who gets a 404 has no way to know why.
- **Prefer naming the backend document over deep-linking it** when the link is decorative rather than
  load-bearing.
- **Do not add a tier-2 link for a concept [api-contract.md](api-contract.md) already covers.** Link
  locally instead.
- **Do not bulk-delete tier-2 links** to make a standalone clone "clean". They carry real authority;
  losing them costs more than the unresolved-link noise. Remove one only when it is genuinely
  low-value or duplicated on the same page.

## `legacy/nxisas_api.js` is reference material, not application source

The file is a **verbatim copy of the live JEX bundle**
`WECMS DEV/WECMS_STATIC/web/nxisas/js/nxisas_api.js`, kept only as a behavioural spec for porting
bank-specific scraping rules into the Spring layer. Its own header banner says
`NOT LOADED AT RUNTIME, NOT THE ARCHITECTURE`: it sits outside `wecms-web/public/` so Next.js never
serves it, and it is not in the `SCRIPT_LOAD_ORDER` of
[`use-nxisas-engine.ts`](../../components/banking/own-account-transfer/hooks/use-nxisas-engine.ts).

**Read it to understand legacy behaviour; never import, bundle, or execute it.** It keeps its legacy
snake_case filename deliberately — renaming a verbatim capture would break traceability to the JEX
original. Full detail: [legacy/README.md](legacy/README.md).

## Screen flows

There is no `screen-flows/` folder. Active per-screen UI design lives under
[../features/](../features/) — each screen folder carries its own `screen-flow.md` alongside
`ui-specification.md`, `component-index.md`, `api-consumption.md`, and `test-scenarios.md`.

> **History.** A `references/screen-flows/` holding area existed from the 2026-06-01 feature-first
> reorg. It never received content — only a README restating that active design had moved to
> `features/` — and was removed 2026-08-17. Screen-flow material belongs with its feature; genuinely
> cross-screen flow references belong in this folder directly, with a name that says what they are.
>
> For JEX UI flows (read-only legacy reference), see the JEX documentation tree — outside this
> repository.

## Related

- Docs root: [../README.md](../README.md)
- Frontend architecture: [../architecture/](../architecture/)
- Audits (finding records): [../audits/README.md](../audits/README.md)
