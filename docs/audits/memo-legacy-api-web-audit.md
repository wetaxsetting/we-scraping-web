# Memo — Legacy (JEX) vs Refactor Audit

**System:** Refactor (wecms-api + wecms-web), audited against legacy JEX source of truth
**Date:** 2026-07-02
**Author:** Claude Code (AI) audit
**Status:** AUDIT ONLY — no implementation performed. No code changed except this file.
**Scope screens (modern / target):**
1. Payment → Corporate Card → **Card Transactions**
2. Current & Savings → **Transaction History VND**
3. Current & Savings → **Transaction History FCY**

> **Safety confirmation.** This task created exactly one file — this markdown. No backend, no
> frontend wiring, no schema, no deletion of `MemoPanel.tsx` or the static `MemoDrawer`, and no
> change to Transaction History code was made. See §12 (Verification).

---

## 1. Executive Summary

**Memo is a real, mature, shared legacy feature — not a new one.** In JEX it is a single generic
component (`getMemoPopup2` in `add_osmc.js`) backed by one polymorphic table (`MEMO_INFM`) and one
shared common web-service (`comm_0105_001`). Any list screen attaches memos to its rows by passing
its own `WEB_SVC_ID` + up to nine reference keys (`REF_NO … REF_NO9`). All three target screens
already use it in legacy:

| Target screen | Legacy screen id (`WEB_SVC_ID`) | Row key(s) passed as REF_NO… | Legacy memos in DEV DB |
|---|---|---|---|
| Card Transactions | `card_0001_001` | `REF_NO = CARD_SEQ_NO` (single) | 5 rows |
| Transaction History VND | `fnsh_0002_001` | `REF_NO=BANK_CD, REF_NO2=ACCT_NO, REF_NO3=TRSC_DT, REF_NO4=ACCT_SEQ_NO` | 3,342 rows |
| Transaction History FCY | `fnsh_0006_001` | same 4-key shape as VND | 3,341 rows |

> **Screen-mapping reconciliation (important).** There are **two** legacy account-transaction views,
> and only one is the canonical "Transaction History":
> - **`fnsh_0002_001` (VND) / `fnsh_0006_001` (FCY)** — the canonical Transaction History screens.
>   These **have** the memo feature (thousands of memo rows keyed by `BANK_CD/ACCT_NO/TRSC_DT/ACCT_SEQ_NO`).
>   The refactor's own feature doc maps the modern page to these:
>   `wecms-web/docs/features/banking/current-savings-vnd/transaction-history/README.md:7` — "JEX
>   counterpart: `fnsh_0002_001` (FCY twin `fnsh_0006_001`)".
> - **`nxisas_tranList` / `nxisas_tranHistory`** — the NXISAS bank-gateway raw list; shows only the
>   bank's read-only `RMRK`/`RMRK2` narration and has **no** user memo. This is **not** the screen the
>   refactor Transaction History maps to.
>
> This audit targets the **`fnsh_*`** screens (memo-enabled), matching the refactor page mapping. If
> the PO instead considers the NXISAS list the canonical page, memo would be a genuinely new feature
> there — flagged as OQ-7 (§13).

**Refactor status:** The backend memo API **already exists** but only for Card Transactions, and
it is **partial**:
- `wecms-api` has a working `GET/POST/DELETE …/card-transactions/memos` (entity `MemoInfm`,
  repository, service, DTOs, Flyway `V65`).
- **No edit (update-text) endpoint**, **no color-only update**, **no attachments** — all of which exist in legacy.
- `wecms-web` has an **API-wired `MemoPanel.tsx`** (create + delete only) that is currently
  **orphaned** (Card Transactions was switched to a **static, UI-only** `MemoDrawer`), plus the new
  static shared `MemoDrawer` (state-only, no persistence).
- Transaction History VND/FCY have **no memo UI or wiring at all**.

**Two migration-critical divergences that need a PO/DBA decision before wiring (see §9 / §11):**
- **D1 — `WEB_SVC_ID` value drift.** Legacy memos are stored under legacy screen ids
  (`card_0001_001`, `fnsh_0002_001`, `fnsh_0006_001`). The refactor writes/reads under the **slug**
  `"card-transactions"`. Because the refactor runs against the **live JEX DB** in all envs
  (memory `project_uat_prod_live_jex_db_target`), the refactor's memo list scoped by
  `web_svc_id="card-transactions"` **cannot see the 5 legacy card memos**, and any new memo it
  writes is invisible to legacy JEX. This is a real coexistence break, not cosmetic.
- **D2 — color is per-row in legacy, per-memo in the refactor.** Legacy `create` and the
  color-update service propagate a single `COLOR` to **all memos sharing a `REF_NO`** (the sticker
  color is a property of the transaction row). The refactor stores `color` per memo row.

**Recommendation (headline):** Do **not** invent a new memo table or a new endpoint family. Extend
the already-correct polymorphic `MEMO_INFM` design: (a) resolve D1 with the PO/DBA, (b) add the
missing edit / color-update endpoints for legacy parity, (c) wire the static shared `MemoDrawer` to
the API (Card Transactions first), (d) then add a multi-ref (`REF_NO2..4`) scope for Transaction
History VND/FCY. Keep `MemoPanel.tsx` and the static `MemoDrawer` in place until the shared wired
drawer is proven. Defer attachments (`MEMO_INFM_FILE`) unless the PO wants parity now.

---

## 2. Legacy Files Found

All searches were run against the JEX trees only (`WECMS DEV/…`), which are read-only reference.

