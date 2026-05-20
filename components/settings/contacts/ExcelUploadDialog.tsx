"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

import { useDialog } from "@/components/shared/dialog";
import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import { bulkImportContacts } from "@/lib/api/contacts";
import { useTranslation } from "@/lib/i18n";
import type {
    ApiContactAddressOp,
    ApiContactCreateRequest,
} from "@/lib/types/api";

import type { ContactLocation } from "./types";

type ExcelUploadDialogProps = {
    onClose: () => void;
    onSaved?: () => void;
};

/* ──────────────────────────────────────────────────────────────────
 * Date helpers (mirrors mappers.ts — local copy so this module is
 * self-contained and mappers.ts stays export-stable).
 * ────────────────────────────────────────────────────────────────── */

function todayYyyyMmDd(): string {
    const d = new Date();
    return (
        d.getFullYear().toString().padStart(4, "0") +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0")
    );
}

function tomorrowYyyyMmDd(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return (
        d.getFullYear().toString().padStart(4, "0") +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0")
    );
}

let _keyCounter = 0;
function nextClientKey(prefix: string): string {
    _keyCounter = (_keyCounter + 1) % 10000;
    const d = new Date();
    const ts =
        d.getUTCFullYear().toString().padStart(4, "0") +
        (d.getUTCMonth() + 1).toString().padStart(2, "0") +
        d.getUTCDate().toString().padStart(2, "0") +
        d.getUTCHours().toString().padStart(2, "0") +
        d.getUTCMinutes().toString().padStart(2, "0") +
        d.getUTCSeconds().toString().padStart(2, "0");
    return `${prefix.slice(0, 3)}${ts}${_keyCounter.toString().padStart(4, "0")}`.slice(0, 20);
}

/** Parse cell date strings (DD-MM-YYYY, YYYY-MM-DD, yyyyMMdd) → yyyyMMdd. */
function parseDateCell(raw: string): string {
    const s = raw.trim();
    if (!s) return "";
    const dmy = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
    if (dmy) return `${dmy[3]}${dmy[2].padStart(2, "0")}${dmy[1].padStart(2, "0")}`;
    const ymd = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
    if (ymd) return `${ymd[1]}${ymd[2].padStart(2, "0")}${ymd[3].padStart(2, "0")}`;
    if (/^\d{8}$/.test(s)) return s;
    return "";
}

/* ──────────────────────────────────────────────────────────────────
 * Template download — navigates the browser to the pre-built static
 * xlsx files in `public/templates/contacts/` (same pattern as the
 * Payment module templates). KM falls back to EN — no KM template.
 * ────────────────────────────────────────────────────────────────── */

const LOCAL_TEMPLATE_URL: Record<string, string> = {
    EN: "/templates/contacts/WeCMS_Local_Contacts_download_EN.xlsx",
    KO: "/templates/contacts/WeCMS_Local_Contacts_download_KO.xlsx",
    VI: "/templates/contacts/WeCMS_Local_Contacts_download_VI.xlsx",
};

const OVERSEAS_TEMPLATE_URL: Record<string, string> = {
    EN: "/templates/contacts/WeCMS_Overseas_Contacts_download_EN.xlsx",
    KO: "/templates/contacts/WeCMS_Overseas_Contacts_download_KO.xlsx",
    VI: "/templates/contacts/WeCMS_Overseas_Contacts_download_VI.xlsx",
};

