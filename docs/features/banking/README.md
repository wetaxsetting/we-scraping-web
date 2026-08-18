# Banking — Frontend Feature Docs

**Status: CURRENT (index)** — navigation only. Each linked screen doc carries its own status; see [../../README.md § Status vocabulary](../../README.md#status-vocabulary).

Per-screen Next.js design docs for the **Banking** top-menu module. The folder tree mirrors the live WeCMS Banking menu and sidebar: each menu group is a folder, each submenu page is a leaf folder carrying the standard 6-doc set (README · screen-flow · ui-specification · component-index · api-consumption · test-scenarios).

> **Cross-cutting:** Banking top-menu / sidebar / route-guard / active-state behavior across product types (F/M/H) and permission cases is documented once in **[menu-sidebar-route-guard-behavior.md](menu-sidebar-route-guard-behavior.md)** (verified 2026-06-07). Backend twin: [wecms-api/.../menu-authorization-and-product-types.md](../../../../wecms-api/docs/features/banking/menu-authorization-and-product-types.md).

## Banking top menu → docs

| # | Menu group | Submenu page | Leaf folder | Route |
|---|---|---|---|---|
| 1 | **Current & Savings (VND)** | Account Inquiry | [current-savings-vnd/account-inquiry/](current-savings-vnd/account-inquiry/README.md) | `/banking/account-inquiry` |
|   | | Transaction History | [current-savings-vnd/transaction-history/](current-savings-vnd/transaction-history/README.md) | `/banking/transaction-history` (+ `[accountId]`) |
| 2 | **Current & Savings (FCY)** | Account Inquiry | [current-savings-fcy/account-inquiry/](current-savings-fcy/account-inquiry/README.md) | `/banking/account-inquiry-fcy` |
|   | | Transaction History | [current-savings-fcy/transaction-history/](current-savings-fcy/transaction-history/README.md) | `/banking/transaction-history-fcy/[accountId]` |
| 3 | **Smart Organizer** | Smart Organizer | [smart-organizer/](smart-organizer/README.md) | `/banking/smart-organizer` |
| 4 | **Internal Transfer (VND)** | Own Account Transfer | [internal-transfer-vnd/own-account-transfer/](internal-transfer-vnd/own-account-transfer/README.md) | `/banking/transfer-own-accounts` ⚠️ |
|   | | Transfer History | [internal-transfer-vnd/transfer-history/](internal-transfer-vnd/transfer-history/README.md) | `/banking/transfer-history` ⚠️ |
| 5 | **Reports** | Daily Cash | [reports/daily-cash/](reports/daily-cash/README.md) | `/banking/reports/daily-cash` |
|   | | Daily Financial | [reports/daily-financial/](reports/daily-financial/README.md) | `/banking/reports/daily-financial` (+ `-hs`) |
|   | | Cash Flow | [reports/cash-flow/](reports/cash-flow/README.md) | `/banking/reports/cash-flow` |

Group hubs: [current-savings-vnd/](current-savings-vnd/README.md) · [current-savings-fcy/](current-savings-fcy/README.md) · [internal-transfer-vnd/](internal-transfer-vnd/README.md) · [reports/](reports/README.md).

> ⚠️ **Internal Transfer routes corrected 2026-08-17.** The two rows above previously listed
> `/banking/own-account-transfer` and `/banking/internal-transfer/transfer-history`. Verified against
> the App Router:
> - **Own Account Transfer** is canonically `/banking/transfer-own-accounts`
>   ([`app/(dashboard)/banking/transfer-own-accounts/page.tsx`](../../../app/(dashboard)/banking/transfer-own-accounts/page.tsx)).
>   `/banking/own-account-transfer` still resolves but is a **permanent redirect** kept only so
>   existing bookmarks and `?sourceAccountNo=` deep-links don't 404 (consolidated 2026-06-06).
> - **Transfer History** is `/banking/transfer-history`
>   ([`app/(dashboard)/banking/transfer-history/page.tsx`](../../../app/(dashboard)/banking/transfer-history/page.tsx)).
>   There is **no** `/banking/internal-transfer/*` route — that prefix belongs to Payment
>   (`/payment/internal-transfer/…`), which is a different module.

> **📊 WEB flow & process (visual handover):** [banking-web-flow-process.html](banking-web-flow-process.html) — single-page visual guide to the whole Banking **frontend**: menu structure · navigation flow · per-screen UI flows · search/filter/grid behavior · button actions · API call flow · state management · validation/error states · authorization/menu visibility · components/routes. Open in a browser. Backend twin: [wecms-api/.../banking-flow-process.html](../../../../wecms-api/docs/features/banking/banking-flow-process.html).

> **Smart Organizer** is full-stack refactor complete — one page serves **VND + FCY** (currency follows the selected account; no separate FCY page). It is its own top-menu group. Older per-currency single-file specs are preserved as [smart-organizer/legacy-spec-vnd.md](smart-organizer/legacy-spec-vnd.md) + [smart-organizer/legacy-spec-fcy.md](smart-organizer/legacy-spec-fcy.md).
> **Daily Financial (HS)** ⚠️ — an `H`-product variant route `/banking/reports/daily-financial-hs` exists; its doc scope is folded into [reports/daily-financial/](reports/daily-financial/README.md) (OQ-DOC-8).

## Not part of the Banking top menu (root-level reference docs)
- [bank-credentials.md](bank-credentials.md) — Credentials list · Add · live scrape (OTP / QNA / CAPTCHA) — high-level summary.
- [menu-sidebar-route-guard-behavior.md](menu-sidebar-route-guard-behavior.md) — cross-cutting sidebar/route-guard reference.
- [../../audits/banking-display-rule-parity-audit.md](../../audits/banking-display-rule-parity-audit.md) — module-wide legacy display-rule parity audit (amount/date/alignment/tooltip) + the 2026-06-26 fixes (formatAmount / formatDateLang / EllipsisTooltip adoption). Cross-cutting; covers every Banking screen. *(Moved to [../../audits/](../../audits/README.md) on 2026-08-17 — audits now live in one place.)*

## Related components
- [`components/shared/AccountInquiryPage.tsx`](../../../components/shared/AccountInquiryPage.tsx) — approved baseline for standard menu pages
- [`components/banking/transaction-history/`](../../../components/banking/transaction-history/) · [`components/banking/internal-transfer/`](../../../components/banking/internal-transfer/) · [`components/banking/reports/`](../../../components/banking/reports/)
- Shared report shell [`components/shared/ReportLayout.tsx`](../../../components/shared/ReportLayout.tsx) (Reports group only — no pagination)

## Related backend docs
[`wecms-api/docs/features/banking/`](../../../../wecms-api/docs/features/banking/README.md) — feature-paired API docs (same menu slugs).
