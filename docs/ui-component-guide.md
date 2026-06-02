# UI Component Guide

Component / layout architecture for `wecms-web`.

- **Component architecture & inventory** — [architecture/components/](architecture/components/)
- **Hooks** — [architecture/hooks/](architecture/hooks/)
- **Routes / layouts** — [architecture/routes/](architecture/routes/)
- **State management** — [architecture/state-management/](architecture/state-management/)
- **API integration** — [architecture/integrations/](architecture/integrations/)
- **View Setting (shared global component)** — [architecture/view-setting/](architecture/view-setting/)

### Conventions
- Primitives come from **Radix UI** wrapped via **shadcn** (`components.json`); variants via
  `class-variance-authority`. Compose, don't fork.
- Typography uses the semantic Tailwind tokens defined in the workspace
  [CLAUDE.md](../../CLAUDE.md) (`text-page-title`, `text-section-title`, `text-body`, …).
- Per-page UI specs live in screen-flows/ (Needs Confirmation).
