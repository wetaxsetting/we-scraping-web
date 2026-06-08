import { ApiCallError } from "@/lib/api/banking";
import { api } from "@/lib/axios";
import { exportExcel, type ExcelExportColumn } from "@/lib/excel";
import type {
    ApiContactBankListResponse,
    ApiContactBulkDeleteRequest,
    ApiContactBulkImportRequest,
    ApiContactBulkImportResponse,
    ApiContactCreateRequest,
    ApiContactDetail,
    ApiContactFileListResponse,
    ApiContactFileRow,
    ApiContactListResponse,
    ApiContactLookupRecipientRequest,
    ApiContactLookupRecipientResponse,
    ApiContactType,
    ApiContactUpdateRequest,
    ApiContactsExcelPreflightRequest,
    ApiContactsExcelPreflightResponse,
    ApiContactsExcelResolveRecipientsRequest,
    ApiContactsExcelResolveRecipientsResponse,
    ApiResponse,
} from "@/lib/types/api";

/**
 * Settings &gt; Contacts API client. Mirrors the Spring controller
 * `ContactsController` — six endpoints over `TRCO_INFM` +
 * `TRCO_ADDR_INFM` + `TRCO_ACCT_INFO` + `TRCO_OVRS_INFM` +
 * `PGRO_BSAC_LNKN_INFM`.
 *
 * <p>Errors propagate as {@link ApiCallError} carrying the backend
 * `status.code` so the caller can branch on `WBE1190` (in-use guard,
 * OQ-2), `WBE_VALIDATION`, `WBE2040`-style "not found / wrong tenant",
 * etc.
 *
 * <p>Wire convention: lowercase snake_case (CTO directive 2026-05-08).
 * Path segment `{trcoKey}` is the global per-row identifier allocated
 * via the V85 `wb_get_next_val('trco_infm','trco_key',…)` branch on
 * create.
 */
const BASE = "/api/v1/settings/contacts";

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
    try {
        const res = await promise;
        const body = res.data;
        if (body.status.error || !body.data) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return body.data;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/** Query parameters for the list endpoint. Every field is optional. */
export type FetchContactsParams = {
    /** Free-text filter — matched server-side against contact code,
     *  name, and Tax ID. */
    search?: string;
    /** `"L"` Local / `"O"` Overseas. Omit / `undefined` for both. */
    trcoType?: ApiContactType;
    sortField?: string;
    sortDirection?: "ASC" | "DESC";
    /** Zero-based. Defaults to 0 server-side. */
    page?: number;
    /** Defaults to 20 server-side, clamped to 100. */
    size?: number;
};

/**
 * Filtered + paginated list. Mirrors `ContactsController#list`.
 * `bank_nm_resolved` rides on each row — server resolved via
 * `wb_get_napas_bank_nm_or_citad_bank_nm` per OQ-7.
 */
export function fetchContacts(
    params: FetchContactsParams = {},
): Promise<ApiContactListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiContactListResponse>>(BASE, {
            params: {
                search: params.search || undefined,
                trco_type: params.trcoType,
                sort_field: params.sortField,
                sort_direction: params.sortDirection,
                page: params.page,
                size: params.size,
            },
        }),
    );
}

/** Detail by `trco_key`. Backend resolves the bank-name display copy
 *  via the same V86 function for the primary deposit account. */
export function fetchContact(trcoKey: string): Promise<ApiContactDetail> {
    const path = `${BASE}/${encodeURIComponent(trcoKey)}`;
    return unwrap(api.get<ApiResponse<ApiContactDetail>>(path));
}

/**
 * Create. Backend allocates the global `trco_key` via the V85
 * sequence (`wb_get_next_val('trco_infm','trco_key',…)`, OQ-4) and
 * returns the resulting {@link ApiContactDetail}.
 */
export function createContact(
    body: ApiContactCreateRequest,
): Promise<ApiContactDetail> {
    return unwrap(api.post<ApiResponse<ApiContactDetail>>(BASE, body));
}

