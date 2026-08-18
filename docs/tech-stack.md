# Tech Stack — wecms-web

Frontend for the WeCMS refactor: a client-rendered SPA inside the Next.js App
Router — no SSR data fetching, no server actions. Business APIs are consumed
from `wecms-api` over HTTP. One Next.js route handler exists in source
(overseas-payment Excel preview) but is not on the runtime path — see
[README.md § Architecture facts](README.md#architecture-facts).

Deployed to SIT and UAT from the `sit` / `uat` branches — see
[README.md § Environments](README.md#environments).

**Node 22 is required** — `package.json` declares `"engines": { "node": ">=22 <23" }`. Node 23+ is
deliberately excluded.

## Runtime dependencies

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.3 |
| UI runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS (+ `@tailwindcss/postcss`) | ^4.2.4 |
| CSS animation utilities | tw-animate-css — imported once in `app/globals.css`, no JS import | ^1.4.0 |
| Component primitives | Radix UI (`@radix-ui/react-{checkbox,dialog,label,slot}`) + shadcn (`components.json`) | — |
| Variants / class utils | class-variance-authority, clsx, tailwind-merge | — |
| Icons | lucide-react | ^1.8.0 |
| Forms + validation | react-hook-form, @hookform/resolvers, zod | — |
| HTTP | axios | ^1.15.2 |
| Excel **parsing** (upload) | xlsx — 7 files, all read-side | ^0.18.5 |
| Excel **writing** (unreferenced) | xlsx-js-style — 2 files, **neither reachable from any call site** | ^1.2.0 |
| PDF generation | jspdf + html2canvas-pro — `lib/pdf.ts` | ^4.2.1 / ^2.2.4 |
| QR codes | qrcode-generator — `components/addon/einvoices/detailDisplay.ts` (e-invoice QR) | ^2.0.4 |

## Dev / test dependencies

| Layer | Choice | Version |
|---|---|---|
| Test runner | vitest | ^2.1.9 |
| Test environment | jsdom | ^24.1.3 |
| Component testing | @testing-library/react | ^16.3.2 |
| DOM matchers | @testing-library/jest-dom | ^6.9.1 |
| JSX transform for tests | @vitejs/plugin-react | ^4.7.0 |
| Lint | eslint + eslint-config-next | ^9 / 16.2.3 |
| Types | @types/node ^20, @types/react ^19, @types/react-dom ^19 | — |

Full setup, include globs, and current test inventory:
[testing/testing-strategy.md](testing/testing-strategy.md).

## Excel: read vs. write

The two Excel packages serve opposite directions, and only one is live:

- **`xlsx` — parsing uploads.** `lib/xlsxReader.ts`,
  `components/shared/excel-upload/templateValidator.ts`,
  `components/settings/chart-of-accounts/useExcelUpload.ts`,
  `components/settings/contacts/ExcelUploadDialog.tsx`, and the off-runtime-path
  overseas-payment preview route handler.
- **`xlsx-js-style` — writing workbooks, dead code.** `lib/reportExcel.ts` has zero importers, and
  `exportDailyCashExcel` in `lib/dailyCashExport.ts` is never imported (only its sibling
  `printDailyCashReport` is consumed). Both are residue from the migration to backend generation.

**Every live Excel export calls the backend** — Apache POI on `wecms-api` is the single workbook
producer; the client ships JSON and saves the returned blob. CSV is not a sanctioned export format.
See [references/api-contract.md § XLSX generation policy](references/api-contract.md#xlsx-generation-policy)
for the source-verified scope of CLAUDE.md §13b.

## Explicitly not used

Do not introduce without a written reason: NextAuth · next-intl · react-i18next · Redux · Zustand ·
react-query / TanStack Query · SWR · Bootstrap · Material UI · Chakra · Heroicons · a second font
family. There is **no** server-cache library and **no** global store — data fetching is
`lib/api/useApiData.ts`; state is React Context + `localStorage` + component-local `useState`.

> ⚠️ **Next.js 16 differs from earlier versions** — read [../AGENTS.md](../AGENTS.md) and
> `node_modules/next/dist/docs/` before writing non-trivial code.

Derived from `wecms-web/package.json` and verified against actual imports on 2026-08-17. Keep in
sync when dependencies change — and re-check whether a listed package is still *imported*, not just
still installed.
