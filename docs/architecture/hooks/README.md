# frontend/hooks/

Custom React hook design for `wecms-web`.

## Purpose

Document the data-fetching, mutation, and stateful hooks layered on top of the API client and TanStack Query.

## What goes here

- Per-hook markdown (`use-<name>.md`)
- Cache-key conventions, invalidation flow, optimistic-update rules
- Cross-link to the API endpoint consumed in [`../../backend/api/`](../../../../wecms-api/docs/references/api-spec/)

## Naming convention

- kebab-case, prefixed `use-` (e.g. `use-firm-banking-settings.md`).
- Slug matches the feature where applicable.