function triggerTemplateDownload(url: string): void {
    const a = document.createElement("a");
    a.href = url;
    a.download = url.split("/").pop() ?? "template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/* ──────────────────────────────────────────────────────────────────
 * Parsed-row shape — carries both the preview-table representation
 * and the ready-to-POST API request (null when the row has errors).
 * ────────────────────────────────────────────────────────────────── */

type ParsedContactRow = {
    previewRow: ExcelUploadRow;
    /** null when the row failed validation; excluded from the upload batch. */
    apiRequest: ApiContactCreateRequest | null;
};

/* ──────────────────────────────────────────────────────────────────
 * Client-side Excel parsing — reads the file with `xlsx`, maps rows
 * to preview cells + validated API request objects.
 * ────────────────────────────────────────────────────────────────── */

function parseLocalExcel(rawData: unknown[][]): ParsedContactRow[] {
    // Row 0 = title, Row 1 = blank, Row 2 = headers — data starts at row 3.
    const dataRows = rawData
        .slice(3)
        .filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

    return dataRows.map((row, idx) => {
        const get = (i: number) => String(row[i] ?? "").trim();

        // Template columns (positional):
        // 0: Contact Code  1: Contact Name  2: Tax ID
        // 3: Deposit Bank  4: Deposit Account No.  5: Currency
        // 6: Current Address  7: Old Address  8: Valid Date
        const code         = get(0);
        const name         = get(1);
        const taxId        = get(2);
        const bank         = get(3);
        const accountNo    = get(4);
        const currencyRaw  = get(5).toUpperCase().replace(/[^A-Z]/g, "");
        const currentAddress = get(6);
        const oldAddress     = get(7);
        const validDateRaw   = get(8);

        const CODE_PATTERN = /^[A-Za-z0-9_\-.]+$/;
        const errors: Record<string, string> = {};
        if (!code)                         errors.code = "Contact Code is required";
        else if (code.length > 20)         errors.code = "Contact Code must be 20 characters or less";
        else if (!CODE_PATTERN.test(code)) errors.code = "Contact Code: only letters, digits, _ - . allowed";
        if (!name)              errors.name = "Contact Name is required";
        else if (name.length > 200) errors.name = "Contact Name must be 200 characters or less";
        if (taxId && taxId.length > 40) errors.tax_id = "Tax ID must be 40 characters or less";
        if (!bank)      errors.bank       = "Deposit Bank is required";
        if (!accountNo) errors.account_no = "Deposit Account No. is required";
        if (!currencyRaw)                          errors.currency = "Currency is required";
        else if (currencyRaw.length > 3)           errors.currency = "Currency must be 3 characters or less";
        else if (!["VND", "USD"].includes(currencyRaw)) errors.currency = "Currency must be VND or USD";

        const hasErrors = Object.keys(errors).length > 0;

        const previewRow: ExcelUploadRow = {
            id: `row-${idx}`,
            cells: {
                code:            { value: code || null,        error: !!errors.code,       errorMessage: errors.code },
                name:            { value: name || null,        error: !!errors.name,       errorMessage: errors.name },
                tax_id:          { value: taxId || null },
                bank:            { value: bank || null,        error: !!errors.bank,       errorMessage: errors.bank },
                account_no:      { value: accountNo || null,   error: !!errors.account_no, errorMessage: errors.account_no },
                currency:        { value: currencyRaw || get(5) || null, error: !!errors.currency, errorMessage: errors.currency },
                current_address: { value: currentAddress || null },
                old_address:     { value: oldAddress || null },
                valid_date:      { value: validDateRaw || null },
            },
        };

        if (hasErrors) return { previewRow, apiRequest: null };

        const validDateYmd = parseDateCell(validDateRaw);
        const addresses: ApiContactAddressOp[] = [];
        if (currentAddress) {
            addresses.push({
                op: "upsert",
                trco_addr_key: nextClientKey("AD1"),
                disp_ord: 1,
                trco_bsun_post_adrs: currentAddress,
                issu_dt: todayYyyyMmDd(),
                due_dt: tomorrowYyyyMmDd(),
            });
        }
        if (oldAddress) {
            addresses.push({
                op: "upsert",
                trco_addr_key: nextClientKey("AD2"),
                disp_ord: 2,
                trco_bsun_post_adrs: oldAddress,
                issu_dt: todayYyyyMmDd(),
                due_dt: validDateYmd || tomorrowYyyyMmDd(),
            });
        }

        const apiRequest: ApiContactCreateRequest = {
            hand_trco_key: code,
            trco_cmnm: name,
            trco_cmenm: name,
            trco_tax_id: taxId || null,
            trco_type: "L",
            addresses,
            accounts: [
                {
                    op: "upsert",
                    trco_acct_key: nextClientKey("A0"),
                    bank_nm: bank,
                    acct_no: accountNo,
                    acct_ccy_cd: currencyRaw,
                    finc_mda_owner_nm: null,
                    napas_bank_cd: null,
                    citad_bank_cd: null,
                    disp_ord: 1,
                },
            ],
            overseas_beneficiaries: [],
        };

        return { previewRow, apiRequest };
    });
}

/**
 * Overseas template columns (positional):
 *   0: Contact Code*         1: Contact Name*       2: Tax ID
 *   3: Beneficiary Name*     4: Beneficiary Bank Name
 *   5: Bank Identifier Code (BIC)*  6: Beneficiary Account No.*
 *   7: Beneficiary Address   8: Current Address
 *   9: Old Address           10: Valid Date
 */
function parseOverseasExcel(rawData: unknown[][]): ParsedContactRow[] {
    // Row 0 = title, Row 1 = blank, Row 2 = headers — data starts at row 3.
    const dataRows = rawData
        .slice(3)
        .filter((r) => r.some((c) => String(c ?? "").trim() !== ""));

    return dataRows.map((row, idx) => {
        const get = (i: number) => String(row[i] ?? "").trim();

        const code           = get(0);
        const name           = get(1);
        const taxId          = get(2);
        const beneName       = get(3);
        const beneBankName   = get(4);
        const bicCode        = get(5);
        const beneAcctNo     = get(6);
        const beneAddr       = get(7);
        const currentAddress = get(8);
        const oldAddress     = get(9);
        const validDateRaw   = get(10);

        const CODE_PATTERN = /^[A-Za-z0-9_\-.]+$/;
        const errors: Record<string, string> = {};
        if (!code)                         errors.code = "Contact Code is required";
        else if (code.length > 20)         errors.code = "Contact Code must be 20 characters or less";
        else if (!CODE_PATTERN.test(code)) errors.code = "Contact Code: only letters, digits, _ - . allowed";
        if (!name)                  errors.name = "Contact Name is required";
        else if (name.length > 200) errors.name = "Contact Name must be 200 characters or less";
        if (taxId && taxId.length > 40) errors.tax_id = "Tax ID must be 40 characters or less";
        if (!beneName)                  errors.bene_name = "Beneficiary Name is required";
        else if (beneName.length > 200) errors.bene_name = "Beneficiary Name must be 200 characters or less";
        if (beneBankName && beneBankName.length > 200) errors.bene_bank_name = "Beneficiary Bank Name must be 200 characters or less";
        if (!bicCode)                errors.bic_code = "BIC Code is required";
        else if (bicCode.length > 50) errors.bic_code = "BIC Code must be 50 characters or less";
        if (!beneAcctNo)                   errors.bene_acct_no = "Beneficiary Account No. is required";
        else if (beneAcctNo.length > 100)  errors.bene_acct_no = "Beneficiary Account No. must be 100 characters or less";
        if (beneAddr && beneAddr.length > 500) errors.bene_addr = "Beneficiary Address must be 500 characters or less";

        const hasErrors = Object.keys(errors).length > 0;

        const previewRow: ExcelUploadRow = {
            id: `row-${idx}`,
            cells: {
                code:            { value: code || null,         error: !!errors.code,         errorMessage: errors.code },
                name:            { value: name || null,         error: !!errors.name,         errorMessage: errors.name },
                tax_id:          { value: taxId || null },
                bene_name:       { value: beneName || null,     error: !!errors.bene_name,      errorMessage: errors.bene_name },
                bene_bank_name:  { value: beneBankName || null, error: !!errors.bene_bank_name, errorMessage: errors.bene_bank_name },
                bic_code:        { value: bicCode || null,      error: !!errors.bic_code,       errorMessage: errors.bic_code },
                bene_acct_no:    { value: beneAcctNo || null,   error: !!errors.bene_acct_no,   errorMessage: errors.bene_acct_no },
                bene_addr:       { value: beneAddr || null,     error: !!errors.bene_addr,      errorMessage: errors.bene_addr },
                current_address: { value: currentAddress || null },
                old_address:     { value: oldAddress || null },
                valid_date:      { value: validDateRaw || null },
            },
        };

        if (hasErrors) return { previewRow, apiRequest: null };

        const validDateYmd = parseDateCell(validDateRaw);
        const addresses: ApiContactAddressOp[] = [];
        if (currentAddress) {
            addresses.push({
                op: "upsert",
                trco_addr_key: nextClientKey("AD1"),
                disp_ord: 1,
                trco_bsun_post_adrs: currentAddress,
                issu_dt: todayYyyyMmDd(),
                due_dt: tomorrowYyyyMmDd(),
            });
        }
        if (oldAddress) {
            addresses.push({
                op: "upsert",
                trco_addr_key: nextClientKey("AD2"),
                disp_ord: 2,
                trco_bsun_post_adrs: oldAddress,
                issu_dt: todayYyyyMmDd(),
                due_dt: validDateYmd || tomorrowYyyyMmDd(),
            });
        }

        const apiRequest: ApiContactCreateRequest = {
            hand_trco_key: code,
            trco_cmnm: name,
            trco_cmenm: name,
            trco_tax_id: taxId || null,
            trco_type: "O",
            addresses,
            accounts: [],
            overseas_beneficiaries: [
                {
                    op: "upsert",
                    trco_ovrs_key: nextClientKey("O0"),
                    bene_name: beneName,
                    bic_code: bicCode,
                    bene_acct_no: beneAcctNo,
                    bene_bank_name: beneBankName || null,
                    bene_bank_code: null,
                    bene_addr: beneAddr || null,
                },
            ],
        };

        return { previewRow, apiRequest };
    });
}

/** Read an xlsx / xls file and return the first sheet's raw cell
 *  values as a 2-D array of strings. */
function readExcelFile(file: File): Promise<unknown[][]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target?.result, { type: "binary" });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
                    header: 1,
                    defval: "",
                    raw: false,
                }) as unknown[][];
                resolve(rows);
            } catch {
                reject(new Error("Failed to parse Excel file. Please use the provided template."));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsBinaryString(file);
    });
}

