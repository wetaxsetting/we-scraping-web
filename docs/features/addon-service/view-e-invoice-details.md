# View e-Invoice Details — Frontend Refactor Design (wecms-web)

**Module:** Add-on Service · **Feature slug:** `view-e-invoice-details` (shared by Sales & Expenses)
**Route:** none — it is a modal over `/addon/sales-einvoices` and `/addon/expenses-einvoices`
**JEX source of truth (read-only):** [docs/jex/features/view-e-invoice-details.md](../../../../docs/jex/features/view-e-invoice-details.md)
**Backend counterpart:** [wecms-api/docs/features/addon-service/view-e-invoice-details.md](../../../../wecms-api/docs/features/addon-service/view-e-invoice-details.md)
**Status:** ✅ **Implemented (2026-07-15).** `fetchEInvoiceDetail` (`lib/api/addon.ts`), wire types + `mapEInvoiceDetail` (`lib/types/api.ts` + `lib/api/mappers.ts`), `EInvoiceDetail` model + `toDisplayInvoice` (`components/addon/einvoices/detailTypes.ts` + `detailDisplay.ts`), `useEInvoiceDetail` hook (wraps `useApiData`), and the modal bound to live data. **Print + PDF render from the modal's own DOM** — `printElement` (`lib/print.ts`) + `downloadElementAsPdf` (`lib/pdf.ts`, html2canvas-pro + jsPDF). `tsc` + ESLint clean; modal test 8/8.

> **100% parity by construction (2026-07-15):** modal, Print, and PDF all render the single
> `<InvoiceDocument>` component — no separate print/PDF layout on either tier (the backend
> `/pdf` + `/print` endpoints were removed). The summary is the two-column block matching
> legacy `einv_0002_002`: LEFT = fee table (only when the invoice has fees, REC2) + the
> tax-rate breakdown with **all** REC3 rows; RIGHT = the six-row totals block.
> Unlink is out of scope (OQ-CON resolved — no Unlink feature; `con_doc_id` removed).

> **Goal.** Turn the existing static modal into a live one: fetch the selected invoice,
> bind it, and wire Print + PDF. The modal markup already reproduces the Vietnamese VAT
> invoice — the work is data binding + the two actions, not a UI rebuild.

---

## 1. Current state

- `components/addon/einvoices/ViewEInvoiceDetailsModal.tsx` — exists, shared by Sales
  (Figma 305-8355) and Expense (305-7885), title differs only. **Renders a hardcoded
  `MOCK_INVOICE`; the `invoice` prop is accepted but ignored.**
- List client `components/addon/sales-einvoices/EInvoicesClient.tsx` (shared by both lists)
  already captures the clicked row into `selectedInvoice` state and opens the modal — but
  passes nothing usable into it.
- `lib/api/addon.ts` has every e-invoice call **except** a detail fetch.
- Print = raw `window.print()` (component comment flags this as a deviation from the shared
  `lib/print.ts`). PDF = placeholder no-op.

---

## 2. Work items

### 2.1 API client + wire type

Add to `lib/api/addon.ts`:

```ts
export async function fetchEInvoiceDetail(docId: string, type: "SALES" | "EXPENSE")
  : Promise<EInvoiceDetail>
// GET /api/v1/addon/einvoices/{docId}?type=... → unwrap() → map to EInvoiceDetail
```

- Add the wire type in `lib/types/api.ts` (lowercase snake_case, matching the backend DTO
  in the counterpart doc §3) and a mapper to the camelCase UI model.
