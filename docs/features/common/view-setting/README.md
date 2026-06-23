# View Setting (Screen Options) — Frontend Feature Hub

**Part of:** Common → view-setting
**Last verified:** 2026-06-23

**Slug:** `view-setting`
**Status:** Working — shared component + hooks; first wired screen `banking-account-inquiry-vnd`.

View Setting is a **global shared component (no own route — mounted on every list page toolbar)**.
The list-view icon in a page's toolbar opens one shared popover (Figma 100:13382 / legacy
`comm_0108_001`) where the user toggles column visibility, reorders columns, **Saves**, or **Resets**
to system defaults. One shared popover + one shared hook + one API surface, keyed by `screenId`
(from the central registry) — adopting a new page is a registry entry + a backend seed, never a fork.
Never copy the popover/hook into a feature folder.

**Architecture:** [`../../../architecture/view-setting/README.md`](../../../architecture/view-setting/README.md)

## Documents

| Doc | Covers |
|---|---|
| [screen-flow.md](screen-flow.md) | Popover open → toggle/reorder → Save/Reset/Cancel flow + states |
| [ui-specification.md](ui-specification.md) | Popover layout, tokens, locked/disabled rendering, special-field hiding |
| [component-index.md](component-index.md) | `<ViewSettingPopover>`, `useViewSetting`, `useViewSettingColumns`, `<PageActionButtons showList>`, props |
| [api-consumption.md](api-consumption.md) | The 4 screen-option calls, local-state-until-Save, error handling, `SCREEN_IDS` registry |
| [test-scenarios.md](test-scenarios.md) | User flows + error + a11y |

## Related

- Backend twin: [`../../../../../wecms-api/docs/features/common/view-setting/README.md`](../../../../../wecms-api/docs/features/common/view-setting/README.md)
- Category hub: [`../README.md`](../README.md)
- Frontend rules: `wecms-web/CLAUDE.md` §13 (View Setting) + §13a (table sort) + §13b (Excel export)