### 2.1 Database
- Table `MEMO_INFM` (schema `wecmsvndev`) — the generic memo store.
- Table `MEMO_INFM_FILE` — memo attachments (referenced by the drawer as `REC1`).
- `CARD_TRNS_HSTR` — card transactions (has its own inline free-text `note`/`cont`, **not** the memo feature).
- `ACCT_TRNS_HSTR` — account transaction history (has inline `rmrk`/`rmrk2`, **not** the memo feature).

### 2.2 IDO XML (`WECMS DEV/WECMS_ETC/xml/service/IDO/`) — read-only, Jex-Studio-generated
| File | Op | Purpose |
|---|---|---|
| `IDO.MEMO_INFM_C001.xml` | INSERT | Insert one memo row (all 18 columns; `SEQ_NO` supplied by caller) |
| `IDO.MEMO_INFM_R001.xml` | SELECT | Plain read, all columns, dynamic `WHERE` |
| `IDO.MEMO_INFM_R002.xml` | SELECT | **List used by the drawer** — adds `wb_get_user_nm(REG_ID) AS REG_NM`, `wb_get_user_nm(MOD_ID) AS MOD_NM` |
| `IDO.MEMO_INFM_U001.xml` | UPDATE | Full update by PK `(BIZ_KEY, WEB_SVC_ID, SEQ_NO)` (coalesce partial) |
| `IDO.MEMO_INFO_U002.xml` | UPDATE | **Color-only** update by `(BIZ_KEY, WEB_SVC_ID, REF_NO)` + dynamic ref filter |
| `IDO.MEMO_INFM_D001.xml` | DELETE | Delete by PK `(BIZ_KEY, WEB_SVC_ID, SEQ_NO)` |

### 2.3 Common web-service action JSPs (`WECMS DEV/WECMS/web/WEB-INF/action/jex/wabooks/comm/`)
The shared memo service is **`comm_0105_001`**:
| Action JSP | Op | Notes |
|---|---|---|
| `comm_0105_001_r002_act.jsp` | list | Validates `WEB_SVC_ID`+`REF_NO`; for `fnsh_*` also filters `REF_NO2/3/4`; `ORDER BY mod_dtm desc` (`:49-68`) |
| `comm_0105_001_c002_act.jsp` | create | Insert memo, then `updateColor` across the whole ref (`:128-138`) |
| `comm_0105_001_u002_act.jsp` | update text | **Author-only** — `WBE0001` "USER_ID" if `loginUser != regUser` (`:80-84`) |
| `comm_0105_001_u003_act.jsp` | update color | Color-only, bulk by `REF_NO` (+ dynamic refs); **no author check** (`:115-116`) |
| `comm_0105_001_d002_act.jsp` | delete | **Author-only** — `WBE0001` "USER_ID" (`:70-76`) |

### 2.4 Java (`WECMS DEV/WECMS/src/wabooks/`)
- `entity/MemoInfm.java`, `entity/MemoInfmPk.java`, `entity/MemoInfmFile.java`
- `dao/MemoInfmDAO.java` — `create` generates `SEQ_NO` via `SeqHelper.getNextVal(util, idoCon, entityName, "seq_no", bizKey, webSvcId)` (`:58-88`); `updateColor(...)` calls IDO `MEMO_INFO_U002` (`:120-129`).
- `helper/FnshHelper.java` — references `MEMO_INFM` for account-history joins.

### 2.5 Front-end
- **Shared implementation:** `WECMS DEV/WECMS_STATIC/web/assets_v2/add_osmc.js`
  - `_v2common.app.getMemoPopup` — older variant, colors `white/yellow/red/…` (`:1345`)
  - `_v2common.app.getMemoPopup2` — **current variant**, colors `fileG/fileB/fileY/fileW/fileR/fileP`, with attachments (`:1748`)
  - `_v2common.app.getMemoToView` (tooltip render, `:5040`), `getMemoToExcel`
- **Callers (target screens):**
  - Card: `ts-src/js/jex/wabooks/card/card_0001_001.ts` — `getMemoPopup2(..., { WEB_SVC_ID: "card_0001_001", REF_NO: val.CARD_SEQ_NO })` (`:1262-1270`); sticker `.sideMemoWrapOpen_${CARD_SEQ_NO}`, `data-color = val.COLOR ?? 'fileW'` (`:1246-1247`)
  - VND: `ts-src/js/jex/wabooks/fnsh/fnsh_0002_001_osmc.ts` — `getMemoPopup({ WEB_SVC_ID:"fnsh_0002_001", REF_NO:BANK_CD, REF_NO2:ACCT_NO, REF_NO3:TRSC_DT, REF_NO4:ACCT_SEQ_NO }, fnsh_0002_001.loadData)` (`:496-500`)
  - FCY: `ts-src/js/jex/wabooks/fnsh/fnsh_0006_001_osmc.ts` (same shape as VND)
- ~20 other screens reuse the same popup (trco, trgm, prch, sale, szon, einv, resl) — confirming it is a global common component.

---

## 3. Legacy DB Tables & Columns

### 3.1 `MEMO_INFM` (the memo store) — PK `(BIZ_KEY, WEB_SVC_ID, SEQ_NO)`, UK `(BIZ_KEY, WEB_SVC_ID, SEQ_NO, REF_NO)`

