# Tech Stack — wecms-web

Frontend for the WeCMS refactor R&D (local-only, GitLab-only; SPA inside the
Next.js App Router — no SSR data fetching, no Next.js API routes).

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.3 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4.2.4 |
| Component primitives | Radix UI (`@radix-ui/react-*`) + shadcn (`components.json`) | — |
| Variants / class utils | class-variance-authority, clsx, tailwind-merge | — |
| Icons | lucide-react | ^1.8.0 |
| Forms + validation | react-hook-form, @hookform/resolvers, zod | — |
| HTTP | axios | ^1.15.2 |
| Excel export | xlsx, xlsx-js-style | — |
| Lint | eslint + eslint-config-next | 16.2.3 |

> ⚠️ **Next.js 16 differs from earlier versions** — read [../AGENTS.md](../AGENTS.md) and
> `node_modules/next/dist/docs/` before writing non-trivial code.

Generated from `wecms-web/package.json`. Keep in sync when dependencies change.
