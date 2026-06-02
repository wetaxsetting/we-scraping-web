# frontend/view-setting/

**Global cross-cutting feature** — column visibility / order / size persistence per user × screenId.

## Purpose

View Setting is a *shared* feature, not a per-page concern. Per memory `feedback_view_setting_global`, every list / table screen in `wecms-web` consumes the same:

- Shared component (`<ViewSettingDialog />`)
- Shared hook (`useViewSetting(screenId)`)
- Shared REST surface (`view-setting` slug — see `api` _(wecms-api backend repo — not included in this clone)_)
- Per-page registry mapping `screenId` ↔ allowed columns

## What goes here

- The hook contract & cache strategy
- The dialog UX spec
- The per-page registry schema (which `screenId`s exist, which columns each one declares)
- Audit logging notes — writes use the **slug** `view-setting` for `AUDIT_LOGS_INFM.WSVC_ID`

## What does NOT go here

- Per-table column lists (those belong on the **owning** feature spec under [`../../features/<domain>/<feature>.md`](../../features/), referenced from the registry)
- Tailwind / token usage (lives in workspace CLAUDE.md typography section)

## Related

- Workspace CLAUDE.md — refactor identifier naming (slugs over WSVC ids)
- Feature spec for any list screen that consumes View Setting → cross-link from the per-page registry doc
