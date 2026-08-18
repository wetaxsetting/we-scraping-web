# integrations/

Browser-side integrations for `wecms-web` — everything the client talks to that is **not** the
`wecms-api` REST contract. Verified against source 2026-08-17.

> **Corrected 2026-08-17.** An earlier version of this page described hypothetical integrations
> ("charting libraries, file-upload widgets, OTP / 2FA widgets, e-invoice viewers, external auth
> flows") and linked to two `wecms-api` figma/integration folders. None of that described this
> codebase. The real set is below.

## 1. NXiSAS — local scraping engine (the big one)

The only genuine third-party runtime integration. [`lib/nxisas/`](../../../lib/nxisas/) — 11 modules
— drives bank scraping and e-invoice/GDT scraping through a **locally installed NXiSAS engine**, via
a legacy JS bundle loaded on demand.

| Module | Role |
|---|---|
| `jexjs-adapter.ts` | Adapter over the legacy JEX bundle |
| `nxisas_api.ts` · `nxisas_cardTranList.ts` | Engine call surfaces |
| `otp-bridge.ts` · `qna-bridge.ts` · `confirm-bridge.ts` · `system-message-bridge.ts` | Interactive-auth bridges — OTP, Q&A, confirmations, engine messages surfaced as app dialogs |
| `einvoiceScrape.ts` (+ `.test.ts`) | e-Invoice / GDT scrape |
| `gdtCredentialValidate.ts` | GDT credential validation |
| `nxisas-debug.ts` | Debug logging, gated by `NEXT_PUBLIC_NXISAS_DEBUG` |

Two operational facts that are easy to lose:

- **The engine is licensed per page origin.** Source records SIT (`wecms.kosign.dev`) as a verified
  origin. A new origin needs a licence, or scraping silently fails.
- **The bundle is loaded by the page that needs it** (`useNxisasEngine` in
  `components/banking/own-account-transfer/hooks/`), not by a route layout — so other dashboard
  pages never pay its very large asset cost.

A verbatim copy of the legacy bundle is kept as a **behavioural spec only** at
[`../../references/legacy/nxisas_api.js`](../../references/legacy/nxisas_api.js) — never imported,
never served.

## 2. Client-side document generation

Browser-side file production, using bundled npm packages rather than an external service:

| Package | Used by |
|---|---|
| `xlsx` | [`lib/xlsxReader.ts`](../../../lib/xlsxReader.ts), Excel-upload template validation, Contacts / Chart-of-Accounts imports |
| `xlsx-js-style` | [`lib/reportExcel.ts`](../../../lib/reportExcel.ts), [`lib/dailyCashExport.ts`](../../../lib/dailyCashExport.ts) |
| `jspdf` + `html2canvas-pro` | [`lib/pdf.ts`](../../../lib/pdf.ts) |
| `qrcode-generator` | e-invoice detail rendering (`components/addon/einvoices/detailDisplay.ts`) |
| — (template patching) | [`lib/xlsxTemplate.ts`](../../../lib/xlsxTemplate.ts) + [`lib/xlsxToHtml.ts`](../../../lib/xlsxToHtml.ts) — patch an authority workbook under `public/templates/`, then export it as XLSX or render it to printable HTML. Used by Tax Filing. |

> **This coexists with a CLAUDE.md rule that says the backend is the single XLSX producer**
> ([§13b](../../../CLAUDE.md)). Both statements are currently true of different screens: the shared
> View-Setting-driven export path is backend-produced, while Reports, Daily Cash, and Tax Filing
> generate client-side — Tax Filing deliberately, because the filed document must be the authority's
> own workbook and must reflect unsaved edits. **Reconciling the rule with the code is an open item**
> and is not settled here.

## 3. Fonts

`next/font/google` — Inter + Noto Sans KR, attached in `app/layout.tsx`. The only sanctioned font
loading path; never add a second family or a `<link>`.

## 4. What is *not* an integration here

- **`wecms-api`** — the REST contract, not a third-party integration. See
  [../../README.md § Architecture facts](../../README.md#architecture-facts).
- **Analytics / error reporting / feature flags / maps / charts** — none. No chart library is
  installed.
- **NextAuth or any external identity provider** — none. Auth is a plain Axios call plus
  `localStorage`, gated at the edge by [`proxy.ts`](../../../proxy.ts).

## Related

- [../routes/](../routes/) — the edge auth gate
- [../state-management/](../state-management/) — where the token lives
- Banking credential / scrape screens: [../../features/banking/bank-credentials.md](../../features/banking/bank-credentials.md)