/**
 * Update. Same wire shape as create; identity travels via the
 * `{trcoKey}` path segment. When the edit transitions `trco_stts` to
 * `'C'` (effectively a soft delete), the backend runs the WBE1190
 * in-use guard before committing (OQ-2).
 */
export function updateContact(
    trcoKey: string,
    body: ApiContactUpdateRequest,
): Promise<ApiContactDetail> {
    const path = `${BASE}/${encodeURIComponent(trcoKey)}`;
    return unwrap(api.put<ApiResponse<ApiContactDetail>>(path, body));
}

/**
 * Single soft-delete. Backend runs the WBE1190 in-use guard
 * (`ACCT_TRNS_RCV_PAY_INFM.RCV_PAY_TRCO_KEY` references) before
 * flipping `trco_stts` to `'C'` (OQ-2). The success envelope carries
 * no payload; resolves to `void`.
 *
 * <p>Cannot use {@link unwrap} — that helper treats a missing
 * `data` field as an error; void responses legitimately omit `data`
 * (matches the firm-banking-settings / vas-account DELETE precedent).
 */
export async function deleteContact(trcoKey: string): Promise<void> {
    const path = `${BASE}/${encodeURIComponent(trcoKey)}`;
    try {
        const res = await api.delete<ApiResponse<void>>(path);
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Bulk import from Excel upload. Sends all parsed + validated rows in
 * one request. The backend processes each row independently so partial
 * success is possible — check `imported` and `failed` in the response.
 * Always resolves (never throws) — failure counts are in the payload.
 */
export function bulkImportContacts(
    body: ApiContactBulkImportRequest,
): Promise<ApiContactBulkImportResponse> {
    return unwrap(
        api.post<ApiResponse<ApiContactBulkImportResponse>>(
            `${BASE}/excel/import`,
            body,
        ),
    );
}

/**
 * Preflight check for the Excel Upload preview &mdash; given the parsed
 * rows, return per-row flags for {@code hand_trco_key} / {@code trco_tax_id}
 * duplicates against the tenant. The dialog calls this immediately
 * after client-side parsing so the preview table can flag DB duplicates
 * in red BEFORE the user clicks Upload (legacy
 * {@code comm_0184_007_r001_act.jsp} runs the same checks at parse time
 * server-side).
 *
 * Two batched {@code IN (…)} queries on the backend &mdash; one round
 * trip regardless of row count.
 */
export function preflightContactsImport(
    body: ApiContactsExcelPreflightRequest,
): Promise<ApiContactsExcelPreflightResponse> {
    return unwrap(
        api.post<ApiResponse<ApiContactsExcelPreflightResponse>>(
            `${BASE}/excel/preflight`,
            body,
        ),
    );
}

/**
 * Bulk recipient resolution for the Local-Contact Excel-upload
 * preview. The backend matches each row's bank cell against
 * `TB_FIRM_BANK_CODE.ENG_ABRVAT_NM`, routes by NAPAS / CITAD per
 * the legacy match-count rule, and fires the firm-banking inquiry
 * for NAPAS-VND rows. Returns per-row resolution flags so the
 * frontend can populate the Recipient cell + stamp the correct
 * `napas_bank_cd` / `citad_bank_cd` onto each row's upload payload.
 *
 * Mirrors legacy `comm_0184_007_r001_act.jsp:475-533`. Single
 * round trip — uses one bulk IN-query on the bank table.
 */
export function resolveContactsImportRecipients(
    body: ApiContactsExcelResolveRecipientsRequest,
): Promise<ApiContactsExcelResolveRecipientsResponse> {
    return unwrap(
        api.post<ApiResponse<ApiContactsExcelResolveRecipientsResponse>>(
            `${BASE}/excel/resolve-recipients`,
            body,
        ),
    );
}

/**
 * Bulk soft-delete. Atomic server-side per-tenant; the WBE1190 guard
 * fires before the first row is flipped — if any selected contact is
 * referenced by a posted transaction, the whole batch is rejected.
 * Mirrors the vas-account / firm-banking-settings DELETE void pattern.
 */
export async function bulkDeleteContacts(
    body: ApiContactBulkDeleteRequest,
): Promise<void> {
    try {
        const res = await api.post<ApiResponse<void>>(`${BASE}/bulk-delete`, body);
        const env = res.data;
        if (env.status.error) {
            throw new ApiCallError(env.status.code, env.status.message);
        }
        return;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Batch-fetch contacts by their user-supplied beneficiary codes
 * (`HAND_TRCO_KEY`). Designed for the overseas batch-payment Excel
 * preview — collect all unique codes from the parsed sheet and resolve
 * them in one round-trip. Codes that don't match any active contact in
 * the current tenant are silently omitted from the result; the caller
 * detects missing codes by comparing the returned list against its input.
 *
 * Uses POST + JSON body to avoid URL-length limits when an Excel file
 * contains many rows (up to 500 unique codes per request).
 */
export function fetchContactsByBeneficiaryCodes(
    codes: string[],
): Promise<ApiContactDetail[]> {
    if (codes.length === 0) return Promise.resolve([]);
    return unwrap(
        api.post<ApiResponse<ApiContactDetail[]>>(`${BASE}/by-codes`, { codes }),
    );
}

/**
 * NAPAS + CITAD bank list for the Add / Edit dialog bank-picker
 * autocomplete. Single GET — the popup loads the full list on mount
 * and filters client-side as the user types (matches legacy
 * `comm_0109_001_r002` behaviour).
 */
export function fetchContactBanks(): Promise<ApiContactBankListResponse> {
    return unwrap(api.get<ApiResponse<ApiContactBankListResponse>>(`${BASE}/banks`));
}

/**
 * Lookup Recipient — stub today (deterministic mock keyed off the
 * account-number suffix). Returns the resolved recipient name so the
 * dialog can populate the verified-recipient label. The frontend
 * decides whether to call this based on bank status + currency
 * (status='N' or currency='USD' → manual input instead).
 */
export function lookupContactRecipient(
    body: ApiContactLookupRecipientRequest,
): Promise<ApiContactLookupRecipientResponse> {
    return unwrap(
        api.post<ApiResponse<ApiContactLookupRecipientResponse>>(
            `${BASE}/lookup-recipient`,
            body,
        ),
    );
}

/* =================================================================
 *  Attachments — TRCO_INFO_FILE (V98 / V99).
 *
 *  Three endpoints under /{trcoKey}/files:
 *    - GET     list every attachment for a contact
 *    - POST    upload one file (multipart, field name "file")
 *    - DELETE  remove one attachment (DB row + physical file)
 *
 *  Download is a separate GET that streams binary — the page navigates
 *  the browser to the URL (cookie-authenticated via the global Bearer
 *  interceptor + Spring CORS allowlist) so the resulting Save-As
 *  dialog uses the server-supplied filename. The shared
 *  `lib/file.ts downloadFile` helper does the same dance for ERP
 *  Transaction History.
 * ================================================================= */

const FILES_BASE = (trcoKey: string) =>
    `${BASE}/${encodeURIComponent(trcoKey)}/files`;

/**
 * List attachments for one contact. Backend resolves tenant ownership
 * via the parent `TRCO_INFM` row — `TRCO_INFO_FILE` has no
 * `BIZ_KEY` column. Missing / wrong-tenant parent → `WBE_CONTACTS_NOT_FOUND`.
 */
export function listContactFiles(
    trcoKey: string,
): Promise<ApiContactFileListResponse> {
    return unwrap(
        api.get<ApiResponse<ApiContactFileListResponse>>(FILES_BASE(trcoKey)),
    );
}

/**
 * Upload one attachment. Multipart field name is `file`. Backend caps
 * the upload at 10 MB and the extension at the legacy allow-list
 * (jpg/jpeg/png/gif/pdf/doc/docx/xls/xlsx/ppt/pptx). Title is
 * server-defaulted — `Business Registration` for the first file
 * uploaded against a contact, `New document` for every subsequent
 * upload. Returns the newly-inserted row.
 */
export function uploadContactFile(
    trcoKey: string,
    file: File,
): Promise<ApiContactFileRow> {
    const form = new FormData();
    form.append("file", file);
    // The global axios instance defaults to `Content-Type: application/json`.
    // For a multipart upload we must (a) NOT keep the JSON default and
    // (b) NOT set `multipart/form-data` ourselves — axios + the browser
    // compute the `multipart/form-data; boundary=…` header from the
    // FormData payload automatically. Setting it to `null` removes the
    // inherited default so axios's auto-detection wins. Without this,
    // Spring's `@RequestPart("file")` rejects the body with HTTP 400.
    return unwrap(
        api.post<ApiResponse<ApiContactFileRow>>(FILES_BASE(trcoKey), form, {
            headers: { "Content-Type": null },
        }),
    );
}

/**
 * Hard-delete one attachment (DB row + physical file). The success
 * envelope carries no payload; resolves to `void`. Cannot use
 * {@link unwrap} — that helper treats a missing `data` field as an
 * error.
 */
export async function deleteContactFile(
    trcoKey: string,
    fileId: string,
): Promise<void> {
    const path = `${FILES_BASE(trcoKey)}/${encodeURIComponent(fileId)}`;
    try {
        const res = await api.delete<ApiResponse<void>>(path);
        const body = res.data;
        if (body.status.error) {
            throw new ApiCallError(body.status.code, body.status.message);
        }
        return;
    } catch (err) {
        if (err instanceof ApiCallError) throw err;
        const e = err as { response?: { data?: ApiResponse<unknown> }; message?: string };
        const head = e.response?.data?.status;
        if (head) throw new ApiCallError(head.code, head.message);
        throw new ApiCallError("NETWORK", e.message ?? "Network error");
    }
}

/**
 * Compose the absolute URL for the download endpoint. The page
 * passes this to the shared `lib/file.ts downloadFile(url, filename)`
 * helper which fetches with the JWT and saves the blob. Composed
 * here so any route-renaming is a one-place change.
 */
export function contactFileDownloadUrl(
    trcoKey: string,
    fileId: string,
): string {
    return `${FILES_BASE(trcoKey)}/${encodeURIComponent(fileId)}`;
}

/* ===================================================================
 *  Excel export (Download → Local / Overseas Contacts)
 *
 *  Real live-data export via the shared `lib/excel.ts` pipeline →
 *  `POST /api/v1/settings/contacts/export`. Mirrors legacy
 *  `comm_0184_001_r006_excel`. NOT the blank `/templates/contacts/...`
 *  upload template — that file is used only inside the Excel Upload
 *  popup now.
 *
 *  Two screenIds select the backend provider + its exact legacy column
 *  set (ContactsLocalExportProvider / ContactsOverseasExportProvider),
 *  mirroring the Account Inquiry VND/FCY split. FIELD_IDs are the
 *  semantic refactor names seeded in V247 (identity-resolved by
 *  FieldIdAlias). Headers reuse the verified `settings.contacts.upload.col.*`
 *  i18n keys so no new translations are introduced.
 * =================================================================== */

const CONTACTS_EXPORT_ENDPOINT = `${BASE}/export`;

/** Minimal translator signature — the panel passes its `t` from
 *  `useTranslation()` since this module is not a React component. */
type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

type ContactExportColumnDef = { fieldId: string; headerKey: string };

/** Local sheet — legacy comm_0184_001_r006 Local column order (9). */
const LOCAL_EXPORT_COLUMNS: ContactExportColumnDef[] = [
    { fieldId: "CONTACT_CODE",       headerKey: "settings.contacts.upload.col.contact_code" },
    { fieldId: "CONTACT_NAME",       headerKey: "settings.contacts.upload.col.contact_name" },
    { fieldId: "TAX_ID",             headerKey: "settings.contacts.upload.col.tax_id" },
    { fieldId: "DEPOSIT_BANK",       headerKey: "settings.contacts.upload.col.deposit_bank" },
    { fieldId: "DEPOSIT_ACCOUNT_NO", headerKey: "settings.contacts.upload.col.deposit_account_no" },
    { fieldId: "CURRENCY",           headerKey: "settings.contacts.upload.col.currency" },
    { fieldId: "CURRENT_ADDRESS",    headerKey: "settings.contacts.upload.col.current_address" },
    { fieldId: "OLD_ADDRESS",        headerKey: "settings.contacts.upload.col.old_address" },
    { fieldId: "VALID_DATE",         headerKey: "settings.contacts.upload.col.valid_date" },
];

/** Overseas sheet — legacy comm_0184_001_r006 Overseas column order (11). */
const OVERSEAS_EXPORT_COLUMNS: ContactExportColumnDef[] = [
    { fieldId: "CONTACT_CODE",           headerKey: "settings.contacts.upload.col.contact_code" },
    { fieldId: "CONTACT_NAME",           headerKey: "settings.contacts.upload.col.contact_name" },
    { fieldId: "TAX_ID",                 headerKey: "settings.contacts.upload.col.tax_id" },
    { fieldId: "BENEFICIARY_NAME",       headerKey: "settings.contacts.upload.col.bene_name" },
    { fieldId: "BENEFICIARY_BANK_NAME",  headerKey: "settings.contacts.upload.col.bene_bank_name" },
    { fieldId: "BIC_CODE",               headerKey: "settings.contacts.upload.col.bic_code" },
    { fieldId: "BENEFICIARY_ACCOUNT_NO", headerKey: "settings.contacts.upload.col.bene_acct_no" },
    { fieldId: "BENEFICIARY_ADDRESS",    headerKey: "settings.contacts.upload.col.bene_addr" },
    { fieldId: "CURRENT_ADDRESS",        headerKey: "settings.contacts.upload.col.current_address" },
    { fieldId: "OLD_ADDRESS",            headerKey: "settings.contacts.upload.col.old_address" },
    { fieldId: "VALID_DATE",             headerKey: "settings.contacts.upload.col.valid_date" },
];

export type ContactExportType = "local" | "overseas";

/**
 * Export the current tenant's active contacts of the chosen type to
 * XLSX. Respects the active keyword search (passed in `filters.keyword`,
 * applied server-side by `ContactsService.listForExport`). Active-only
 * + BIZ_KEY tenant isolation are enforced by the backend query path.
 *
 * @throws ApiCallError on a business-error envelope (e.g. WBE2013 /
 *         WBE2011) or a network failure — the caller surfaces it via
 *         the shared `useDialog()` error surface.
 */
export async function exportContacts(opts: {
    type: ContactExportType;
    keyword?: string;
    t: TranslateFn;
}): Promise<void> {
    const isLocal = opts.type === "local";
    const screenId = isLocal ? "settings-contacts-local" : "settings-contacts-overseas";
    const defs = isLocal ? LOCAL_EXPORT_COLUMNS : OVERSEAS_EXPORT_COLUMNS;

    const columns: ExcelExportColumn[] = defs.map((d) => ({
        fieldId: d.fieldId,
        header: opts.t(d.headerKey),
        format: "text",
        align: "left",
    }));

    const title = opts.t(
        isLocal ? "settings.contacts.download_local" : "settings.contacts.download_overseas",
    );
    const keyword = opts.keyword?.trim();

    await exportExcel({
        endpoint: CONTACTS_EXPORT_ENDPOINT,
        screenId,
        dymAreaId: "default",
        fileName: title,
        title,
        columns,
        filters: keyword ? { keyword } : {},
    });
}