| # | Column | Type | Null | Meaning |
|---|---|---|---|---|
| 1 | `BIZ_KEY` | varchar(20) | NO | Tenant / company key (PK) |
| 2 | `WEB_SVC_ID` | varchar(50) | NO | **Owning screen id** (PK) — scopes memos per screen |
| 3 | `SEQ_NO` | numeric | NO | Running memo sequence per `(BIZ_KEY, WEB_SVC_ID)` (PK) |
| 4 | `MEMO` | varchar(200) | YES | Memo text |
| 5 | `COLOR` | varchar(6) | YES | Sticker color token (see §3.4) |
| 6 | `REF_NO` | varchar(50) | NO | Parent row key #1 (e.g. `CARD_SEQ_NO`, or `BANK_CD` for account history) |
| 7-14 | `REF_NO2` … `REF_NO9` | varchar(50) | YES | Parent row keys #2–#9 (composite logical key) |
| 15 | `REG_ID` | varchar(100) | NO | Author (login id) |
| 16 | `REG_DTM` | varchar(14) | NO | Created `yyyyMMddHHmmss` (UTC) |
| 17 | `MOD_ID` | varchar(100) | NO | Last modifier |
| 18 | `MOD_DTM` | varchar(14) | NO | Modified `yyyyMMddHHmmss` (UTC) |

**Key generation:** `SEQ_NO` is a per-`(BIZ_KEY, WEB_SVC_ID)` counter allocated in Java
(`SeqHelper.getNextVal`), **not** the transaction row's key.
**Logical link to a transaction:** the `REF_NO…` columns. There are **no FKs** — the link is logical
only (the memo table has no foreign key into `CARD_TRNS_HSTR` or `ACCT_TRNS_HSTR`).

### 3.2 `MEMO_INFM_FILE` (memo attachments)
Legacy memos can carry file attachments. The drawer reads them as `val.REC1` (thumbnails / download
list) and supports upload. PK is `(BIZ_KEY, WEB_SVC_ID, SEQ_NO, FILE_ID)`. **Not wired in refactor.**

### 3.3 Relation to the three transaction tables (memo is stored SEPARATELY, not inline)
- **Card Transactions** — `CARD_TRNS_HSTR`, PK `(BIZ_KEY, CARD_SEQ_NO)`. Memo links via
  `MEMO_INFM.REF_NO = CARD_SEQ_NO`, `WEB_SVC_ID = 'card_0001_001'`.
  - Note: `CARD_TRNS_HSTR` also has inline `note` varchar(255) and `cont` varchar(200) — these are
    ERP/import fields, **unrelated** to the memo drawer. Do not confuse them with memos.
- **Transaction History (VND & FCY)** — `ACCT_TRNS_HSTR`, PK `(BIZ_KEY, ACCT_SEQ_NO)`. Memo links via
  `REF_NO=BANK_CD, REF_NO2=ACCT_NO, REF_NO3=TRSC_DT, REF_NO4=ACCT_SEQ_NO`, `WEB_SVC_ID` =
  `'fnsh_0002_001'` (VND) or `'fnsh_0006_001'` (FCY).
  - Note: `ACCT_TRNS_HSTR` also has inline `rmrk`/`rmrk2` varchar(500) (bank narrative) — **unrelated**
    to memos.
- **Confirmed:** memo is stored **separately** in `MEMO_INFM`, never inside the transaction tables.
  (`ACCT_SEQ_NO` alone is unique, so `REF_NO4` is sufficient to identify the row; legacy still passes
  all four refs for the lookup, so parity requires sending all four.)

### 3.4 Color token values actually stored (DEV DB sample)
Mixed generations: newer tokens `fileW`, `fileY`, `fileG` (from `getMemoPopup2`) and older tokens
`white`, `yellow`, `red` (from `getMemoPopup`). Column is `varchar(6)`, so tokens must stay ≤6 chars.
Current palette in `getMemoPopup2`: **`fileG, fileB, fileY, fileW, fileR, fileP`** (default `fileW`
when null).

---

## 4. Legacy API / Action Flow

The single shared service is **`comm_0105_001`** (frontend calls it by op-suffix). Field names are
`UPPER_SNAKE_CASE`; envelope is JEX `{ COMMON_HEAD, REC }`.

### 4.1 List / fetch — `comm_0105_001_r002`
- **Request:** `WEB_SVC_ID` (req), `REF_NO` (req); for `fnsh_0002_001`/`fnsh_0006_001` also
  `REF_NO2`, `REF_NO3`, `REF_NO4` (all required for those screens).
- **Server WHERE:** `biz_key = <session>` + `web_svc_id = ?` + `ref_no = ?` (+ ref2/3/4 for fnsh),
  **`ORDER BY mod_dtm desc`**.
- **Response `REC[]` per memo:** `BIZ_KEY, WEB_SVC_ID, SEQ_NO, MEMO, COLOR, REF_NO..REF_NO9,
  REG_ID, REG_DTM, MOD_ID, MOD_DTM, REG_NM, MOD_NM` (+ `REC1[]` = attachments).
- **Session keys:** `BIZ_KEY` from session (never trusted from client); author name via
  `wb_get_user_nm`.
- **Pagination:** none — returns all memos for the row.

### 4.2 Create — `comm_0105_001_c002`
- **Request:** `WEB_SVC_ID` (req), `REF_NO` (req), `MEMO`, `COLOR`, `REF_NO2..9` as applicable.
- **Behavior:** allocate `SEQ_NO` (`SeqHelper`), insert (`REG_ID=MOD_ID=session`, `REG_DTM=MOD_DTM=UTC now`),
  **then `updateColor` propagates the chosen `COLOR` to every memo sharing the same `REF_NO`(+refs)**.
- **Response:** empty `default` result (frontend re-lists via callback).

### 4.3 Update text — `comm_0105_001_u002`
- **Request:** `WEB_SVC_ID`, `SEQ_NO`, `REF_NO` (all req), `MEMO`.
- **Validation:** **author-only** — throws `WBE0001` (dictionary `USER_ID`) if `session.id != regUser.id`.
- Sets `MOD_ID/MOD_DTM`, updates by PK.