/** Open a native file-picker and resolve to the chosen file.
 *  Resolves to null when the user cancels. */
function pickFile(): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept =
            ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
        let settled = false;
        input.addEventListener("change", () => {
            settled = true;
            resolve(input.files?.[0] ?? null);
        });
        // Resolve null if the picker is dismissed without a selection.
        window.addEventListener(
            "focus",
            () => {
                setTimeout(() => {
                    if (!settled) resolve(null);
                }, 500);
            },
            { once: true },
        );
        input.click();
    });
}

/**
 * Contacts Excel Upload dialog — Figma 9194:11192.
 *
 * Implements real file picking, client-side xlsx parsing, row
 * validation, and per-row `createContact` upload. The shared
 * `<ExcelUploadDialog>` shell stays purely presentational.
 *
 * Parse strategy:
 *   - Local: 10 positional columns (Contact Code / Name / Tax ID /
 *     Bank / Account No. / Currency / Recipient / Current Address /
 *     Old Address / Valid Date).
 *   - Overseas: same 10 column slots remapped to beneficiary fields
 *     (Contact Code / Name / Tax ID / Beneficiary Name / SWIFT Code /
 *     Beneficiary Acct No. / Beneficiary Bank / Bank Code /
 *     Beneficiary Addr / Current Address).
 *
 * Upload: one `POST /api/v1/settings/contacts/excel/import` call with
 * all valid rows. The backend processes each row independently so
 * partial success is possible. TRCO_KEY is allocated server-side via
 * the V85 `wb_get_next_val('trco_infm','trco_key',…)` branch (OQ-4).
 */
