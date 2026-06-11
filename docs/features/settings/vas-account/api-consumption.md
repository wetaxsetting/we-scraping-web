# Settings > VAS Account — API Consumption (Frontend)

Endpoints the panel calls, request params, and wire → in-memory mapping. Authoritative contract:
[wecms-api/docs/features/settings/vas-account/interface-specification.md](../../../../../wecms-api/docs/features/settings/vas-account/interface-specification.md).

All calls go through `lib/api/vasAccount.ts` (`BASE = "/api/v1/settings/vas-account"`), unwrap the
`ApiResponse<T>` envelope, and throw `ApiCallError(code, message)` on `status.error`.

---

## 1. Endpoints consumed

| Purpose | Method + path | Client fn |
|---|---|---|
| List (full filtered set) | GET `/api/v1/settings/vas-account` | `fetchVasAccounts(params)` |
| Detail | GET `…/{seqNo}` | `fetchVasAccount(seqNo)` |
| Lookup picker | GET `…/lookup` | `fetchVasAccountLookup(searchWd?)` |
| Create | POST `…` | `createVasAccount(body)` |
| Update | PUT `…/{seqNo}` | `updateVasAccount(seqNo, body)` |
| Delete (soft) | DELETE `…/{seqNo}` | `deleteVasAccount(seqNo)` |
| Excel preview | POST `…/excel/preview` (multipart) | `previewVasAccountExcel(file)` |
| Excel import | POST `…/excel/import` | `importVasAccountExcel(body)` |
| Template download | — (client `<a download>`, no HTTP) | `downloadVasAccountTemplate(locale)` |

> **No `/export` consumption.** The backend `POST …/export` endpoint exists and is tested, but the
> panel exposes no export button today (OQ-VAS-1). Excel **Upload** is the only Excel surface.

## 2. List request params (`FetchVasAccountsParams`)

| Param | Source | Wire format |
|---|---|---|
| `searchWd` | trimmed keyword | `search_wd` |
| `statuses` | Active/Inactive checkboxes | repeatable `stts=A&stts=I` |
| `all` | panel constant | `all=true` (full set, no pagination) |
| `sortField` / `sortDirection` / `page` / `size` | (not used by the panel) | `sort_field` / `sort_direction` / `page` / `size` |

The panel always sends `all: true` with both statuses by default. Empty `statuses` → the hook returns
empty without calling the wire.

## 3. List response → in-memory mapping (`mappers.ts`)

Wire `ApiVasAccountRow` → built into `VasAccountRow[]` by `buildTree(res.list)`:

| Wire | In-memory |
|---|---|
| `vas_acct_seq_no` (string) | `id` / `seqNo` |
| `vas_acct_cd` | `vasCode` |
| `vas_acct_nm` | `accountName` |
| `vas_acct_enm` | `englishName` |
| `vas_acct_type` (`0/1/2`) | `type` (`dual`/`credit`/`debit`) via `typeFromCode` |
| `vas_acct_type_key` | `typeKey` |
| `stts` (`A/I`) | `status` (`active`/`inactive`) via `statusFromCode` |
| `stts_key` | `statusKey` |
| `cont` | `notes` |
| — (derived) | `kind` (`parent`/`child`) + `parentCode` — computed from `vas_acct_cd` prefixes; not from the wire |

`buildTree` maps rows by code, finds each row's parent by walking its code prefix down to ≥ 3 chars,
emits roots (code-sorted) then their code-sorted children. **Display-only** — never written back.

## 4. Lookup response → picker (`VasAccountPicker`)

`ApiVasAccountLookupRow` → `VasAccountSelection = { seqNo:number, code, name }`. Note the lookup row's
`vas_acct_seq_no` is a **number** (vs the string on the full row) — by design.

## 5. Mutations

| Mutation | Request (via mapper) | Wire body |
|---|---|---|
| `create(values)` | `toCreateRequest` | `{ vas_acct_cd, vas_acct_nm, stts }` (type/enm/cont omitted) |
| `update(seqNo, values)` | `toUpdateRequest` (delegates to create) | `{ vas_acct_cd, vas_acct_nm, stts }` |
| `remove(seqNo)` | — | DELETE `…/{seqNo}` (custom unwrap tolerates missing `data`) |

`statusToCode`: `inactive → "I"`, else `"A"`.

## 6. Excel preview / import

- **Preview** — `previewVasAccountExcel(file)` posts multipart, returns `ApiVasAccountExcelPreview`
  (`rows`, `total_count`, `completed_count`, `error_count`). Each `rows[i]` carries `row_index`,
  `vas_acct_cd`, `vas_acct_nm`, `valid`, and `errors[]` (`{ field, code, message }`,
  code ∈ `required`/`length`/`format`/`dup_file`/`dup_db`). In Reset/Replace mode the UI drops `dup_db`
  errors client-side.
- **Import** — `importVasAccountExcel({ upld_optn: "A"|"R", rows: [{vas_acct_cd, vas_acct_nm}] })` →
  `ApiVasAccountExcelImportResult` (`inserted_count`, `replaced_count`). Only valid rows are sent.

> **As-built note (supersedes the older single-file doc).** The preview wire shape is
> `rows`/`total_count`/`completed_count`/`error_count` — **not** the legacy `tot_cnt`/`suc_cnt`/`rec`
> shown in the original `vas-account.md`. There is no `validateCell` / cell-validate call; inline cell
> editing was dropped.

## 7. Error handling

`ApiCallError` carries `{ code, message }`. The panel surfaces failures via
`useDialog({ type: "error", errorCode })` — **error** chrome (red), never warning, for API / Zod /
file-type / row failures (project-wide dialog-variant rule). Known codes: `WBE0003` (duplicate code),
`WBE2040` (not found / wrong tenant), `WBE2041`/`2042`/`2043` (Excel), `WBE_VALIDATION`. The
`trace_id` from the envelope renders verbatim in the dialog.

## 8. Casing note

VAS Account wire types are already **lowercase snake_case** (`ApiVasAccount*` in `lib/types/api.ts`) —
no UPPER_SNAKE holdover. The one historical-drift caveat is the preview shape (§6), corrected here.