### 4.4 Update color — `comm_0105_001_u003`
- **Request:** `WEB_SVC_ID`, `REF_NO`, `COLOR` (all req), `REF_NO2..9` optional.
- **Behavior:** bulk color update across the whole ref (all memos on that row). **No author check.**

### 4.5 Delete — `comm_0105_001_d002`
- **Request:** `WEB_SVC_ID`, `SEQ_NO` (req).
- **Validation:** **author-only** — `WBE0001` (`USER_ID`) if not author. Hard delete by PK.

### 4.6 Error handling
- Missing required field → `WBE6021` (front-end `validateRequireInput`) / `WBE0001` on server.
- Not-author on edit/delete → `WBE0001` with `USER_ID` dictionary term.
- `> 1` row on a by-PK read → `WSE0409`.

---

## 5. Legacy Front-end Flow (the shared drawer)

Source: `add_osmc.js` `getMemoPopup2` (`:1748`) + callers.

- **Icon / trigger:** each row renders a memo "sticker/icon" element whose CSS class encodes the
  row key (card: `.sideMemoWrapOpen_${CARD_SEQ_NO}`; account: `.sideMemoWrapOpen_${BANK_CD}_${ACCT_NO}_${TRSC_DT}_${ACCT_SEQ_NO}`).
  The sticker's `data-color` = `val.COLOR ?? 'fileW'`, so **the row icon shows the memo color**
  (white default) — this is the "has memo / status" indicator.
- **Open:** clicking the sticker (`btn-memo-click`) toggles a right-side layer (`.side-memo-wrap`)
  appended once to the page; it immediately calls `comm_0105_001_r002` with the row's keys.
- **Keys passed on open:**
  - Card → `{ WEB_SVC_ID:"card_0001_001", REF_NO:CARD_SEQ_NO }`
  - VND/FCY → `{ WEB_SVC_ID:"fnsh_0002_001"|"fnsh_0006_001", REF_NO:BANK_CD, REF_NO2:ACCT_NO, REF_NO3:TRSC_DT, REF_NO4:ACCT_SEQ_NO }`
- **List rendering per memo:** author name (`REG_NM`), memo text, relative time (`timeAgo(REG_DTM)`),
  and an **Edit/Delete** menu **only when `session.id === MOD_ID`** (author-only, matches backend).
- **Add:** bottom input + Send (`create_memo`) → `comm_0105_001_c002` → re-list.
- **Edit:** inline `<textarea>` (`cancel`/`save`) → `comm_0105_001_u002` → re-list.
- **Delete:** opens a **confirm layer popup** (`.memo-del`, `layerPopupOpen`) → `comm_0105_001_d002` → re-list.
- **Categories / colors:** yes — 6 color tags in the header (`fileG/B/Y/W/R/P`); selecting a color
  calls `comm_0105_001_u003` (color-only, whole row).
- **Empty state:** the list simply renders empty (`.list_data` emptied then repopulated); no rows = blank list.
- **Timestamp format:** stored `yyyyMMddHHmmss` (UTC); rendered via `timeAgo` / `formatDateTimeForView`
  (localized to the login user).
- **User-name source:** `REG_NM` from `wb_get_user_nm(REG_ID)` server-side.
- **Refresh after change:** every mutation re-runs the list; callers also pass a callback
  (e.g. `fnsh_0002_001.loadData`) so the **grid re-loads** and the sticker color/tooltip updates.
- **Attachments:** each memo can have files (`REC1`) with thumbnails/download and an upload input.

---

## 6. Current Refactor Status

### 6.1 Backend (`wecms-api`) — memo API EXISTS (Card Transactions only, partial)
Location: `domain/payment/cardtransactions`.
- **Controller** `CardTransactionsController.java` (base `/api/v1/payment/card-transactions`), memo handlers `:735-769`:
  - `GET  /memos?card_seq_no={}` → `listMemos` → `ApiResponse<MemoListResponse>`
  - `POST /memos` (`@Valid CreateMemoRequest`) → `MemoRow`
  - `DELETE /memos/{seq_no}` → `Void`
- **Service** `CardTransactionsService.java`:
  - `listMemos` `:1276-1310` — scopes `(bizKey, webSvcId="card-transactions", refNo=cardSeqNo)`, newest-first, resolves `reg_nm` from `USER_INFM`, sets `can_edit = userId.equals(regId)`.
  - `createMemo` `:1320-1346` + `insertMemoOnce` `:1348-1370` — `SEQ_NO` = `findMaxSeqNoByBizKeyAndWebSvcId + 1`, one-shot retry on PK collision; default color `"white"`.
  - `deleteMemo` `:1380-1391` — hard delete, **author-only** (`WBE_MEMO_NOT_AUTHOR`), idempotent.
  - Constant `MEMO_WEB_SVC_ID_CARD = "card-transactions"` `:207-210` (slug per identifier-naming rule).
- **Repository** `MemoInfmRepository.java` — `findByBizKeyAndWebSvcIdAndRefNoOrderByRegDtmDescSeqNoDesc`, `findMaxSeqNoByBizKeyAndWebSvcId`.
- **Entity** `MemoInfm.java` `@Table("MEMO_INFM")`, `@IdClass(MemoInfmId)` — maps all 18 columns incl. `REF_NO..REF_NO9`.
- **DTOs** — `MemoRow(seqNo, memo, color, regId, regNm, regDtm, canEdit)`, `MemoListResponse(totalCount, rows)`, `CreateMemoRequest(refNo, memo, color)` with `color @Pattern(white|blue|green|yellow|orange|red|gray|purple)`.
- **Migrations** — `V65__memo_infm.sql` (table), `V66__memo_infm_file.sql` (attachments, **schema-only, no code**).
- **Missing vs legacy:** no **edit/update-text** endpoint (legacy `u002`), no **color-only update**
  (legacy `u003`), no **attachments** code, and `listMemos` supports **only `REF_NO`** (no
  `REF_NO2..4`, so account-history multi-key not yet supported).

