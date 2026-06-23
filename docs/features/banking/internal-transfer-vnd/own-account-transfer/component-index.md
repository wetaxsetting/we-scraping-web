# Own Account Transfer — Component Index (Frontend)

Every file for the shipped feature. Backend source map: [source-code-index.md](../../../../../../wecms-api/docs/features/banking/internal-transfer-vnd/own-account-transfer/source-code-index.md).

---

## 1. Route & page

| File | Role |
|---|---|
| [`app/(dashboard)/banking/own-account-transfer/page.tsx`](../../../../../app/(dashboard)/banking/own-account-transfer/page.tsx) | Route + metadata (server component). |
| [`components/banking/own-account-transfer/OwnAccountTransferClient.tsx`](../../../../../components/banking/own-account-transfer/OwnAccountTransferClient.tsx) | Thin client wrapper (provider seam). |
| [`components/banking/own-account-transfer/OwnAccountTransferPage.tsx`](../../../../../components/banking/own-account-transfer/OwnAccountTransferPage.tsx) | Main page container — state, filters, table, pagination, dialogs. |

## 2. Components (`components/banking/own-account-transfer/`)

| File | Purpose |
|---|---|
| `SourceAccountsTable.tsx` | Bare `<table>` driven by visible View-Setting columns. |
| `SourceAccountsTableFooter.tsx` | Sibling footer — total accounts / Σ balance / Σ available. |
| `source-accounts-columns.tsx` | `SOURCE_ACCOUNTS_COLUMN_REGISTRY` (BANK_CD, ACCT_NICK_NM, BAL, AVI_BAL, ACCT_BAL_LST_STS, ETC) + cell renderers incl. `<LastRefreshCell>`, `<TransferActionCell>`. |
| `OwnAccountTransferComposerDialog.tsx` | Transfer composer — source chip, target dropdown, amount, password, remarks + engine scrape orchestration. |
| `TransferConfirmationDialog.tsx` | Bank-driven transfer confirmation (engine-rendered). |
| `OtpAuthDialog.tsx` | OTP / 2nd-factor entry modal. |
| `EngineStatusBanner.tsx` | Engine readiness banner. |
| `EngineNotInstalledDialog.tsx` | Download NXiSAS.exe + Check Installation modal. |
| `EngineUnsupportedOsDialog.tsx` | Non-Windows acknowledge-only modal. |
| `preview/NxisasSecondaryAuthPreview.tsx` | DEV-only `?preview=nxisas` mock-challenge gate. |
| `mappers.ts` | Wire→memory: `toOwnAccountSourceRow`, `toOwnAccountSourceTotals`, `isEngineStatusSuccess`, `toOwnAccountTargetRow`, `toOwnAccountTargets`. |
| `types.ts` | In-memory types (§4). |
| `bank-profiles.ts` | Per-bank engine job parameters / fee policy / remark byte-limits (ported from legacy `trns_0001_007.ts`). |

## 3. Hooks (`components/banking/own-account-transfer/hooks/`)

| Hook | Provides |
|---|---|
| `use-own-account-transfer.ts` | `sources`, `totals`, `allowedBankCds`, `loading`, `error`, `reload`, `loadTargets`, `validateDraft`, `validateNapas`, `submitScrapingResult`. |
| `use-nxisas-engine.ts` | `status`, `vendor`, `version`, `retry`, `runScraping`; bundle load + probe + handshake audit. |

## 4. Types (`types.ts`)

`OwnAccountSourceRow`, `OwnAccountSourceTotals`, `OwnAccountTargetRow`, `OwnAccountTransferType`
(`"SAME_BANK" | "NAPAS"`), `OwnAccountTransferDraft`, `OwnAccountTransferComposerValidation`. Wire types live in
[`lib/types/api.ts`](../../../../../lib/types/api.ts) (`ApiOwnAccount*`, `ApiBalanceRefresh*`, `ApiNapasBankInfoRow`, `ApiEngineConnectionCheckRequest`).

## 5. API client & NXiSAS adapters

| File | Role |
|---|---|
| [`lib/api/banking.ts`](../../../../../lib/api/banking.ts) | OAT fetchers (source/target accounts, NAPAS info, scraping-result, balance-refresh, engine-connection-check). See [api-consumption.md](api-consumption.md). |
| [`lib/nxisas/jexjs-adapter.ts`](../../../../../lib/nxisas/jexjs-adapter.ts) | Legacy `window.jexjs` / `_isOsmc` / `tmsComm` bridge + bank-profile map. |
| `lib/nxisas/{confirm,otp,qna,system-message}-bridge.ts` | Detect engine popups → dispatch CustomEvents into the shared dialogs. |
| [`public/nxisas/`](../../../../../public/nxisas/) | Verbatim Coocon vendor bundle (never hand-edited). |

## 6. Menu / navigation

| File | Role |
|---|---|
| [`components/layout/Sidebar.tsx`](../../../../../components/layout/Sidebar.tsx) | Banking sidebar entry → `/banking/own-account-transfer`. |
| [`lib/menuAuth.ts`](../../../../../lib/menuAuth.ts) | Menu permission code for visibility. |
| [`lib/viewSettingScreens.ts`](../../../../../lib/viewSettingScreens.ts) | `own-account-transfer` screenId registry entry. |

## 7. i18n

Namespace `own_account_transfer.*` in [`locales/en.json`](../../../../../locales/en.json) (+ `ko.json`, `vi.json`): `title`, `col.*`, `status.{success,failed}`, `empty.no_data`, `footer.*`, `filter.all_banks`, `engine.*`, `composer.*`, `error.*`, `success.*`.
