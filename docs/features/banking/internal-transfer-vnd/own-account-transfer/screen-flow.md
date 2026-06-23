# Own Account Transfer — Screen Flow (Frontend)

User-facing flow of the shipped Next.js screen. Backend flow: [business-flow.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/business-flow.md).
Legacy functional reference: [docs/jex/features/own-account-transfer/business-flow.md](../../../../../../docs/jex/features/own-account-transfer/business-flow.md).

---

> **Navigation reachability (Option A implemented 2026-06-06).** This page is the **real NXiSAS
> transfer composer/execution** screen. It is **not** itself a sidebar/top-nav entry — the canonical
> Own Account Transfer **menu** route is `/banking/transfer-own-accounts` (the read-only list). The
> list's per-row **Transfer** button now **navigates here** with the clicked account in
> `?sourceAccountNo=<acctNo>`; this page reads that param and **preselects + auto-opens the composer**
> for the matching source row when it is transfer-eligible (same `canTransfer` + engine-ready +
> saved-credentials guard the row button uses). An unknown / non-VND / ineligible account falls through
> to a normal direct-visit landing. The earlier in-page **mock** `<TransferDialog>` on the list page was
> retired. Both routes + all `…/own-account-transfer/*` APIs share the cd
> `banking-internal-transfer-own` (unchanged). The composer route is **kept** (never redirected to the
> list). Full record: [own-account-transfer-flow-gap.md §8](../../../../../../docs/jex/features/menu-product-type-management/own-account-transfer-flow-gap.md).

## 1. Route & composition

- **Route:** `/banking/own-account-transfer` → [`app/(dashboard)/banking/own-account-transfer/page.tsx`](../../../../../app/(dashboard)/banking/own-account-transfer/page.tsx) (server component: metadata only).
- Renders [`<OwnAccountTransferClient>`](../../../../../components/banking/own-account-transfer/OwnAccountTransferClient.tsx) → [`<OwnAccountTransferPage>`](../../../../../components/banking/own-account-transfer/OwnAccountTransferPage.tsx) (`"use client"` — owns all state, hooks, dialogs).
- The ~50 MB NXiSAS vendor bundle loads **only** on this page (via `use-nxisas-engine`), never in the dashboard layout.

## 2. Flow diagram

```
/banking/own-account-transfer
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│ PageHeader (title + View Setting list icon)                   │
│ EngineStatusBanner (loading / ready / not_installed / …)      │
│ FilterRow ─ Bank selector (All Banks ▼)                       │
│ DataTableShell                                                │
│   SourceAccountsTable (View-Setting columns, sortable)        │
│   SourceAccountsTableFooter (Σ accounts · Σ balance · Σ avail)│
│   Pagination (10/20/50/100)                                   │
└──────────────────────────────────────────────────────────────┘
   │
   ├─ click [Transfer] on a row ──▶ OwnAccountTransferComposerDialog
   │        │
   │        ├─ load target accounts (GET target-accounts)
   │        ├─ (NAPAS) validate recipient bank (GET napas-bank-info)
   │        ├─ drive engine: LOGIN → 2nd-factor → TRANSFER → LOGOUT
   │        │      (OtpAuthDialog / QnA / TransferConfirmationDialog bridged
   │        │       from lib/nxisas/*-bridge.ts)
   │        └─ POST scraping-result (idempotent) → success / failed dialog → reload list
   │
   └─ View Setting icon ──▶ shared <ViewSettingPopover screenId="own-account-transfer">
```

## 3. NXiSAS engine lifecycle (`use-nxisas-engine.ts`)

States surfaced by `<EngineStatusBanner>` and the engine dialogs:

| Status | UI |
|---|---|
| `loading` / `probing` | Banner: "Checking transfer engine…" |
| `ready` | Banner hidden; Transfer buttons enabled (for `canTransfer` rows with saved credentials). |
| `not_installed` | `<EngineNotInstalledDialog>` — Download NXiSAS.exe + Check Installation. |
| `unsupported_os` | `<EngineUnsupportedOsDialog>` — non-Windows acknowledge-only. |
| `timeout` / `load_error` | Banner with retry. |

Lifecycle: load vendor bundle (jquery → json2 → platform → swfobject → web_socket → isasscaping → nxisas_v2,
fixed order) → install JEX adapter → probe (`openNxisas`, 30 s timeout) → ready. A fire-and-forget
`POST engine-connection-check` records the handshake outcome for compliance (OQ-4).

## 4. Transfer execution (composer)

1. Source row's **Transfer** button opens `<OwnAccountTransferComposerDialog>`.
2. Composer lazy-loads targets (`loadTargets`) and validates the draft client-side (`validateDraft`): target required, not self-transfer, positive amount, per-bank password rule, remark byte-limits.
3. For NAPAS transfers, `validateNapas` resolves the recipient bank.
4. Engine runs the bank-specific TRANSFER job (per `bank-profiles.ts`); 2nd-factor challenges (OTP / QnA / Confirm) are bridged from the engine popups via `lib/nxisas/*-bridge.ts` into the shared dialogs.
5. On completion the composer POSTs `submitScrapingResult(req)` with a client `idempotencyKey`; success → success dialog + `data.reload()`; engine/validation failure → error dialog.

## 5. Balance refresh

"Update Balance" runs an engine BALANCE scrape and POSTs the result; the Last-Refresh cell (`ACCT_BAL_LST_STS`)
updates with a Success/Failed badge + timestamp. **Deferred to the Phase-B composer MR (OQ-FE-1)** — the page
mounts the path but shows a "cert not configured" notice until saved credentials land.
