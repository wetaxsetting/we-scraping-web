# wecms-web-docs — Documentation Rules

Content conventions for maintaining `wecms-web/docs/`. Read alongside `web-doc-structure.md`.

## Core principles

- **Doc-only.** Never touch application source. This tree is local R&D.
- **In-place by default.** Do not move or rename existing files unless explicitly asked.
- **Reuse over create.** A new file is the last resort. First try: extend an existing doc, add a section, or cross-link.
- **Preserve content.** Never delete prose, tables, decisions, or open questions without confirmation. Mark superseded content as such rather than removing it.

## Menu/screen-aligned, feature-first

- Frontend docs follow the **actual WeCMS menu / screen structure**. Each screen doc maps to a real Next.js route/page and a real menu entry.
- Organized by the six feature domains: `auth`, `common`, `banking`, `payment`, `addon-service`, `settings`.
- A screen doc belongs under `wecms-web/docs/features/{domain}/`.

## Naming

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

After every edit:
- Verify each relative link in touched files points to an existing file.
- Where practical, confirm heading anchors exist for `#anchor` links.
- Report broken or suspicious links; fix the ones you introduced.

## Final report (always)

Close every task with:
- Files **created** (full paths).
- Files **edited** (full paths + one-line summary).
- Cross-links added or updated (including backend cross-links).
- Open questions / TODOs touched.
- Link-validation result (clean / list of issues).
