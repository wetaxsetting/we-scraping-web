# File Management — UI Specification (Frontend)

**Part of:** Common → file-management
**Last verified:** 2026-06-23

UI tokens + asset rules for the shared file primitives. Governed by `wecms-web/CLAUDE.md` §6b (Icon Assets) and §12 (Payment detail). All sizes below are CONFIRMED in code or the rule set.

## 1. File card / attachment row (Contacts `AttachmentsSection`)

Source `AttachmentsSection.tsx`. Each row is a bordered chip:

- Container: `flex items-center gap-2 rounded-md border border-wb-table-border bg-white px-3 py-2` (`:249`, `:272`).
- Filename: `truncate text-wb-13 font-medium text-wb-ink` (`:252`, `:275`).
- Sub-line (size, or title · size): `text-wb-12 font-medium text-wb-ntrl-6` (`:255`, `:278-281`).
- Action buttons: `flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5`, icon child `size-3.5` (`:263-265` remove; `:287-289` download; `:296-298` delete).
- "+ Add" button: `inline-flex h-8 … rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover` with a `Plus size-4` icon (`:216-224`).
- Help line: `text-wb-12 font-medium text-wb-ntrl-6`, message `settings.contacts.attachments.help` with `{ size: "10 MB" }` (`:235-237`).

> Note: `AttachmentsSection` uses **lucide** `Download` / `Plus` / `Trash2` glyphs at `size-3.5` / `size-4` for these inline dialog actions (`:3`). This is the contacts-dialog pattern. The named-asset file-card / download glyphs in §2 below are the Payment list-row pattern — do not mix the two without checking the relevant Figma frame.

## 2. Payment file-card icon + download button (CLAUDE.md §6b / §12 — canonical sizes)

For Payment detail `FileCard` rows (the named-asset pattern):

| Element | Asset | Size | Filter |
|---|---|---|---|
| File-type (Excel) icon | `/assets/common/ico-excel.svg` | **`size-5`** (20px) | — |
| Download button circle wrapper | — | **`size-5`** (20px, inline action) | — |
| Download icon inside the circle | `/assets/common/ico-download.svg` | **`size-4`** (16px) | `brightness-0 invert` (renders dark SVG white on a solid button) |

**Do NOT use `size-7`** for inline file / download actions — explicitly called out as an earlier mistake (§6b). `brightness-0 invert` is the canonical Tailwind-utility technique (no inline `style`).

## 3. Payment list-row download glyph — `<DownloadIcon>`

`components/shared/icons/DownloadIcon.tsx`: renders `/assets/common/ico-download-file.svg` (Figma `ico_arrow-down`, node 2033:26577) as an `<img>`, default `className="size-6"` (24px), single source of truth across all five Payment modules' batch-list tables. Never inlined as `<svg>`, never substituted with a lucide/Heroicons glyph (per §8a).

## 4. Toolbar / page-header file icons

- `/assets/common/ico-excel.svg`, `ico-list.svg`, `ico-print.svg` — used at `size-5` via `<img>` in `<PageActionButtons>` (§6b). Never substitute lucide.

## 5. Error / success dialogs

All file-error feedback routes through the shared `useDialog()` with `type: "error"`, `title: t("dialog.error")`, and (for API errors) `errorCode: ex.code` — per the dialog-variant rule (file-type validation is an **error**, not a warning). `AttachmentsSection` does this for extension/empty/too-large client validation and for upload/delete/download API errors (`:104-131`, `:147-154`, `:173-180`, `:193-200`).
