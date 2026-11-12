# WeInvoice — Frontend (P1 static UI)

**Status: CURRENT** (as of 2026-11-03) · **Data: MOCK** — no backend is called yet.

WeInvoice gathers a customer's purchase / sales e-invoices (GDT list + XML, provider PDFs, email,
manual upload), de-duplicates them across channels, and offers search, tags, ZIP download, checks,
taxpayer lookup, filed returns and auto-journal. Source of truth for UI and business rules is the
handover package **WeInvoice UI Spec v1.0** (PO WeCMS, 2026-10-30), kept outside this repo:
`01_Dac_ta_UI.html` (screens) and `02_Yeu_cau_nghiep_vu.md` (rules — referenced below as §).

Change history: [weinvoice-p1-ui-transformation-2026-11-03.md](weinvoice-p1-ui-transformation-2026-11-03.md).
Manual scenarios: [test-scenarios.md](test-scenarios.md).

## Routes

Top-nav module → sidebar group → screen. Map: [lib/weinvoice/nav.ts](../../../lib/weinvoice/nav.ts).

| Module | Route | Component | Phase |
|---|---|---|---|
| Invoices | `/dashboard` | [Dashboard](../../../components/dashboard/Dashboard.tsx) | MVP |
| Invoices | `/invoices/purchase`, `/invoices/sales` | [InvoiceListPage](../../../components/invoices/InvoiceListPage.tsx) + [InvoiceDetailModal](../../../components/invoices/InvoiceDetailModal.tsx) | MVP |
| Invoices › Sources | `/sources/gdt` | [ConnectionsPage](../../../components/connections/ConnectionsPage.tsx) | MVP |
| Invoices › Sources | `/sources/email`, `/sources/mailbox` | [EmailPage](../../../components/upload/EmailPage.tsx), [MailboxPage](../../../components/upload/MailboxPage.tsx) | MVP |
| Invoices › Sources | `/sources/upload` | [UploadPage](../../../components/upload/UploadPage.tsx) | MVP |
| Invoices › Sync | `/sync/history`, `/sync/bulk` | [SyncPages](../../../components/sync/SyncPages.tsx) | MVP |
| Tax | `/tax/filed` | [FiledPage](../../../components/tax/FiledPage.tsx) | MVP |
| Tax | `/tax/journal` | [JournalPage](../../../components/tax/JournalPage.tsx) | MVP |
| Checks | `/checks/invoices`, `/checks/supplier-risk` | [InvoiceCheckPage](../../../components/checks/InvoiceCheckPage.tsx), [SupplierRiskPage](../../../components/checks/SupplierRiskPage.tsx) | MVP |
| Tools | `/tools/xml-viewer`, `/tools/providers`, `/tools/taxpayer-lookup` | [tools/](../../../components/tools/) | MVP |
| Settings | `/settings/general`, `/settings/tags`, `/settings/users` | [settings/](../../../components/settings/) | MVP |
| Roadmap | `/tax/vat-return`, `/tax/reduction`, `/reports/listing`, `/reports/accounting-export`, `/tools/pdf-merge`, `/settings/plan` | [ComingSoon](../../../components/soon/ComingSoon.tsx) | intro page only (§2) |
| Auth | `/login` | [app/(auth)/login/page.tsx](../../../app/(auth)/login/page.tsx) | MVP |

Every authenticated route is gated by [proxy.ts](../../../proxy.ts) (`wecms_token` cookie) and renders
inside [AppShell](../../../components/layout/AppShell.tsx): blue header with module tabs, working-MST
switcher, language menu (VI / EN / KO), command palette (Ctrl+K); sidebar groups per module.

## Architecture

```
app/(dashboard)/<module>/<screen>/page.tsx      thin route
  └─ components/<module>/*                      screen UI (spec layout)
       ├─ components/shared/*  · components/ui/*  shared primitives (dialog, Modal, Button, Select…)
       └─ lib/api/weinvoice/*                   data access — MOCK today
            └─ store.ts  ← mockData.ts           in-memory state, deterministic seed
lib/weinvoice/*                                 domain: types, nav, formatters, provider catalogue, XML
```

- **Swap point.** Screens only call `lib/api/weinvoice/*`. Replacing the mock bodies with REST calls
  (wire = lowercase snake_case, CLAUDE.md §"API Naming") does not touch the screens.
- **State resets on reload** — nothing is persisted in the browser.
- **Data source switch** `NEXT_PUBLIC_WEINVOICE_DATA_SOURCE` (`mock` default · `api`). With `api`,
  every P1 screen reads the backend (`/api/v1/weinvoice/*`, published contract): the store starts
  empty, is hydrated after login with `working_company_mst` from `GET /api/v1/weinvoice/me`, and an
  error banner lists any endpoint that failed. Mailboxes are loaded by their own screens
  (`/mailboxes*`, [mailbox connections](weinvoice-mailbox-connections-2026-11-12.md)); sub-accounts are not in
  the backend API (shown as not available). P3–P6 screens stay on the mock.
- **Login is real** ([lib/weinvoice/auth.ts](../../../lib/weinvoice/auth.ts) → `POST /api/v1/auth/login`,
  `GET /me`, `POST /logout`; transport [lib/axios.ts](../../../lib/axios.ts)). Users linked to several
  companies pick one before the token is issued. Wiring record:
  [weinvoice-api-integration-2026-11-03.md](weinvoice-api-integration-2026-11-03.md).

## Business rules implemented in the mock layer

| § | Rule | Where |
|---|---|---|
| 3.1 | Direction from the working MST; every list scoped to it | `invoices.filterInvoices` |
| 3.2 | De-dup key = seller MST + template + symbol + number (no leading zeros); outcomes new / merged / duplicate / foreign / error | `invoices.importParsed`, `types.invoiceKey`, `xml.parseInvoiceXml` |
| 3.3 | `K…` = no GDT code; 4th char `M` = cash register; statuses incl. replacement ↔ replaced links | `types.isNoCode / isCashRegister`, seed |
| 3.4 | Provider from `<MSTTCGP>`; name pill + ↗; direct original link only where the provider URL accepts the code, otherwise the provider lookup page; `!` when a code is needed | `providers.ts`, `invoices.lookupHref / needsLookupCode` |
| 3.5 | File record per invoice; only uploaded / email files can be deleted | `invoices.addFile / removeFile` |

Rules §3.6–§3.10 live in their screens' mock modules — see the dated record for the per-screen notes.

## Not in this build

- Any backend call (GDT sync engine, provider PDF retrieval, mailbox scan, registry lookup, tax portal).
- Excel generation — owned by the backend (CLAUDE.md §13b); the buttons explain that export is not available yet.
- Server-backed View Setting — the invoice list keeps the spec's local column toggles.