- **Map the response into the existing `MockInvoice` shape** so the modal markup stays
  unchanged (the component's own note asks for exactly this). Rename `mockInvoice.ts`'s
  type to a real `EInvoiceDetail` model; keep the mock as a Storybook/test fixture only.

### 2.2 Bind the modal to real data

- `ViewEInvoiceDetailsModal` consumes the `invoice` prop (stop ignoring it). Fetch on open
  via a small hook (`useEInvoiceDetail(docId, type)`), show a loading state, render `WBE`
  errors through the standard error surface.
- `EInvoicesClient`: on row click, pass `docId` + `type` (`"SALES"|"EXPENSE"` from the
  existing `type` prop) into the modal; drop the unused `selectedInvoice` mock path.
- **Preserve legacy rendering rules** (JEX audit §5): the backend now returns explicit
  `seller`/`buyer` objects (server already did the `ISSU_*`/`TRCO_*` swap), so the modal
  just renders `seller.*` / `buyer.*` — no client-side DOC_TYPE swap. Keep the
  `test_result === "2"` branch that hides payment-type/bank/address and shows buyer phone +
  citizen id.
- Amounts via `lib/currency.ts formatAmount` (VND), dates via the shared date formatter —
  same as the list, so the modal and list agree.

### 2.3 Print — the modal's own DOM (OQ-PDF/Print RESOLVED 2026-07-15, client-side)

Print is generated from the modal's **own rendered `<InvoiceDocument>` DOM** — not a server
template. The modal renders an off-screen full-size copy of `<InvoiceDocument>` (a `captureRef`
div at natural 1080px, no fit-to-modal scale); `handlePrint` calls `printElement(captureRef.current)`
(`lib/print.ts`), which clones that node into a hidden iframe **with the app's own stylesheets**
and prints it natively. Byte-for-byte the on-screen invoice, no app chrome.

### 2.4 PDF — the same DOM → jsPDF (OQ-PDF RESOLVED, client-side)

`handlePdf` calls `downloadElementAsPdf(captureRef.current, "<docId>.pdf")` (`lib/pdf.ts`),
which raster-captures the same `<InvoiceDocument>` node via **html2canvas-pro** (handles
Tailwind-4 `oklch` colours) and lays it into a multi-page A4 **jsPDF** for a direct download.
Vietnamese renders via the browser's Times New Roman — no embedded font needed.

**100% parity by construction:** modal, Print, and PDF all render the single `<InvoiceDocument>`
component. No separate print/PDF layout exists on either tier; the backend `/pdf` + `/print`
endpoints were removed.

---

## 3. Typography exception

The invoice body is a legal VAT form and uses **Times New Roman** (legacy parity), which is
the documented exception to the global Inter/Noto type stack (root CLAUDE.md "Global
Typography"). Keep this scoped to the invoice document region only, and call it out in the
PR description per the typography-exception rule. All chrome around the invoice (modal
header, buttons) uses the standard tokens.

---

## 4. Files touched

| File | Change |
|---|---|
| `lib/api/addon.ts` | `fetchEInvoiceDetail` (detail JSON only) |
| `lib/types/api.ts` · `lib/api/mappers.ts` | detail wire type + `mapEInvoiceDetail` |
| `components/addon/einvoices/detailTypes.ts` · `detailDisplay.ts` | `EInvoiceDetail` model + `toDisplayInvoice` |
| `components/addon/einvoices/ViewEInvoiceDetailsModal.tsx` | live data + off-screen capture node; Print→`printElement`; PDF→`downloadElementAsPdf` |
| `components/addon/einvoices/mockInvoice.ts` | `MockInvoice` + `fees[]`/`taxRows[]`; fixture only |
| `components/addon/sales-einvoices/EInvoicesClient.tsx` | pass `docId`+`type` into modal |
| `lib/print.ts` | `printElement(node)` (iframe + app CSS) |
| `lib/pdf.ts` (new) | `downloadElementAsPdf(node, fileName)` (html2canvas-pro + jsPDF) |
| `hooks/useEInvoiceDetail.ts` (new) | fetch-on-open hook |
| deps | `jspdf` + `html2canvas-pro` |

---

## 5. Open questions

- **OQ-PDF / Print source — RESOLVED 2026-07-15 (client-side, modal DOM).** Print + PDF render
  from the modal's own `<InvoiceDocument>` DOM (§2.3–2.4); the backend `/pdf` + `/print`
  layer was removed. No separate print/PDF layout on either tier.
- **OQ-CON — RESOLVED 2026-07-15: no Unlink.** The refactor has no Unlink feature — the modal
  never renders an Unlink button, and the `con_doc_id` field was removed from the wire type /
  `EInvoiceDetail` model / mapper. Out of scope unless a future PO decision revives it.

---

## Changelog
### v2.2.0 — 2026-07-16
- **Popup layout brought to live-JEX parity (`assets_v2/add.css .layerCont.e-invoice-details`
  + `einv_0002_001_view.jsp .book`).** The invoice preview now renders as a **fixed 21 cm
  (≈ 794 px) A4 sheet centered** in the modal — matching the legacy `.book` (`width:21cm;
  padding:2cm 0.75cm; margin:0.5cm auto`) — instead of being stretched edge-to-edge. Section
  spacing switched from a uniform `gap-8` to the legacy mm-based rhythm (title `mt 5mm`,
  date/MCCQT `mt 3mm`, summary blocks `border-top` brown `rgba(145,87,21,0.69)` + `mt/pt 2mm`,
  signatures `pt 20mm`, footer `mt 10mm`). Typography aligned to legacy: 30px/600 title, 16px
  prose + table cells, table cells padded `7px 5px` with top-aligned body, item column widths
  `6/13/23/8/7/12/8/8/15`, summary tables `40/60` + `20/·/28`, signature box green `#20b708`.
  Preview surface is `bg-wb-bg-sidebar` so the sheet reads as a page.
- **Zoom in / out control added** to the modal title bar (left of Close), mirroring the legacy
  layer-popup `.layerPopup-resize` toggle (zoom-out ⇄ zoom-in cursor). Default = fit (natural
  A4 sheet centered, capped to modal width); toggled = scale the whole sheet up to fill the
  width. Scaling is uniform (`ScaledInvoice`, `SHEET_WIDTH = 794`), so fonts / tables / spacing /
  watermark grow together. New i18n keys `einvoice_view_detail.zoom_in` / `.zoom_out` (EN/KO/VI).
  Print + PDF unchanged — still render the off-screen natural-width `<InvoiceDocument>`.

### v2.1.2 — 2026-07-16
- **Full legacy parity — `einv_testresul === "2"` variant wired.** For an Expense
  (DOC_TYPE `B`) test invoice, the document now hides the seller bank-account row, the buyer
  full-name / address / bank-account / payment-method rows, and the currency block, and shows
  the buyer **phone** + **citizen id** rows instead (legacy `einv_0002_001.ts:142-173`).
  Computed once in `toDisplayInvoice` (`testVariant = testResult === "2" && docType === "B"`)
  and applied in `InvoiceDocument`; backend already ships `buyer.phone`, `buyer.citizenId`,
  and `test_result`. Normal invoices are unaffected. Flows to Print + PDF automatically.

### v2.1.1 — 2026-07-16
- **PDF QR fix.** The QR was emitted as an inline SVG data-URI, which html2canvas-pro cannot
  rasterize — the downloaded PDF showed only a broken corner of the matrix. Switched
  `qrDataUri` (renamed from `qrSvgDataUri`) to `qrcode-generator`'s `createDataURL(8, 0)`,
  a pure-JS **raster GIF** data-URI (`data:image/gif;base64,…`). Raster `<img>` both
  serializes into the Print `innerHTML` clone and rasterizes cleanly under html2canvas, so
  the modal, Print, and PDF now show the identical, scannable QR. Header title also aligned
  to the modal-popup contract (`text-wb-18 font-semibold`, `px-6`).

### v2.1.0 — 2026-07-16
- QR code now renders the **real** GDT payload (verbatim `qr_code`/`EINV_QRCODE`) as a QR
  via `qrDataUri` (`detailDisplay.ts`, encoder `qrcode-generator`, ECC `M` ≈ GDT's 41×41) —
  replaced the static `/assets/addon/einvoice-qr.png` placeholder. Raster-in-`<img>` so it
  flows through both Print (DOM clone) and PDF (html2canvas). `MockInvoice` gained `qrPayload`.
  The payload is GDT-generated and rendered as-is — never reconstructed (see
  `docs/gdt-einvoice-qr-generation-analysis.md`).

### v2.0.0 — 2026-07-15
- Print + PDF now render from the modal's own `<InvoiceDocument>` DOM (client-side) for 100%
  parity: `printElement` (iframe + app CSS) + `downloadElementAsPdf` (html2canvas-pro + jsPDF).
  Added `jspdf` + `html2canvas-pro`; removed the server `fetchEInvoicePrintHtml` /
  `downloadEInvoicePdf` clients (and the backend `/pdf` + `/print` endpoints).

### v1.2.0 — 2026-07-15
- Modal summary brought to full legacy parity: two-column block (LEFT fee table [when
  present] + all tax-rate rows; RIGHT totals). `MockInvoice` gained `fees[]` + `taxRows[]`;
  the single-tax-row `summary.taxRateCode/amountBeforeTax/totalTax` fields were removed.

### v1.1.0 — 2026-07-15
- OQ-PDF/Print resolved: Print fetches the server-rendered HTML (`.../{docId}/print`) and
  prints it via `printHtmlDocument`; client-side `buildEInvoicePrintHtml` removed.
- OQ-CON resolved: no Unlink; `con_doc_id` removed from wire/model/mapper.

### v1.0.0 — 2026-07-15
- Initial frontend refactor design (proposed) for the live detail modal + Print + PDF.