export default function ExcelUploadDialog({ onClose, onSaved }: ExcelUploadDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    const [variant, setVariant] = useState<ContactLocation>("local");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedContactRow[]>([]);
    const [isBusy, setIsBusy] = useState(false);

    const completedCount = parsedRows.filter((r) => r.apiRequest !== null).length;
    const errorCount = parsedRows.filter((r) => r.apiRequest === null).length;
    const previewRows = parsedRows.map((r) => r.previewRow);

    // Changing the variant resets the file selection so the user
    // re-downloads the correct template and re-selects a matching file.
    function handleVariantChange(v: string) {
        const next = v as ContactLocation;
        if (next !== variant) {
            setVariant(next);
            setSelectedFile(null);
            setParsedRows([]);
        }
    }

    function handleDownload() {
        const urls = variant === "local" ? LOCAL_TEMPLATE_URL : OVERSEAS_TEMPLATE_URL;
        const url = urls[locale.toUpperCase()] ?? urls["EN"];
        triggerTemplateDownload(url);
    }

    async function handleReSelect() {
        const file = await pickFile();
        if (!file) return;
        setIsBusy(true);
        try {
            const raw = await readExcelFile(file);
            const parsed =
                variant === "local"
                    ? parseLocalExcel(raw)
                    : parseOverseasExcel(raw);
            setSelectedFile(file);
            setParsedRows(parsed);
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("dialog.error_generic");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: msg,
            });
        } finally {
            setIsBusy(false);
        }
    }

    async function handleUpload() {
        const validRequests = parsedRows
            .filter((r) => r.apiRequest !== null)
            .map((r) => r.apiRequest!);

        if (validRequests.length === 0) return;

        setIsBusy(true);
        try {
            const result = await bulkImportContacts({ contacts: validRequests });

            onClose();

            if (result.failed === 0) {
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("settings.contacts.upload.success_description", {
                        count: String(result.imported),
                    }),
                });
            } else {
                const firstError = result.errors[0];
                const detail = firstError
                    ? ` (Row ${firstError.index + 1}: ${firstError.message})`
                    : "";
                dialog.open({
                    type: result.imported > 0 ? "success" : "error",
                    title: result.imported > 0 ? t("dialog.success") : t("dialog.error"),
                    description:
                        result.imported > 0
                            ? `${result.imported} contact(s) imported, ${result.failed} failed.${detail}`
                            : `Import failed: ${result.failed} row(s) could not be imported.${detail}`,
                });
            }

            onSaved?.();
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("dialog.error_generic");
            dialog.open({ type: "error", title: t("dialog.error"), description: msg });
        } finally {
            setIsBusy(false);
        }
    }

    const COMMON_COLS: ExcelUploadColumn[] = [
        { id: "code",    label: t("settings.contacts.upload.col.contact_code"), required: true, widthPx: 130 },
        { id: "name",    label: t("settings.contacts.upload.col.contact_name"), required: true, widthPx: 200 },
        { id: "tax_id",  label: t("settings.contacts.upload.col.tax_id"),                       widthPx: 140 },
    ];

    const LOCAL_COLS: ExcelUploadColumn[] = [
        ...COMMON_COLS,
        { id: "bank",            label: t("settings.contacts.upload.col.deposit_bank"),       required: true, widthPx: 160 },
        { id: "account_no",      label: t("settings.contacts.upload.col.deposit_account_no"), required: true, widthPx: 160 },
        { id: "currency",        label: t("settings.contacts.upload.col.currency"),           required: true, widthPx: 90  },
        { id: "current_address", label: t("settings.contacts.upload.col.current_address"),                   widthPx: 240 },
        { id: "old_address",     label: t("settings.contacts.upload.col.old_address"),                       widthPx: 200 },
        { id: "valid_date",      label: t("settings.contacts.upload.col.valid_date"),                        widthPx: 110 },
    ];

    const OVERSEAS_COLS: ExcelUploadColumn[] = [
        ...COMMON_COLS,
        { id: "bene_name",       label: t("settings.contacts.upload.col.bene_name"),      required: true, widthPx: 180 },
        { id: "bene_bank_name",  label: t("settings.contacts.upload.col.bene_bank_name"),                 widthPx: 180 },
        { id: "bic_code",        label: t("settings.contacts.upload.col.bic_code"),       required: true, widthPx: 120 },
        { id: "bene_acct_no",    label: t("settings.contacts.upload.col.bene_acct_no"),   required: true, widthPx: 160 },
        { id: "bene_addr",       label: t("settings.contacts.upload.col.bene_addr"),                      widthPx: 200 },
        { id: "current_address", label: t("settings.contacts.upload.col.current_address"),                widthPx: 200 },
        { id: "old_address",     label: t("settings.contacts.upload.col.old_address"),                    widthPx: 180 },
        { id: "valid_date",      label: t("settings.contacts.upload.col.valid_date"),                     widthPx: 110 },
    ];

    const columns = variant === "local" ? LOCAL_COLS : OVERSEAS_COLS;

    return (
        <SharedExcelUploadDialog
            onClose={onClose}
            title={t("settings.contacts.upload.title")}
            selectStep={{
                title: t("settings.contacts.upload.select_option_title"),
                description: t("settings.contacts.upload.select_option_description"),
                options: [
                    { value: "local", label: t("settings.contacts.upload.option.local") },
                    { value: "overseas", label: t("settings.contacts.upload.option.overseas") },
                ],
                selectedValue: variant,
                onChange: handleVariantChange,
            }}
            step1Title={t("settings.contacts.upload.step_download_title")}
            step1Description={t("settings.contacts.upload.step_download_description")}
            downloadLabel={t("settings.contacts.upload.download")}
            onDownload={handleDownload}
            step2Title={t("settings.contacts.upload.step_browse_title")}
            step2Description={t("settings.contacts.upload.step_browse_description")}
            fileName={selectedFile?.name}
            reSelectLabel={t("settings.contacts.upload.re_select")}
            onReSelect={handleReSelect}
            completedLabel={t("settings.contacts.upload.completed")}
            completedCount={completedCount}
            errorLabel={t("settings.contacts.upload.error")}
            errorCount={errorCount}
            columns={columns}
            rows={previewRows}
            totalLabel={t("settings.contacts.upload.total_contacts", {
                count: previewRows.length,
            })}
            closeLabel={t("settings.contacts.upload.close")}
            uploadLabel={t("settings.contacts.upload.upload")}
            uploadDisabled={
                selectedFile === null ||
                parsedRows.length === 0 ||
                errorCount > 0 ||
                isBusy
            }
            onUpload={handleUpload}
        />
    );
}
