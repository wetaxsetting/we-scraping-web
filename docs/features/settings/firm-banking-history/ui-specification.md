# Firm Banking History — UI Specification (Frontend)

Parent: [README.md](README.md). Backend functional spec: [wecms-api .../functional-specification.md](../../../../../wecms-api/docs/features/settings/firm-banking-history/functional-specification.md).

---

## 1. Filters ([`FirmBankingHistoryFilters.tsx`](../../../../components/settings/firm-banking-history/FirmBankingHistoryFilters.tsx))

| Control | Component | Notes |
|---|---|---|
| Date range | `<InteractiveDateRangePicker>` (shared) | start/end ISO chips + dual-month range popover with presets; default last 30 days |
| Service type | `ServiceTypeDropdown` | options `all` / `firm_banking_transaction` / `scraping_transfer` / `vietnam_gdt_inquiry` / `vietnam_business_inquiry`; **G + B hidden when product type = `H`** (`isProductType(userStorage.get(), "H")`, mirrors legacy `prdtTypes === "H"`); labels via `t("settings.firm_banking_history.service_type.<value>")` |
| Keyword | `<SearchInput>` | placeholder `settings.firm_banking_history.search_placeholder`; **300 ms debounce in the panel**; targets backend `keyword` (seq-no) |

There is no account / bank / currency / status filter — neither does the legacy screen.

---

## 2. Grid ([`FirmBankingHistoryTable.tsx`](../../../../components/settings/firm-banking-history/FirmBankingHistoryTable.tsx))

Columns in order (sortable ones map to the backend whitelist FIELD_IDs):

| # | Column (i18n key) | FIELD_ID | Sortable | Render |
|---|---|---|---|---|
| 1 | `col.date_time` | `TARN_DTM` | ✅ | date chip (`formatDateChip`) + muted time; rendered in Asia/Ho_Chi_Minh TZ |
| 2 | `col.service_type` | `SVC_TYPE` | ✅ | `t("settings.firm_banking_history.service_type.<serviceType>")` |
| 3 | `col.service_name` | `SVC_NM` | ✅ | `t(row.serviceNameKey)` → fallback raw `row.serviceName`; wrapped in `<EllipsisTooltip>` |
| 4 | `col.seq_no` | `SEQ_NO` | ✅ | seq value; `<EllipsisTooltip>` for overflow |
| 5 | `col.inst_code` | `DEP_BANK_CD` | ✅ | "`<bank> - <code>`"; `<EllipsisTooltip>` |
| 6 | `col.results` | `RSLT_CD` | ✅ | status pill (`ResultText`) — colour by 3-state result |
| 7 | (empty header) | — | — | "View Details" link → popover |

- **Sort glyphs** via shared `<TableHeaderCell>`; FIELD_IDs match the backend `FirmBankingHistorySortField` whitelist.
- **Header + body text** `text-wb-13` per the global table-typography rule.

---

## 3. Status / result mapping

The grid status pill derives a 3-state result from the raw `rslt_cd` ([`mappers.ts`](../../../../lib/api/mappers.ts)):

| UI result | Source `rslt_cd` | Colour token | i18n label |
|---|---|---|---|
| `success` | `00000000` or `0000` | `text-wb-status-approved-text` (green) | `settings.firm_banking_history.result.success` |
| `failed` | everything else (incl. null/blank — GAP-2 fix 2026-06-05) | `text-wb-status-rejected-text` (red) | `settings.firm_banking_history.result.failed` |
| `in_progress` | not produced from the wire today (retained for styling) | `text-wb-status-progress-text` (amber) | `settings.firm_banking_history.result.in_progress` |

Service-type and service-name labels are rendered from **server-supplied i18n keys** (`svc_type_key`,
`svc_name_key`) — the frontend holds zero hardcoded code→label maps (the legacy `SERVICE_NAME_MAP` /
`coerceFirmBankingServiceType` switch is retired).

---

## 4. Detail popover ([`FirmBankingHistoryDetailPopover.tsx`](../../../../components/settings/firm-banking-history/FirmBankingHistoryDetailPopover.tsx))

- **Opens** from the row's View Details button → `setDetail({ row, anchorRect })`; **no extra HTTP call**.
- **Layout:** fixed 388 px, portal-mounted, anchored right-edge-to-right-edge, flips above/below by viewport room; `z-[60]` above the Settings L1 overlay; `rounded-[16px]` + 3-stop shadow (documented Figma exception 6270:25829). Closes on ESC / outside-click / X.

Per-leg fields rendered:

| Leg | Service type | Distinct fields |
|---|---|---|
| F | `firm_banking_transaction` | Withdrawal Inst. Code, **VAN Code**, Seq. No., Response Code, Response Message |
| S | `scraping_transfer` | Withdrawal Inst. Code, Seq. No., Response Code, Response Message |
| G | `vietnam_gdt_inquiry` | **e-Invoice No.** (parsed from `req_data` JSON), Response Code, Response Message |
| B | `vietnam_business_inquiry` | **Tax ID** (parsed from `req_data.search`), Response Code, Response Message |

**Service-name resolution** (never blank): `t(row.serviceNameKey)` → raw `row.serviceName` → `row.job`.

**Result-message resolution:**
- **F leg:** `resolveVanMessage(rsltCd, rsltMsg, locale, failedLabel)` — `DICTIONARY_VAN` (4-char codes, 69 entries) → `rsltMsg` → "Failed" → "".
- **S / G / B legs:** `resolveScrapingResultMessage(rsltCd, rsltMsg, t, failedLabel)` — 18-code scraping registry → `rsltMsg` → raw `rsltCd` → "Failed" → "".

Every value cell uses `<EllipsisTooltip>` for overflow; a copy-to-clipboard affordance copies the full original value.

---

## 5. Loading / empty / error states

| State | UI behaviour |
|---|---|
| Initial / search loading | spinner; latched stable data keeps the grid + pagination stable between refetches |
| Empty result | localized empty-state row (`settings.firm_banking_history.empty_state`) |
| `WBE_VALIDATION` | suppressed from the global dialog — the panel controls its own inputs |
| other error | `useDialog().open({ type: "error", errorCode, … })` with `trace_id`; de-duped via `lastSurfacedRef` |

---

## 6. i18n keys

Namespaces (all present in `en.json`; KO/VI coverage noted):

- `settings.firm_banking_history.*` — panel chrome, `col.*`, `service_type.*`, `result.*`, `detail.*`, `search_placeholder`, `empty_state`, `export_title`. (KO/VI present for `service_type.*`.)
- `fb_history.service.*` — service-name keys (201/202/203 + S/G/B literals). EN today; KO/VI fall back to EN (or raw `svc_nm`).
- `fb_history.result.*` — 18 scraping result-code messages. EN verified; KO/VI unresolved (Jex Studio ML; fall back to EN).

Per the workspace rule: **do not invent translations.** Missing KO/VI keys fall back to EN via `LocaleProvider`; the wire's raw value is the second-line fallback. No `km.json`.

---

## 7. Typography / tokens / consistency

- All sizing via WB365 tokens (`text-wb-13` / `text-wb-14` / `text-wb-18`); no raw `text-[*px]` / `font-[*]` / inline `fontFamily`.
- Follows the Settings panel composition contract (header → filters → scroll region → pinned-bottom pagination).
- Panel header keeps `pr-24` clearance (no right-side action button) per §3a.
- The `rounded-[16px]` popover + inline 3-stop shadow is a documented Figma exception (CLAUDE.md §3b/F) pending `bg-wb-popup` / `shadow-wb-popup` tokens.
