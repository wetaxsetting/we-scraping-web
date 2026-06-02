# Banking > Own Account Transfer — Frontend Page Design (Refactor)

**Refactor slug:** `own-account-transfer`
**Refactor route:** `/banking/own-account-transfer`
**Status:** Phase 1 — design only. No code in this phase.
**Feature spec:** [../../features/banking/own-account-transfer.md](./own-account-transfer.md)
**Backend API:** [../../backend/banking/own-account-transfer-api.md](../../../../../wecms-api/docs/references/api-spec/banking/own-account-transfer-api.md)
**Figma frame:** TBD (request from PO before Phase 3; legacy live URL is the visual fallback: `https://dev.wecms.vn/trns_0001_001.act`)

> Read [AGENTS.md](../../../../AGENTS.md) — this is **Next.js 16**. Check `node_modules/next/dist/docs/` before writing any non-trivial Next.js code.

> Typography, Tailwind tokens, font stack — see [root CLAUDE.md §Global Typography](../../../../../CLAUDE.md#global-typography-cross-tree). No raw `text-[14.5px]`, no inline `style={{ fontFamily }}`.

---

## 1. Route

```
app/(dashboard)/banking/own-account-transfer/
├── layout.tsx           ← NEW — loads the NXiSAS bundle <Script>s for routes that need them
└── page.tsx             ← thin server component: metadata + <OwnAccountTransferClient />
```

The shared dashboard layout (`app/(dashboard)/layout.tsx`) MUST NOT load the bundle globally — only routes that need it pull it via a nested route-level layout. This is the same isolation pattern Account Inquiry uses for its export hook.

Page-level metadata:
```ts
export const metadata = { title: "Own Account Transfer — WeCMS" };
```

## 2. Component tree

```
<OwnAccountTransferClient>          ← "use client"
   │
   │  state:  filters, sort, viewSettingDraft, composerTarget
   │  data:   useApiData(() => fetchOwnAccountSources(params), [params])
   │
   ├── <PageHeader title={t("own_account_transfer.title")}>
   │     └── <PageActionButtons items={["view-setting" /* no export, no print */]} />
   │           └── <ViewSettingPopover screenId={SCREEN_IDS.OWN_ACCOUNT_TRANSFER}>
   │
   ├── <FilterBar>
   │     └── <BankPopover                 ← shared component
   │              banks={allowedBanks}    ← computed from user.productType
   │              value={filters.bankCd}
   │              onChange={...} />
   │
   ├── <OwnAccountSourceTable
   │         columns={visibleColumns}     ← intersected with View Setting registry
   │         rows={rows}                  ← mapped via mapOwnAccountRow
   │         sort={sort}
   │         onSortChange={...}
   │         onTransferClick={(row) => setComposerTarget(row)} />
   │
   ├── <OwnAccountSourceTableFooter
   │         totals={totals}              ← mapped via mapOwnAccountTotals
   │         columnDef={...} />            ← same colgroup as table
   │
   ├── <Pagination
   │         pageSize={pageSize}
   │         onPageSizeChange={...}
   │         total={totals.total}
   │         page={page}
   │         onPageChange={...} />        ← client-side slice over `rows`
   │
   └── {composerTarget && (
          <OwnAccountTransferComposer    ← sibling refactor feature MR
             senderBankCd={composerTarget.bankCd}
             senderAcctNo={composerTarget.acctNo}
             senderBankCertSeq={composerTarget.bankCertSeq}
             onSuccess={(refreshResult) => {
                refresh();                ← refetch the source-accounts list
                setComposerTarget(null);
             }}
             onClose={() => setComposerTarget(null)} />
       )}
```

**Naming convention** — per [wecms-web/CLAUDE.md §API Naming](../../../../CLAUDE.md#api-naming--serialization-standards):

- Wire types in `lib/types/api.ts`: `ApiOwnAccountSourceRow`, `ApiOwnAccountSourceListResponse`, `ApiBalanceRefreshRequest`, `ApiBalanceRefreshResponse` — **snake_case** property names.
- In-memory types in `components/banking/own-account-transfer/types.ts`: `OwnAccountRow`, `OwnAccountTotals` — **camelCase** semantic names.
- Mappers in `lib/api/mappers.ts`: `mapOwnAccountRow`, `mapOwnAccountTotals`.

No component reads a snake_case property directly. If a developer is tempted to write `row.bank_cd` — extend the mapper, then consume.

## 3. Hooks

```
components/banking/own-account-transfer/
├── OwnAccountTransferClient.tsx
├── OwnAccountSourceTable.tsx
├── OwnAccountSourceTableColumns.tsx        ← shared colgroup (table + footer)
├── OwnAccountSourceTableFooter.tsx
├── hooks/
│   ├── useOwnAccountSources.ts             ← thin wrapper around useApiData
│   └── useBalanceRefresh.ts                ← mutation hook used by the composer
└── types.ts
```

`useOwnAccountSources(params)`:
- Wraps `useApiData(() => fetchOwnAccountSources(params), [JSON.stringify(params)])`.
- Returns `{ rows: OwnAccountRow[] | undefined, totals: OwnAccountTotals | undefined, loading, error, refetch }`.
- During loading, the caller renders skeleton rows — falling back to a static mock is **not** the chosen UX for this page (no precedent table exists yet; this is a fresh feature).

`useBalanceRefresh()`:
- Used by the composer (not this page directly). Listed here because the file lives in this folder.
- Returns `{ submit: (req) => Promise<OwnAccountRow>, pending, error }`.
- `submit` posts to `/banking/own-account-transfer/balance-refresh` and returns the refreshed row.

## 4. API client calls

```ts
// lib/api/banking.ts — add (or rename from fetchOwnAccounts)
import { api } from "@/lib/axios";
import type {
    ApiOwnAccountSourceListResponse,
    ApiBalanceRefreshRequest,
    ApiBalanceRefreshResponse,
    ApiResponse,
} from "@/lib/types/api";

export async function fetchOwnAccountSources(params: {
    bankCd?: string;
    sortField?: "BANK" | "ACCT_NICK_NM" | "BAL" | "AVI_BAL" | "ACCT_BAL_LST_STS";
    sortDirection?: "ASC" | "DESC";
}): Promise<ApiOwnAccountSourceListResponse> {
    return unwrap(api.get<ApiResponse<ApiOwnAccountSourceListResponse>>(
        "/api/v1/banking/own-account-transfer/source-accounts",
        { params: {
            bank_cd:        params.bankCd,
            sort_field:     params.sortField,
            sort_direction: params.sortDirection,
        } }));
}

export async function postBalanceRefresh(
    req: ApiBalanceRefreshRequest,
): Promise<ApiBalanceRefreshResponse> {
    return unwrap(api.post<ApiResponse<ApiBalanceRefreshResponse>>(
        "/api/v1/banking/own-account-transfer/balance-refresh", req));
}
```

The existing `fetchOwnAccounts` in `lib/api/banking.ts` should be **retired** in the same MR — see [migration §6](../../../../../wecms-api/docs/references/migration/banking/own-account-transfer.md) for the rename action item.

## 5. NXiSAS bundle integration

### 5.1 Target asset paths

Vendored verbatim from `WECMS DEV/WECMS_STATIC/web/nxisas/` to `wecms-web/public/nxisas/`:

```
public/nxisas/
├── InstallCheck.html
├── file/
│   └── NXiSAS.exe
├── js/
│   ├── jquery-3.3.1.min.js
│   ├── json2.js
│   ├── platform.js
│   ├── swfobject.js
│   ├── web_socket.js
│   ├── isasscaping.js
│   ├── nxisas_api_v2.js     ← vendored for sibling pages; this page does NOT load it
│   └── nxisas_v2.js
├── websocket.swf
├── css/
│   └── process_manager.css
└── img/                      ← whole tree copied verbatim
    ├── bg/  btn/  bul/  ico/
    ├── bg_close.gif
    ├── img_cert.gif
    ├── loading.gif
    └── bul1.gif
```

**Do NOT** put the bundle through ESLint, Prettier, the Next.js bundler, or any AST tool. Bytes preserved verbatim — see [migration §7](../../../../../wecms-api/docs/references/migration/banking/own-account-transfer.md) and risk register R-1.

### 5.2 Script load strategy + WEB_SOCKET_SWF_LOCATION setup

In `app/(dashboard)/banking/own-account-transfer/layout.tsx`:

```tsx
"use client";
import Script from "next/script";

const SWF = "/nxisas/websocket.swf";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {/* 1. Set the Flash transport location BEFORE web_socket.js runs.
                   The bundle reads window.WEB_SOCKET_SWF_LOCATION at parse time. */}
            <Script id="nxisas-swf-location" strategy="beforeInteractive">
                {`window.WEB_SOCKET_SWF_LOCATION = "${SWF}";`}
            </Script>

            {/* 2. jQuery + JSON2 polyfill — bundle dependency. */}
            <Script src="/nxisas/js/jquery-3.3.1.min.js" strategy="beforeInteractive" />
            <Script src="/nxisas/js/json2.js"            strategy="beforeInteractive" />

            {/* 3. Platform / SWF / WS / scraping — these chain. */}
            <Script src="/nxisas/js/platform.js"     strategy="afterInteractive" />
            <Script src="/nxisas/js/swfobject.js"    strategy="afterInteractive" />
            <Script src="/nxisas/js/web_socket.js"   strategy="afterInteractive" />
            <Script src="/nxisas/js/isasscaping.js"  strategy="afterInteractive" />

            {/* 4. v2 engine wrapper — Own Account Transfer's entry point.
                   (Does NOT load nxisas_api.js — that's for sibling pages.) */}
            <Script src="/nxisas/js/nxisas_v2.js"    strategy="afterInteractive" />

            {children}
        </>
    );
}
```

**Why `beforeInteractive` for jQuery/JSON2 and the SWF-location inline:**
- The bundle relies on classic synchronous `<script>` ordering. `beforeInteractive` injects them into the document `<head>` before hydration so global `window.jQuery` exists before any other script reads it.
- `afterInteractive` is fine for the rest because they each `$(function(){ ... })` themselves into a DOM-ready callback — they don't fire side-effects at parse time.

**If chaining doesn't behave as expected** (risk R-2 in the migration doc):
- Fallback: a single `<Script id="nxisas-bootloader" strategy="beforeInteractive">` whose `dangerouslySetInnerHTML` writes seven `document.write('<script src="..."><\/script>')` lines in order. Ugly but deterministic; matches the legacy JSP's classic synchronous load order. Spike both during Phase 3.

### 5.3 Engine-not-installed UX + connection-check audit

The page itself loads even when the engine is missing. Detection lives inside `_v2nxisas.openNxisas` (the bundle calls back with a result). **Once the bundle reports back, the hook also POSTs the outcome to the backend audit-only endpoint** so every engine handshake — success or failure — leaves a compliance trail. Per OQ-4 (PO 2026-05-18), audit logging covers the engine check, not just domain writes.

```ts
// components/banking/own-account-transfer/hooks/useNxisasEngine.ts
"use client";
import { useEffect, useState } from "react";
import { postEngineConnectionCheck } from "@/lib/api/banking";

declare global {
    interface Window {
        _v2nxisas?: any;
        CooconiSASNX?: { Version?: string; Vendor?: string };
    }
}

export function useNxisasEngine() {
    const [loaded, setLoaded] = useState<boolean | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 25;     // 25 * 200ms = 5 s

        const report = (result: "OK" | "FAIL" | "TIMEOUT" | "NOT_INSTALLED",
                        extras: { errorCode?: string; errorMessage?: string } = {}) => {
            if (cancelled) return;
            postEngineConnectionCheck({
                result,
                engine_vendor:  window.CooconiSASNX?.Vendor  ?? "COCON",
                engine_version: window.CooconiSASNX?.Version ?? "unknown",
                user_agent:     navigator.userAgent,
                os_platform:    navigator.platform,
                error_code:     extras.errorCode,
                error_message:  extras.errorMessage,
            }).catch(() => { /* audit failures are non-fatal for the user */ });
        };

        const tryOpen = () => {
            if (cancelled) return;
            if (!window._v2nxisas) {
                if (++attempts >= MAX_ATTEMPTS) {
                    setLoaded(false);
                    report("NOT_INSTALLED");
                    return;
                }
                setTimeout(tryOpen, 200);
                return;
            }
            window._v2nxisas.openNxisas((ok: boolean) => {
                if (cancelled) return;
                setLoaded(ok);
                report(ok ? "OK" : "FAIL");
            });
        };

        tryOpen();
        return () => { cancelled = true; };
    }, []);

    return loaded;     // undefined while detecting, true/false thereafter
}
```

`postEngineConnectionCheck` is a thin wrapper in `lib/api/banking.ts`:

```ts
export async function postEngineConnectionCheck(
    req: ApiEngineConnectionCheckRequest,
): Promise<void> {
    await api.post("/api/v1/banking/own-account-transfer/engine-connection-check", req);
    // backend returns 204; nothing to unwrap.
}
```

**The endpoint is fire-and-forget from the UI's perspective.** A failed audit POST must not block the user — wrap in a `.catch(...)` that swallows the error (a `console.warn` is fine; surface nothing to the user). The audit row exists for compliance, not UX.

The **Transfer** button uses the result:

```tsx
const engineReady = useNxisasEngine();

<button
    type="button"
    className="text-button text-wb-link"
    onClick={() => engineReady
        ? setComposerTarget(row)
        : showEngineInstallDialog()
    }>
    {t("own_account_transfer.row.transfer")}
</button>
```

`showEngineInstallDialog()` uses the shared `<SystemDialog>` provider — type=`info`, title from `own_account_transfer.engine.install_required`, primary action **Install Engine** → `window.open("/nxisas/file/NXiSAS.exe", "_self")`, secondary action **Run Install Check** → `window.open("/nxisas/InstallCheck.html", "_blank")`. Both static assets are served from `public/nxisas/`.

### 5.4 React + jQuery DOM contention

The engine renders OTP / captcha / password / Q&A modals by manipulating the DOM via jQuery. These modals must NOT live inside the React tree — React's reconciler will tear them down on the next render.

**Pattern:** render an empty mount node outside the React tree at app root:

```tsx
// app/(dashboard)/banking/own-account-transfer/layout.tsx — after the Scripts
<div id="nxisas-mount" aria-hidden="true" />
```

The engine's modal templates target a fixed selector (`.layerPopupOpen`, `.layerCont.captcha`, etc.); add a thin CSS shim in `app/globals.css` (or a feature-scoped file) to position them above the React app and ensure z-index hierarchy works. **Do not** wrap the mount node in a React state-driven conditional — it must be a stable, always-present DOM node.

## 6. Tailwind tokens used (no raw px, no inline fontFamily)

Per [root CLAUDE.md §Global Typography](../../../../../CLAUDE.md#global-typography-cross-tree):

| Surface | Token | Resolves to |
|---|---|---|
| Page title `<h1>` | `text-page-title` | `text-xl font-medium` (18 / 500) |
| Section heading (if any) | `text-section-title` | `text-md font-semibold` (14 / 600) |
| Table header `<th>` | `text-table-header` | `text-base font-semibold text-[#494949]` (13 / 600) |
| Table cell `<td>` | `text-table-cell` | `text-base font-normal` (13 / 400) |
| Footer totals `<th>` | `text-table-header` | same |
| Bank popover label | `text-input` | `text-base font-normal` |
| **Transfer** button | `text-button` | `text-base font-medium` (13 / 500) |
| Pagination page-size dropdown | `text-input` | same |
| Empty-state text | `text-body` | `text-base font-normal text-[#494949]` |
| Last-refresh helper line (gray subscript) | `text-helper` | `text-xs font-light` (11 / 300) |
| Status pill | `text-helper font-semibold` | — |

Colors:
- Success status pill text — `text-wb-status-success` (or the existing `cGreen` shim used by Account Inquiry).
- Failed status pill text — `text-wb-status-error`.
- Default page text — `text-[#494949]` (global body color; do not introduce new color tokens for this).

Spacing:
- Table padding — reuse Account Inquiry's `<AccountInquiryPage>` cell padding tokens; this page's table is structurally identical (same row height, same icon column).

## 7. Desktop-first layout

Per memory `feedback_desktop_first_ui.md` — this app is **Desktop-first** (Figma frames are Laptop-sized). The table renders at full container width with no mobile breakpoint collapse. Mobile-responsive overrides are explicitly out of scope.

- Container: `max-w-[1440px] mx-auto` (matches existing banking pages).
- Sidebar drawer below `lg` is the only responsive behaviour (inherited from `<AppShell>`).

## 8. View Setting registration (screenId = `own-account-transfer`)

Add to [wecms-web/lib/viewSettingScreens.ts](../../../../lib/viewSettingScreens.ts):

```ts
export const SCREEN_IDS = {
    // … existing entries …

    /** Banking > Own Account Transfer — source-account picker for the
     *  Coocon NXiSAS-driven own-account transfer. The list is read-only
     *  (no writes from this popover); the Transfer button on each row
     *  opens the composer popup. Seeded by V<N>__own_account_transfer_view_setting_seed.sql
     *  (see database/banking/own-account-transfer-db.md §6). */
    OWN_ACCOUNT_TRANSFER: "own-account-transfer",
} as const;
```

The **module-load guard** at the bottom of that file rejects duplicates. The slug `own-account-transfer` is unused today (verified against the existing registry — current entries cover `banking-account-inquiry-*`, `banking-transaction-history`, payment / addon / settings; nothing collides).

**Columns to seed** (matching the visible-by-default columns the legacy page renders via `_v001.ts:482-547`):

| FIELD_ID | DEFAULT DISP_YN | DEFAULT WIDTH | i18n label key |
|---|---|---|---|
| `CHECKBOX` | `'Y'` (optional — only if multi-row select is added; legacy has no checkbox column on this page, so default `'N'`) | 40 | — |
| `BANK_CD` | `'Y'` | 220 | `own_account_transfer.column.bank` |
| `ACCT_NICK_NM` | `'Y'` | 240 | `own_account_transfer.column.acct_nick_nm` |
| `BAL` | `'Y'` | 160 | `own_account_transfer.column.bal` |
| `AVI_BAL` | `'Y'` | 160 | `own_account_transfer.column.avi_bal` |
| `ACCT_BAL_LST_STS` | `'Y'` | 180 | `own_account_transfer.column.acct_bal_lst_sts` |
| `ETC` | `'Y'` | 140 | `own_account_transfer.column.etc` |

Per [docs/jex/features/view-setting.md §1.1](../../../../../docs/jex/features/view-setting.md), the `WEB_SVC_ID` matches the slug exactly. The popover renders from the global registry; no per-page popover code lives here.

## 9. Behaviour parity checklist (vs JEX)

| Behaviour | Legacy source | Refactor parity |
|---|---|---|
| Default sort | `_r001_act.jsp` (legacy) defers to `SortHelper`; in practice the rows arrive in `(BANK_CD, ACCT_NO)` order via `ACCT_MSTR_R015` SELECT order | Refactor's default `sortField=BANK, sortDirection=ASC` → ORDER BY `BANK_CD, ACCT_NO ASC`. |
| Bank popover default label "All Banks" | `_v001.ts:660-662` | Same — `t("own_account_transfer.filter.all_banks")`. |
| Bank popover items | `_v001.ts:641-685` — 5 banks default; H restricted to VietinBank only | Same — `allowedBanks` array computed from `user.productType`. Bank-name lookup from `comm_0140_001_r001` is **replaced** by a Spring `BankCdResolver` lookup that already exists in `wecms-api`; the popover label is rendered via the resolver's short-name. |
| Empty state | "No Data Found" centered, gray text, colspan=6 (`_v001.ts:430-437`) | Same visual treatment — use the existing Account Inquiry empty-state component. |
| Status pill (`ACCT_BAL_LST_STS`) | Green "Success" when `ACCT_BAL_INQ_STTS==='00000000'`, red "Failed" otherwise; subscript = humanized `ACCT_BAL_LST_INQ_DTM` (`_v001.ts:516-528`) | Same — `<StatusBadge>` reused from `<ApprovalTable>`. |
| Account display | `bank-icon` + bank short name + account-type label + `bank_format(ACCT_NO)` separator (`_v001.ts:486-495`) | Same — use the existing Account Inquiry bank/account formatter (already extracted as `<BankAccountCell>` if it exists; otherwise extract). |
| Transfer button visibility | ADMIN sees always; USER sees only when `(use_yn_v='Y' && auth_type_v='V' && use_yn_w='Y' && auth_type_w='W')` OR `(use_yn_w='Y' && auth_type_w='W')` (`_v001.ts:530-537`) | Same — `row.canTransfer` flag computed in mapper. |
| Footer totals | `Total {CNT} Accounts | Σ BAL | Σ AVI_BAL`, columns aligned to colgroup (`_v001.ts:440-457`) | Same — `<OwnAccountSourceTableFooter>` reads `totals` + the shared colgroup. |
| Pagination | Client-side; page sizes 15 / 20 / 50 / 100 (`_view.jsp:170-178`) | Same — client-side slice over the returned `list`. |
| View Setting icon | Top-right `<div class="view-sort" for="table1">` (`_view.jsp:120-127`) | Same — `<PageActionButtons items={["view-setting"]} />`. |

## 10. Out-of-scope on this page (handled elsewhere)

- **The transfer composer popup** — sibling feature MR. The Transfer button only sets `composerTarget`; rendering `<OwnAccountTransferComposer>` is conditional on the composer file existing.
- **Excel / print export** — the legacy page declares hidden `excelDownloadInput` / `ExcelDownload` form elements but the active TS never wires them; the toolbar has no export button. **Don't add one in the refactor** — parity with legacy means no export icon on this page. (Account Inquiry has export; this page does not.)
- **The bottom "Excel" stub form fields** in the legacy JSP — drop them entirely; they're dead code in the legacy.
