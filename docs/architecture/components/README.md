# frontend/components/

React / Next.js component design for `wecms-web`.

## Purpose

Document reusable and feature-specific components: their props contract, slots / composition pattern, accessibility requirements, and how they consume hooks / state.

## What goes here

- Per-component markdown for non-trivial components (data tables, approval-line builder, transfer wizard steps)
- Shared component library conventions (button variants, dialog shell, form-row pattern)
- Typography & token consumption — components must use the Tailwind tokens defined in the workspace CLAUDE.md, not raw `text-[14.5px]`

## What does NOT go here

- One-off page layouts that are entirely route-local → keep in [`../routes/`](../routes/)
- Global app shell, auth gate, error boundary → cross-link from [`../routes/`](../routes/)