### 6.2 Frontend (`wecms-web`)
- **Static shared `MemoDrawer`** — `components/shared/memo/` (`MemoDrawer.tsx` + Header/CategoryTabs/List/Item/Editor/Footer/EmptyState + `types.ts`, `mockData.ts`, `index.ts`).
  - **100% UI-only.** Props of `MemoDrawer` = **`{ onClose }`** only (`MemoDrawer.tsx:30-32`). All memos live in local `useState` seeded from `MOCK_MEMOS`; add/edit/delete mutate local state and are lost on reload. It knows **nothing** about a row key.
  - `MemoColor` here = `green|blue|yellow|gray|pink|purple` (`types.ts:13`) — note `pink` and no `white`/`orange`.
  - Child components (`MemoList/Item/Editor/Footer`) are already fully prop-driven → clean seam for wiring.
- **API-wired `MemoPanel.tsx`** — `components/payment/corporate-card/MemoPanel.tsx`.
  - Props `{ cardSeqNo, onClose }` (`:30-34`). Calls `fetchMemos(cardSeqNo)`, `createMemo({ ref_no, memo, color })`, `deleteMemo(seq_no)` from `lib/api/cardTransactions.ts`.
  - Create + delete only (**no edit**). Reads `seq_no, reg_nm, reg_dtm, memo, color, can_edit`. Color palette maps to legacy PNGs `/assets/memo/file{G,B,Y,W,R,P}.png`.
  - **Currently orphaned** — `CardTransactionsPage.tsx:45-49` says Card Transactions now renders the **static** `MemoDrawer` instead; MemoPanel kept "for other consumers to migrate later."
- **API client / types** — no dedicated `memoApi`; functions live in `lib/api/cardTransactions.ts:609-631`
  (`fetchMemos`/`createMemo`/`deleteMemo`). Wire types in `lib/types/api.ts:4222-4249`
  (`MemoColor`, `ApiMemoRow`, `ApiMemoListResponse`, `ApiCreateMemoRequest`). No React Query hook —
  MemoPanel uses `useApiData` + a `refreshKey`.
- **`/memo-preview`** — `app/memo-preview/` mounts the **static** drawer (UI-only, proxy-allowlisted).
- **Row keys available on the target pages:**
  - **Card Transactions** — row key `cardSeqNo` (`CardTransactionsTable.tsx:412` `key={row.cardSeqNo}`; memo opened with it at `CardTransactionsPage.tsx:920`). Also has `apprSeqNo` (approval) but **memo attaches to `cardSeqNo`**.
  - **Transaction History VND/FCY** — shared `TransactionHistoryPage.tsx`; render key `row.id` (`TransactionTable.tsx:196`); backend surrogate `trnsSeqNo` = `ACCT_SEQ_NO` (`types.ts:13-18`). **No memo UI/wiring exists here today.** The 4-part legacy key (`BANK_CD, ACCT_NO, TRSC_DT, ACCT_SEQ_NO`) must be confirmed present on the row model before wiring (see §11 OQ-4).
