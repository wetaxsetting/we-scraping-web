# Purpose — API Consumption (Frontend)

Endpoints the panel calls, request/response wire shapes, and the error → dialog mapping. Backend
contract: [wecms-api/docs/features/settings/purpose/interface-specification.md](../../../../../wecms-api/docs/features/settings/purpose/interface-specification.md).
All calls go through [lib/api/purposeSettings.ts](../../../../lib/api/purposeSettings.ts) (Axios `api`
with JWT interceptor); wire is lowercase snake_case, mapped to camelCase `PurposeNode` at the boundary.

---

## Endpoints

| Action | Client fn | Method + URL | Request | Response |
|---|---|---|---|---|
| List / search | `fetchPurposeSettings(keyword?)` | `GET /api/v1/settings/purpose-settings[?keyword=]` | — | `{ list: ApiPurposeSettingRow[] }` (nested `children`) |
| Detail | `fetchPurposeSetting(useUsagCd)` | `GET .../{use_usag_cd}` | — | `ApiPurposeSettingDetail` (flat) |
| Create | `createPurposeSetting(body)` | `POST .../purpose-settings` | `ApiPurposeSettingCreateRequest` | `ApiPurposeSettingDetail` (echo) |
| Update | `updatePurposeSetting(useUsagCd, body)` | `PUT .../{use_usag_cd}` | `ApiPurposeSettingUpdateRequest` | `ApiPurposeSettingDetail` |
| Delete | `deletePurposeSetting(useUsagCd)` | `DELETE .../{use_usag_cd}` | — | `void` |
| Reorder | `reorderPurposeSettings(body)` | `PUT .../order` | `ApiPurposeReorderRequest` | `{ list: ApiPurposeSettingRow[] }` |
| Excel preview | `previewPurposeExcel(file)` | `POST .../excel/preview` (multipart `file`) | `File` | `ApiPurposeExcelPreview` |
| Excel import | `importPurposeExcel(body)` | `POST .../excel/import` | `ApiPurposeExcelImportRequest` | `{ inserted_count }` |
| Template | `downloadPurposeTemplate(locale)` | static `/templates/purpose/WeCMS_Purpose_Bulk_Upload_{EN\|KO\|VI}.xlsx` | — | (browser download, no API) |

---

## Wire shapes (snake_case)

```ts
interface ApiPurposeSettingRow {
  use_usag_cd: string; hand_use_usag_cd: string; use_usag_nm: string;
  use_usag_cont: string | null; parent_use_usag_cd: string | null;
  disp_yn: "Y" | "N"; disp_ord: number | null; used_in_transactions: boolean;
  mod_id: string | null; mod_dtm: string | null;
  children: ApiPurposeSettingRow[] | null;
}
// ApiPurposeSettingDetail = same fields, no `children`.

interface ApiPurposeSettingCreateRequest {
  hand_use_usag_cd: string; use_usag_nm: string;
  use_usag_cont?: string | null; parent_use_usag_cd?: string | null; disp_yn?: "Y" | "N";
}
type ApiPurposeSettingUpdateRequest = ApiPurposeSettingCreateRequest;

interface ApiPurposeReorderRequest { items: { use_usag_cd: string; disp_ord: number }[]; }

interface ApiPurposeExcelPreview {
  rows: { row_index: number; hand_use_usag_cd: string; use_usag_nm: string;
          use_usag_cont: string; parent_use_usag_cd: string; valid: boolean;
          errors: { field: string; code: ApiPurposeExcelErrorCode; message: string }[] }[];
  total_count: number; completed_count: number; error_count: number;
}
type ApiPurposeExcelErrorCode =
  "required" | "length" | "dup_file" | "dup_db" | "parent_not_found" | "parent_not_root";

interface ApiPurposeExcelImportRequest {
  rows: { hand_use_usag_cd: string; use_usag_nm: string;
          use_usag_cont: string | null; parent_use_usag_cd: string | null }[];
}
interface ApiPurposeExcelImportResult { inserted_count: number; }
```

## Mapping (boundary)

`mapPurposeSettingRow` (in [lib/api/purposeSettings.ts](../../../../lib/api/purposeSettings.ts)) turns
each wire row into a `PurposeNode`: `hand_use_usag_cd → code`, `use_usag_nm → name`,
`use_usag_cont → description` (empty/blank defaults to `"-"`), `disp_yn === "Y" → enabled`, `parent_use_usag_cd → parentSystemCd`,
`used_in_transactions`, `disp_ord`, and recursively `children`. The parent **hand** code
(`parentHandCd`) is resolved from the assembled index so the form/picker can show a friendly label.

## Envelope + error handling

Every response is the standard `{ status: { error, code, message }, data, … }`. Clients check
`status.error` (HTTP 200 ≠ success for business errors) and throw `ApiCallError` carrying `status.code`
+ `trace_id`. `<PurposePanel>` maps codes to dialogs:

| Wire code | Dialog |
|---|---|
| `WBW1152` | error · `settings.purpose.error.duplicate_code` |
| `WBW1138` | error · `settings.purpose.error.duplicate_name` |
| `WBE1199` | error · `settings.purpose.error.delete_blocked` |
| `WBE2041`/`WBE2042`/`WBE2043` + per-cell codes | surfaced in the Excel dialog (row highlights / file-level error) |
| network | error · `settings.purpose.error.network` |
| other | error · `settings.purpose.error.generic` |

401s are handled globally by the Axios response interceptor (session-expired re-auth) — not per call.

## Notes

- On fetch failure the panel renders `mockPurposeTree` as a last-good fallback so the modal still paints.
- Mutations bump `refreshKey`; `useApiData` refetches the full tree (no optimistic source mutation beyond transient toggle/drag feedback).
- There is **no** export endpoint consumed — Purpose has no data export, only the template download.
