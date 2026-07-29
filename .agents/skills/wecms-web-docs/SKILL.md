---
name: wecms-web-docs
description: Maintain WECMS refactor frontend (Next.js) documentation under wecms-web/docs/. Use when creating, editing, restructuring, or cross-linking web/frontend docs — feature/screen specs, architecture, routes/components/hooks, references (page-mapping, screen-flows), or UI design notes. Enforces menu/screen-aligned structure, reuse-before-create, and link validation.
---

# wecms-web-docs

Maintains the **refactor frontend** documentation tree at `wecms-web/docs/`. This is the Next.js R&D target. JEX trees and `docs/jex/` are read-only functional reference — never write there.

## When this skill applies

Trigger when the task involves any of:
- Creating or editing a frontend feature/screen spec (`wecms-web/docs/features/...`).
- Writing or updating architecture docs (components, hooks, routes, state, integrations, view-setting).
- Adding or revising references (page-mapping, screen-flows, legacy).
- Documenting a route/page, its components, filters, table columns, dialogs, API integration, or validation.
- Reorganizing or cross-linking anything under `wecms-web/docs/`.

Do **not** apply this skill to backend docs (`wecms-api/docs/` → use `wecms-api-docs`), to JEX docs (`docs/jex/`), or to application source code.

## Hard rules

1. **Never modify application source code.** Documentation only.
2. **Never move or reorganize existing docs** unless the user explicitly asks. Default to in-place edits.
3. **Write only under `wecms-web/docs/`** (plus the workspace cross-cutting folders the root AGENTS.md allows: `docs/_shared/`, `docs/security/`, `docs/testing/`, `docs/bug-reports/`). Never write into `wecms-api/docs/` or `docs/jex/`.
4. **Audit before creating.** Never create a new doc without first checking whether one already covers the topic.
5. **Reuse, cross-link, and preserve.** Extend existing docs; link related docs; never delete content without confirmation.
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
├── FRONTEND_PROJECT_RULES.md
├── WORKFLOW.md  prd.md  permissions.md  tech-stack.md  ui-component-guide.md
├── features/              # feature-first / screen-aligned specs
│   ├── auth/  common/  banking/  payment/  addon-service/  settings/
├── architecture/
│   ├── components/  hooks/  routes/  state-management/
│   ├── integrations/  view-setting/
├── references/
│   ├── page-mapping/      # JEX _view.jsp → Next.js route
│   ├── screen-flows/      # reserved (non-active flow references)
│   └── legacy/            # reserved (deprecated reference capture)
├── testing/
└── archive/
```

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

1. **Audit existing docs first.** Glob/grep `wecms-web/docs/` (especially `features/{domain}/`, `references/page-mapping/`, and `README.md` index files) for the topic. List what already exists before writing anything.
2. **Reuse / move / cross-link before creating.** Prefer extending an existing doc. If a new doc is truly needed, place it per the structure rules and link it from the relevant `README.md` index and from sibling docs (including the matching backend doc).
3. **Preserve open questions.** Frontend open questions / TODOs embedded in docs must not be deleted or marked resolved without explicit user confirmation. Add new ones freely; the human closes them.
4. **Validate links.** After editing, check every relative link in touched files resolves to a real path (and that anchors exist where feasible). Report any broken links.
5. **Provide a final report.** Summarize files created/edited, cross-links added (incl. backend cross-links), open questions touched, and link-validation results.

## References

- `references/web-doc-rules.md` — content conventions, naming, the screen-doc checklist, cross-linking.
- `references/web-doc-structure.md` — directory map and placement decision guide.