- **Tailwind tokens** (`app/globals.css`): `--color-brand-03` (#b9dcfe, "Memo active color-tag ring"), `--color-wb-ntrl-10` (author/body), `--color-wb-ntrl-7` (timestamp), `--color-brand-soft` (#f0f7ff active tag bg) — all present.

---

## 7. Gap Analysis

| # | Area | Legacy behavior | Current refactor | Missing / gap | Recommended implementation |
|---|---|---|---|---|---|
| G1 | Storage model | One polymorphic `MEMO_INFM` keyed by `WEB_SVC_ID + REF_NO..9` | Same table + entity `MemoInfm` | None (design already correct) | Reuse; do **not** create new tables |
| G2 | `WEB_SVC_ID` value | `card_0001_001`, `fnsh_0002_001`, `fnsh_0006_001` (screen ids) | slug `"card-transactions"` | **D1 — refactor cannot see legacy memos / vice-versa** on the live JEX DB | **PO/DBA decision** (§9): read legacy id, or migrate `web_svc_id` values. Do not wire until resolved |
| G3 | List (fetch) | `comm_0105_001_r002`, author name, `ORDER BY mod_dtm desc`, multi-ref for fnsh | `listMemos` single `REF_NO`, order `reg_dtm desc, seq_no desc` | No `REF_NO2..4`; ordering differs (mod vs reg) | Add optional `REF_NO2..4` scope; align ordering to `mod_dtm desc` for parity |
| G4 | Create | `c002` insert **+ propagate color to whole row** | `createMemo` per-memo color, no propagation | **D2 — color propagation** | Match legacy: on create, set the row's color across siblings (or confirm per-memo is acceptable with PO) |
| G5 | Edit text | `u002` author-only | **none** | **Edit endpoint missing** | Add `PUT/PATCH /memos/{seq_no}` (author-only, `WBE_MEMO_NOT_AUTHOR`) |
| G6 | Color update | `u003` bulk-by-ref, no author check | **none** | **Color-only update missing** | Add `PATCH …/memos/color` (by `web_svc_id`+`ref_no`(+refs)) |
| G7 | Delete | `d002` author-only | `deleteMemo` author-only ✓ | Parity OK | Keep |
| G8 | Attachments | `MEMO_INFM_FILE`, upload + thumbnails (`REC1`) | `V66` schema only, no code, no UI | **Attachments missing** | Defer unless PO wants parity now (own sub-plan) |
| G9 | Colors palette | `fileG/fileB/fileY/fileW/fileR/fileP` (varchar(6)) | wire `MemoColor` = white/blue/green/yellow/orange/red/gray/purple; shared drawer = green/blue/yellow/gray/pink/purple | **3 palettes disagree** (pink vs red; no white/orange in drawer; legacy uses `fileX` tokens) | Pick one canonical mapping (recommend legacy `fileX` tokens, ≤6 chars) + a display map; reconcile shared-drawer type |
| G10 | Card Transactions UI | Wired drawer on every row | Static drawer (no persistence); wired `MemoPanel` orphaned | Static drawer not persistent | Wire the shared drawer to the API (this feature's step 1) |
| G11 | Transaction History UI | Wired drawer (4-key) on VND & FCY | **No memo UI at all** | Entire memo feature missing on VND/FCY | Add memo column/icon + shared drawer with 4-ref scope (step 2) |
| G12 | Row-key indicator | Sticker shows memo color per row | Card: static; TxnHistory: none | No per-row memo/color indicator wired | Render per-row memo icon colored by the row's memo color |

---

## 8. Recommended API Design (parity-first, reuse `MEMO_INFM`)

> Wire format lowercase snake_case (`project_api_naming_lowercase.md`). All keys server-derived where
> possible; `biz_key` always from session, never client.

**Endpoints (extend, do not replace).** Two options for scoping — see §9 before choosing the `web_svc_id` value.

Card Transactions (already exists — add the two missing ops):
```
GET    /api/v1/payment/card-transactions/memos?card_seq_no={cardSeqNo}
POST   /api/v1/payment/card-transactions/memos            { ref_no, memo, color }
PATCH  /api/v1/payment/card-transactions/memos/{seq_no}   { memo }            # NEW (legacy u002)
PATCH  /api/v1/payment/card-transactions/memos/color      { ref_no, color }   # NEW (legacy u003, whole row)
DELETE /api/v1/payment/card-transactions/memos/{seq_no}
```

Transaction History (new, multi-ref; VND/FCY share one controller, differ by `web_svc_id`/currency):
```
GET    /api/v1/banking/transaction-history/memos?bank_cd=&acct_no=&trsc_dt=&acct_seq_no=&ccy_scope=vnd|fcy
POST   /api/v1/banking/transaction-history/memos  { ref_no, ref_no2, ref_no3, ref_no4, memo, color }
PATCH  …/memos/{seq_no}   { memo }
PATCH  …/memos/color      { ref_no, ref_no2, ref_no3, ref_no4, color }
DELETE …/memos/{seq_no}
```

**DTOs** (reuse/extend existing records):
- `MemoRow` — add `mod_dtm`, `mod_nm` for full parity (list currently returns only reg fields).
- `CreateMemoRequest` — add `ref_no2..ref_no4` (nullable) for the multi-key screens.
- `UpdateMemoRequest { memo }` — new (edit text).
- `UpdateMemoColorRequest { ref_no, ref_no2..4?, color }` — new (whole-row color).

**Service / repository:**
- Reuse `MemoInfm` entity + `MemoInfmRepository`. Add finders:
  `findByBizKeyAndWebSvcIdAndRefNoAndRefNo2AndRefNo3AndRefNo4OrderByModDtmDesc(...)`.
- Keep `SEQ_NO` generation as `MAX(seq_no)+1` per `(biz_key, web_svc_id)` (matches legacy `SeqHelper`;
  `MEMO_INFM` is off the `wb_get_next_val` funnel per the existing backend note — keep that exception).
- Enforce **author-only** on edit + delete (`WBE_MEMO_NOT_AUTHOR`); color update has no author check (legacy parity).
- On **create**, decide color propagation per D2 (§9).
- Order list **`mod_dtm desc`** to match legacy.

**Validation (legacy parity):** `web_svc_id` + `ref_no` required for list/create; `seq_no` required for
edit/delete; `color` required for color update; `memo` `@Size(max=200)`; `color` ≤ 6 chars.

---

## 9. Two decisions required BEFORE wiring (must go to PO / DBA)

**D1 — `WEB_SVC_ID` value on the live JEX DB (blocking).**
The refactor writes/reads `web_svc_id="card-transactions"`; legacy data is under `card_0001_001`
(and `fnsh_0002_001`/`fnsh_0006_001`). Since the refactor runs on the **live JEX DB**, the slug means
existing memos are invisible and new memos are invisible to legacy JEX. Options:
- **(A) Read the legacy id** — store `web_svc_id = card_0001_001 / fnsh_0002_001 / fnsh_0006_001` in
  the refactor (a per-feature legacy-id constant). Best for coexistence + zero migration; slight
  tension with the slug-naming rule (this is exactly the "cross-system audit-history" style exception
  the CLAUDE.md retired for audit rows — memo scoping is a **data-join key**, not an audit tag, so it
  is a legitimately different case and worth re-raising).
- **(B) Migrate** legacy `web_svc_id` values to slugs via a one-time DBA script and cut legacy JEX
  over — heavier, breaks live-JEX coexistence during the window.
- **Recommendation:** **(A)** for migration safety (memory `project_uat_prod_live_jex_db_target`,
  north-star "preserve legacy behavior"). Escalate to Mr. Jung (PO) + DBA.

**D2 — color scope (per-row vs per-memo).**
Legacy color is a **row** property (create + `u003` propagate one color to all memos on a `REF_NO`).
The refactor stores color per memo. Options: match legacy (propagate) or keep per-memo (simpler, but a
visible behavior change and the row sticker color becomes ambiguous when memos differ). **Recommend
matching legacy** for parity; confirm with PO.

---

## 10. Recommended Frontend Integration Design

**Goal:** one shared, API-wired drawer used by all three screens — evolve the existing static
`components/shared/memo/MemoDrawer` rather than fork it.

**Props seam (extend `MemoDrawer`):**
```ts
interface MemoDrawerProps {
  onClose: () => void;
  // wiring (all optional so the static/preview usage keeps working):
  scope?: {                       // identifies the parent row
    webSvcId: string;             // resolved per feature (see D1)
    refNo: string;
    refNo2?: string; refNo3?: string; refNo4?: string;
  };
  memos?: MemoVM[];               // controlled data (from React Query)
  currentUserId?: string;         // for author-only edit/delete gating (can_edit)
  onAdd?: (text: string, color: MemoColor) => void;
  onEditText?: (seqNo: string, text: string) => void;
  onChangeColor?: (color: MemoColor) => void;   // whole-row (legacy u003)
  onDelete?: (seqNo: string) => void;
}
```
- When `scope`/handlers are absent → behaves exactly as today (static preview). No regression.
- Reconcile the two `MemoColor` types into one canonical type + a token↔display map (G9).
- Data layer: introduce a small React Query hook `useMemos(scope)` (list) +
  `useCreateMemo/useEditMemo/useDeleteMemo/useUpdateMemoColor` mutations that invalidate the list —
  cleaner than MemoPanel's `refreshKey`. Keep the `cardTransactions.ts` functions or lift them into a
  shared `lib/api/memos.ts` used by both features.
- Per-row indicator: render the memo icon colored by the row's memo color; refetch/invalidate on
  mutation so the icon updates (legacy re-loads the grid).
- Confirm dialog on delete (legacy has one) — reuse the app's confirm component.

---

## 11. Step-by-step Implementation Plan (for later — NOT executed now)

**Phase 0 — Decisions & spec**
1. Get PO/DBA answer on **D1** (`web_svc_id` value) and **D2** (color scope). Blocking.
2. Confirm **OQ-4** (the 4-part account key is present on the Transaction History row model).
3. Finalize the canonical `MemoColor` token set + display map (G9).

**Phase 1 — Card Transactions (wire the shared drawer to the existing API)**
4. Backend: add **edit** (`PATCH /memos/{seq_no}`) and **color-update** (`PATCH /memos/color`) to
   `CardTransactionsController`/`Service`; add `mod_dtm`/`mod_nm` to `MemoRow`; align list order to
   `mod_dtm desc`; apply D1/D2 outcome. Add contract tests vs legacy `comm_0105_001`.
5. Frontend: extend `MemoDrawer` props (§10); add `lib/api/memos.ts` + React Query hooks; render the
   drawer from `CardTransactionsPage` with `scope={ webSvcId, refNo: cardSeqNo }`; color the per-row icon.
6. Verify against legacy behavior end-to-end (create/edit/delete/color, author-only gating, empty state, timestamps).
7. Keep `MemoPanel.tsx` in place until the shared wired drawer is signed off, then retire it separately.

**Phase 2 — Transaction History VND & FCY (do NOT touch during this audit)**
8. Backend: new `banking/transaction-history` memo endpoints with `REF_NO2..4` scope; VND vs FCY differ
   only by `web_svc_id` (D1 outcome) / currency filter.
9. Frontend: add a memo column/icon to `TransactionTable`; open the same shared `MemoDrawer` with
   `scope={ webSvcId, refNo: BANK_CD, refNo2: ACCT_NO, refNo3: TRSC_DT, refNo4: ACCT_SEQ_NO }`.
10. Verify VND and FCY independently.

**Phase 3 — (optional) attachments**
11. Only if PO wants parity: wire `MEMO_INFM_FILE` (`V66`) — entity/repo/endpoints + drawer upload/thumbnails.

---

## 12. Verification

**Exact search / inspection commands used**

DB (MCP `postgres_dev_server_jexframe`, read-only, schema `wecmsvndev`):
```sql
-- memo-bearing columns
SELECT table_name,column_name,data_type,character_maximum_length,is_nullable
FROM information_schema.columns
WHERE table_schema='wecmsvndev'
  AND (lower(column_name) LIKE '%memo%' OR lower(column_name) LIKE '%rmrk%'
       OR lower(column_name) LIKE '%remark%' OR lower(column_name) LIKE '%note%'
       OR lower(column_name) LIKE '%comment%' OR lower(column_name) LIKE '%cmnt%');
-- MEMO_INFM structure + keys
SELECT ordinal_position,column_name,data_type,character_maximum_length,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='wecmsvndev' AND table_name='memo_infm';
SELECT conname,contype,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='wecmsvndev.memo_infm'::regclass;
-- which screens use it + sample rows
SELECT web_svc_id,count(*),count(distinct ref_no),count(color) FROM wecmsvndev.memo_infm GROUP BY web_svc_id ORDER BY 2 DESC;
SELECT * FROM wecmsvndev.memo_infm WHERE web_svc_id IN ('card_0001_001','fnsh_0002_001','trco_0004_001') ORDER BY web_svc_id,seq_no LIMIT 30;
-- transaction tables
SELECT ... FROM information_schema.columns WHERE table_name IN ('card_trns_hstr','acct_trns_hstr');
SELECT pg_get_constraintdef(oid),contype FROM pg_constraint WHERE conrelid IN ('wecmsvndev.card_trns_hstr'::regclass,'wecmsvndev.acct_trns_hstr'::regclass) AND contype='p';
```

Source greps (Grep tool over the JEX trees):
```
memo_infm|MEMO_INFM            → WECMS DEV (23 files: IDO, actions, entity, DAO)
comm_0105_001                  → WECMS DEV (action JSPs + ts-src callers)
getMemoPopup|getMemoToView     → WECMS_STATIC (add_osmc.js = shared impl; ~20 callers)
comm_0105_001|MEMO|REF_NO …    → fnsh_0002_001_osmc.ts, card_0001_001.ts (key mapping)
```
Refactor inventory was gathered by a read-only Explore sub-agent over `wecms-web/` and `wecms-api/`.

**Key file:line references**
- IDO: `WECMS_ETC/xml/service/IDO/IDO.MEMO_INFM_{C001,R001,R002,U001,D001}.xml`, `IDO.MEMO_INFO_U002.xml`
- Actions: `…/comm/comm_0105_001_{r002,c002,u002,u003,d002}_act.jsp`
- DAO: `WECMS/src/wabooks/dao/MemoInfmDAO.java:58-88, 120-129`
- FE shared: `WECMS_STATIC/web/assets_v2/add_osmc.js:1345, 1748, 5040`
- FE callers: `…/card/card_0001_001.ts:1246-1270`, `…/fnsh/fnsh_0002_001_osmc.ts:496-500`
- Refactor BE: `CardTransactionsController.java:735-769`, `CardTransactionsService.java:1276-1391, 207-210`, `MemoInfm.java`, `MemoInfmRepository.java`, `V65/V66` migrations
- Refactor FE: `components/shared/memo/MemoDrawer.tsx:30-32`, `components/payment/corporate-card/MemoPanel.tsx:30-34`, `lib/api/cardTransactions.ts:609-631`, `lib/types/api.ts:4222-4249`, `CardTransactionsTable.tsx:412`, `CardTransactionsPage.tsx:45-49,920`, `banking/transaction-history/TransactionTable.tsx:196`, `types.ts:11-108`

**No-code-change confirmation:** Only this file (`wecms-web/docs/audits/memo-legacy-api-web-audit.md`)
was created. No source file, schema, `MemoPanel.tsx`, static `MemoDrawer`, or Transaction History code
was modified. All DB access was read-only via the JEX DEV MCP.

---

## 13. Risks / Open Questions

- **OQ-1 (D1, blocking):** Which `web_svc_id` value does the refactor persist on the live JEX DB —
  legacy id (coexistence-safe) or slug (needs migration)? Owner: PO + DBA.
- **OQ-2 (D2):** Per-row color propagation (legacy) or per-memo color (current refactor)? Owner: PO.
- **OQ-3:** Do we port **edit-text** and **color-only** endpoints for full legacy parity now (recommended), or ship create+delete only? Owner: PO.
- **OQ-4:** Does the Transaction History row model expose all four keys (`BANK_CD, ACCT_NO, TRSC_DT, ACCT_SEQ_NO`)? If only `trnsSeqNo` (`ACCT_SEQ_NO`) is present, decide whether single-key `REF_NO=ACCT_SEQ_NO` is acceptable (it is unique) vs. legacy's 4-key lookup (needed to also read pre-existing legacy memos). Owner: dev + PO.
- **OQ-5:** Attachments (`MEMO_INFM_FILE`) — in scope for parity or deferred? Owner: PO.
- **OQ-6:** Canonical `MemoColor` token set — adopt legacy `fileX` tokens (≤6 chars) and reconcile the shared-drawer `pink`→`red` / add `white`,`orange`? Owner: dev + design.
- **OQ-7:** Confirm the modern Transaction History VND/FCY maps to the memo-enabled `fnsh_0002_001`/`fnsh_0006_001` (refactor page-mapping says yes) and **not** the memo-less NXISAS list. If the NXISAS list is the target, memo is a new feature there. Owner: PO.
- **Gotcha (legacy IDO spelling):** the color-update IDO id is `MEMO_INFO_U002` (INFO) while list is `MEMO_INFM_R002` (INFM) — a legacy inconsistency; don't copy the typo into refactor IDs.
- **Gotcha (duplicate FE components):** legacy has `getMemoPopup` (in `add.js`), and `getMemoPopup` + `getMemoPopup2` (in `add_osmc.js`). The refactor should consolidate to **one** shared drawer (the point of §10).
- **Risk:** `MEMO` is `varchar(200)` — the shared drawer / editor must enforce 200 chars to avoid truncation on the live DB.
- **Risk:** wiring must not regress the static `/memo-preview` (keep props optional).
- **Risk:** author-name resolution differs (legacy `wb_get_user_nm` vs refactor `USER_INFM` batch) — ensure both yield the same display name.

---

## 14. Final Recommendation

The memo backend design in the refactor is **already the right one** (polymorphic `MEMO_INFM`) — the
work is **completion + wiring**, not redesign. Proceed in this order, but **only after OQ-1 (D1) and
OQ-2 (D2) are answered by the PO/DBA**, because both affect whether the refactor can see and coexist
with live legacy memo data:

1. Resolve D1/D2, confirm OQ-4, fix the color-token mismatch.
2. Add the missing **edit** + **color-update** endpoints and full `MemoRow` fields for parity.
3. Wire the **shared** `MemoDrawer` to the API on **Card Transactions first** (retire `MemoPanel`
   only after sign-off; keep the static drawer + `/memo-preview` working via optional props).
4. Then add memo to **Transaction History VND & FCY** using the multi-ref (`REF_NO2..4`) scope.

Do not create any new memo table, do not delete `MemoPanel.tsx` or the static `MemoDrawer` yet, and do
not touch Transaction History until Phase 2.
