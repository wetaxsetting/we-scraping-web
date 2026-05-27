"use client";

import { useEffect, useRef, useState } from "react";

import PaymentExcelUploadDialog, {
    type PaymentExcelParseResult,
} from "@/components/payment/shared/PaymentExcelUploadDialog";
import { type ExcelUploadColumn, type ExcelUploadRow } from "@/components/shared/excel-upload/ExcelUploadDialog";
import {
    createScheduledTransfer,
    fetchWithdrawalAccounts,
    parseInternalTransferExcel,
} from "@/lib/api/internalTransfer";
import type {
    ApiCreateScheduledTransferRequest,
    ApiParsedTransferLine,
    ApiTransferLineInput,
    ApiWithdrawalAccountRow,
} from "@/lib/types/api";
import { useTranslation, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Per-locale Excel template URL. Templates are the JEX originals
 * (`WECMS_DEV/WECMS_STATIC/web/file/excel/VN/WeCMS_Internal_Transfer_upload_*.xlsx`)
 * copied verbatim into the Next.js `public/` so the spreadsheet a user
 * downloads in the refactor is byte-identical to the one they get on
 * `dev.wecms.vn`. KM falls back to EN (the JEX side has no KM template
 * either — see legacy `pymn_0009_002.ts:277`).
 */
const TEMPLATE_URL: Record<Locale, string> = {
    EN: "/templates/internal-transfer/WeCMS_Internal_Transfer_upload_EN.xlsx",
    KO: "/templates/internal-transfer/WeCMS_Internal_Transfer_upload_KO.xlsx",
    VI: "/templates/internal-transfer/WeCMS_Internal_Transfer_upload_VI.xlsx",
};

/**
 * Per-line transfer currency fallback. The legacy parser stamps each
 * line with the spreadsheet's TRNF_CCY_CD column; we keep this fallback
 * for rows that arrived without one so the wire shape is never blank.
 * Defaults to VND (the only currency the Vietnam-local Internal
 * Transfer template supports today — see the JEX `xlsx` templates).
 */
const DEFAULT_TRNF_CCY_CD = "VND";

/**
 * ACCT_TYPE_CD → display label. Mirrors the JEX frontend map at
 * `pymn_0009_002.ts:563-570` byte-for-byte. The legacy backend filter
 * already narrows the dropdown to types 03..08, so we only need
 * entries for those values; anything else falls back to "Savings"
 * (legacy default).
 */
const ACCT_TYPE_LABEL: Record<string, string> = {
    "03": "Current",   // VND
    "04": "Current",   // USD
    "05": "Savings",   // VND
    "06": "Savings",   // USD
    "07": "Current",   // KRW
    "08": "Savings",   // KRW
};
function acctTypeLabel(code: string): string {
    return ACCT_TYPE_LABEL[code] ?? "Savings";
}
function accountDisplay(a: ApiWithdrawalAccountRow): string {
    return `${a.bank_nm} ${a.acct_no} (${acctTypeLabel(a.acct_type_cd)} ${a.ccy_cd})`;
}
function accountKey(a: ApiWithdrawalAccountRow): string {
    return `${a.bank_cd}|${a.acct_no}`;
}

type Props = {
    onClose: () => void;
    /** Fired after a successful save. Parent typically refetches the
     *  Scheduled Transfer list. */
    onSaved?: (scdulPymnNo: string) => void;
};

/**
 * Payment > Internal Transfer — Excel-upload dialog (legacy
 * `pymn_0009_002`). Thin wrapper around the shared
 * {@link PaymentExcelUploadDialog} (CLAUDE.md §3a Excel Upload preview
 * modals — shared shell, configurable columns). This file only
 * carries Internal-Transfer-specific configuration:
 *
 *   - Column definitions (8 columns from the JEX template — Recipient
 *     Account, Recipient Name, Recipient Bank, Transfer Network,
 *     Amount, Description, Doc No., Note).
 *   - Parse + Save endpoints (POST `/uploads/parse` + POST root).
 *   - A mapper from the Phase A wire `ApiParsedTransferLine` →
 *     `ExcelUploadRow` keyed by column id.
 *   - Translated chrome strings + the post-save success copy.
 *
 * Sibling Payment-module dialogs (Vendor / Expense / Payroll /
 * Overseas) mirror this wrapper shape: own columns, own endpoints,
 * own i18n keys, same {@link PaymentExcelUploadDialog} shell. Do NOT
 * fork the shell.
 */
export default function InternalTransferUploadDialog({ onClose, onSaved }: Props) {
    const { t, locale } = useTranslation();

    // Withdrawal accounts — fetched from the dedicated firm-banking
    // endpoint (mirrors legacy `comm_1001_001` at
    // `pymn_0009_002.ts:529`). Filters to active current/savings
    // accounts enrolled in firm-banking with ORG_STAT='1' (see
    // backend `AcctMstrRepository#findWithdrawalAccounts`). The first
    // row auto-selects so the user never sees a blank picker.
    const [accounts, setAccounts] = useState<ApiWithdrawalAccountRow[]>([]);
    const [selectedKey, setSelectedKey] = useState<string>("");
    // Original parsed lines from the backend response, kept verbatim so
    // the save call ships the FULL wire shape (separate `ant_div_cd`
    // discriminator + `tar_bank_cd` value etc.) instead of being
    // reconstructed from the preview cells. The preview cells collapse
    // bank code + ant-div display into one column for the table chrome;
    // rebuilding from those would conflate the two fields. Mirrors
    // legacy `pymn_0009_002.ts:454` which sends `IMPORTED_SUCCESS_DATA`
    // (the original parsed lines) on save.
    const [parsedLines, setParsedLines] = useState<ApiParsedTransferLine[]>([]);
    useEffect(() => {
        let cancelled = false;
        fetchWithdrawalAccounts()
            .then((list) => {
                if (cancelled) return;
                setAccounts(list);
                if (list.length > 0) setSelectedKey(accountKey(list[0]));
            })
            .catch(() => {
                // Empty list is the silent-fallback — the picker shows
                // "No accounts available" and Save stays disabled via
                // the `!selectedAccount` check below.
            });
        return () => {
            cancelled = true;
        };
    }, []);
    const selectedAccount = accounts.find((a) => accountKey(a) === selectedKey);

    function handleDownloadTemplate() {
        // Anchor + click pattern is the legacy parity behaviour
        // (`pymn_0009_002.ts:278` sets `<a>.href` and the browser
        // streams the file). Static asset under `public/templates/`.
        const url = TEMPLATE_URL[locale] ?? TEMPLATE_URL.EN;
        const a = document.createElement("a");
        a.href = url;
        a.download = url.split("/").pop() ?? "WeCMS_Internal_Transfer_upload.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // 9 columns matching the legacy JEX `pymn_0009_002_view.jsp` table
    // header order (Bank Code → Deposit No. → Bank → Transfer Amount →
    // Transfer Currency → Remarks → Reporting Account → Description →
    // Document No.). Required flags + widths match the JEX `<colgroup>`
    // (`160px / 160px / 160px / 160px / 160px / 160px / 180px / 150px /
    // 150px`). Column 3 "Bank" is display-only; backend resolves the
    // bank name from BANK_CD via BANK_INFM.
    const columns: ExcelUploadColumn[] = [
        {
            id: "ANT_DIV_CD",
            label: t("internal_transfer.upload.col.bank_code"),
            required: true,
            widthPx: 160,
        },
        {
            id: "FINC_MDA_NO",
            label: t("internal_transfer.upload.col.deposit_no"),
            required: true,
            widthPx: 160,
        },
        {
            id: "TAR_BANK_NM",
            label: t("internal_transfer.upload.col.bank"),
            widthPx: 160,
        },
        {
            id: "TRAN_AMT",
            label: t("internal_transfer.upload.col.transfer_amount"),
            required: true,
            widthPx: 160,
            align: "right",
        },
        {
            id: "TRNF_CCY_CD",
            label: t("internal_transfer.upload.col.transfer_currency"),
            required: true,
            widthPx: 160,
        },
        {
            id: "TRAN_USAG",
            label: t("internal_transfer.upload.col.remarks"),
            widthPx: 160,
        },
        {
            id: "CHART_ACCT_CD",
            label: t("internal_transfer.upload.col.reporting_account"),
            widthPx: 180,
        },
        {
            id: "NOTE",
            label: t("internal_transfer.upload.col.description"),
            widthPx: 150,
        },
        {
            id: "DOC_NO",
            label: t("internal_transfer.upload.col.document_no"),
            widthPx: 150,
        },
    ];

    async function handleParse(file: File): Promise<PaymentExcelParseResult> {
        // The backend parser keys cut-off-time + per-cell warnings off
        // the WITHDRAWAL bank code. Falls back to the first account in
        // the list when nothing is selected yet — should never happen
        // since the effect above auto-selects, but defends against an
        // empty-list race.
        const bankCd = selectedAccount?.bank_cd ?? accounts[0]?.bank_cd ?? "";
        const response = await parseInternalTransferExcel(file, bankCd);
        const lines = response.rows ?? [];
        setParsedLines(lines);
        const rows: ExcelUploadRow[] = lines.map(toUploadRow);
        return {
            rows,
            completedCount: Number(response.suc_cnt ?? 0),
            errorCount:     Number(response.err_cnt ?? 0),
        };
    }

    async function handleUpload(file: File, parsed: PaymentExcelParseResult) {
        // `parsed` is the preview shape; the actual save uses
        // `parsedLines` (the original backend response). The
        // preview-row count + the parsed-line count agree exactly —
        // the wrapper builds one from the other in handleParse.
        void parsed;
        // Ship the ORIGINAL parsed lines verbatim — preserves the
        // separation between the network discriminator
        // (`ant_div_cd` = "NAPAS" / "CITAD") and the actual bank code
        // (`tar_bank_cd` = "970424"). Rebuilding from the preview
        // cells would conflate the two because the preview displays
        // the bank code under FIELD_ID `ANT_DIV_CD` for legacy
        // error-highlight parity. Mirrors legacy
        // `pymn_0009_002.ts:466-473` which sends
        // `IMPORTED_SUCCESS_DATA` directly. Drops rows that had per-
        // cell errors (`err_fld` set) — legacy parity with
        // `IMPORTED_SUCCESS_DATA` which is the clean subset.
        if (!selectedAccount) {
            throw new Error("Withdrawal account is required.");
        }
        const successLines = parsedLines.filter(
            (l) => !l.err_fld || l.err_fld.length === 0,
        );
        const lines: ApiTransferLineInput[] = successLines.map(parsedToWire);
        const titl = file.name.replace(/\.[^/.]+$/, "");
        const request: ApiCreateScheduledTransferRequest = {
            titl,
            bank_cd:     selectedAccount.bank_cd,
            acct_no:     selectedAccount.acct_no,
            ccy_cd:      selectedAccount.ccy_cd,
            trnf_ccy_cd: DEFAULT_TRNF_CCY_CD,
            lines,
        };
        const created = await createScheduledTransfer(file, request);
        return created;
    }

    return (
        <PaymentExcelUploadDialog
            onClose={onClose}
            onSaved={(result) => {
                const created = result as { scdul_pymn_no: string } | undefined;
                if (created?.scdul_pymn_no) onSaved?.(created.scdul_pymn_no);
            }}
            strings={{
                title:              t("internal_transfer.upload.title"),
                step1Title:         t("internal_transfer.upload.step1_title"),
                step1Description:   t("internal_transfer.upload.step1_description"),
                downloadLabel:      t("internal_transfer.upload.download"),
                step2Title:         t("internal_transfer.upload.step2_title"),
                step2Description:   t("internal_transfer.upload.step2_description"),
                browseLabel:        t("internal_transfer.upload.browse"),
                reSelectLabel:      t("internal_transfer.upload.re_select"),
                filePlaceholder:    t("internal_transfer.upload.filename"),
                completedLabel:     t("internal_transfer.upload.completed"),
                errorLabel:         t("internal_transfer.upload.error"),
                totalLabelKey:      "internal_transfer.upload.total_transactions",
                closeLabel:         t("internal_transfer.upload.close"),
                uploadLabel:        t("internal_transfer.upload.upload"),
                successDescription: t("internal_transfer.dialog.save_success"),
            }}
            columns={columns}
            onParse={handleParse}
            onUpload={handleUpload}
            onDownload={handleDownloadTemplate}
            extraStep={{
                title: t("internal_transfer.upload.withdrawal_title"),
                description: t("internal_transfer.upload.withdrawal_description"),
                content: (
                    <WithdrawalAccountDropdown
                        accounts={accounts}
                        selectedKey={selectedKey}
                        onSelect={setSelectedKey}
                        emptyLabel={t("internal_transfer.upload.withdrawal_empty")}
                        placeholderLabel={t("internal_transfer.upload.withdrawal_title")}
                    />
                ),
            }}
        />
    );
}

/* ----------------------------------------------------------------------------
 *  Parse-response ⇄ preview-row mapping
 *
 *  Wire shape (snake_case) ↔ ExcelUploadRow (keyed by column id —
 *  matches the FIELD_IDs from the seeded View Setting + the JEX
 *  upload template).
 * -------------------------------------------------------------------------- */

function toUploadRow(line: ApiParsedTransferLine, index: number): ExcelUploadRow {
    // Server-side errors arrive as paired pipe-separated arrays:
    // `err_fld` carries FIELD_IDs and `err_fld_caus` carries the
    // matching cause strings — element i of one aligns with element
    // i of the other. Mirrors legacy `pymn_0009_002.ts:296-298`.
    // We split both into one cause-by-FIELD_ID map; the shared
    // `<ExcelUploadDialog>` paints the red highlight from
    // `cell.error` and renders the hover tooltip from
    // `cell.errorMessage`.
    const fields = (line.err_fld ?? "")
        .split("|")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);
    const causes = (line.err_fld_caus ?? "")
        .split("|")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    const causeByField = new Map<string, string>();
    fields.forEach((id, i) => {
        // Multiple errors on the same cell (rare) collapse into the
        // first one — same UX as legacy.
        if (!causeByField.has(id)) causeByField.set(id, causes[i] ?? "");
    });
    const cell = (fieldId: string, value: string | null) => ({
        value,
        error: causeByField.has(fieldId),
        errorMessage: causeByField.get(fieldId) || undefined,
    });

    // Column order matches JEX `pymn_0009_002_view.jsp`: Bank Code →
    // Deposit No. → Bank → Transfer Amount → Transfer Currency →
    // Remarks → Reporting Account → Description → Document No.
    return {
        id: `line-${index + 1}`,
        cells: {
            ANT_DIV_CD:    cell("ANT_DIV_CD",    line.tar_bank_cd),
            FINC_MDA_NO:   cell("FINC_MDA_NO",   line.finc_mda_no),
            TAR_BANK_NM:   cell("TAR_BANK_NM",   line.tar_bank_nm),
            TRAN_AMT:      cell("TRAN_AMT",      line.tran_amt),
            TRNF_CCY_CD:   cell("TRNF_CCY_CD",   line.trnf_ccy_cd),
            TRAN_USAG:     cell("TRAN_USAG",     line.tran_usag),
            CHART_ACCT_CD: cell("CHART_ACCT_CD", line.chart_acct_cd),
            NOTE:          cell("NOTE",          line.note),
            DOC_NO:        cell("DOC_NO",        line.doc_no),
        },
    };
}

/**
 * Map a parsed line (the backend's response shape) directly to the
 * wire input shape (what the save endpoint expects). The two shapes
 * share most field names — the mapper exists to (a) drop the read-only
 * preview-only fields (`tar_bank_nm`, `err_fld`, `err_fld_caus`) and
 * (b) default `tran_amt` + `trnf_ccy_cd` when the backend echoed them
 * as null, so the wire stays Bean-Validation-clean.
 */
function parsedToWire(line: ApiParsedTransferLine): ApiTransferLineInput {
    return {
        finc_mda_no:       line.finc_mda_no ?? "",
        ant_div_cd:        line.ant_div_cd ?? null,
        tar_bank_cd:       line.tar_bank_cd ?? null,
        tran_amt:          line.tran_amt ?? "0",
        trnf_ccy_cd:       line.trnf_ccy_cd ?? DEFAULT_TRNF_CCY_CD,
        tran_usag:         line.tran_usag ?? null,
        chart_acct_cd:     line.chart_acct_cd ?? null,
        chart_acct_seq_no: line.chart_acct_seq_no ?? null,
        note:              line.note ?? null,
        doc_no:            line.doc_no ?? null,
        citad_bank_cd:     line.citad_bank_cd ?? null,
        depo_ccy_cd:       line.depo_ccy_cd ?? null,
    };
}

/* ----------------------------------------------------------------------------
 *  Withdrawal-account chip dropdown
 *
 *  Trigger chip styled like `<FilterDropdown>` (32-px chip, raised
 *  shadow, right-side chevron) plus a click-outside / ESC popover
 *  list. Inline because Internal Transfer is the canonical first
 *  consumer; if Vendor / Expense / Payroll / Overseas need the same
 *  picker later, lift into `components/shared/` then.
 * -------------------------------------------------------------------------- */

type WithdrawalAccountDropdownProps = {
    accounts: ApiWithdrawalAccountRow[];
    selectedKey: string;
    onSelect: (key: string) => void;
    emptyLabel: string;
    placeholderLabel: string;
};

function WithdrawalAccountDropdown({
    accounts,
    selectedKey,
    onSelect,
    emptyLabel,
    placeholderLabel,
}: WithdrawalAccountDropdownProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const selected = accounts.find((a) => accountKey(a) === selectedKey);
    const triggerLabel = selected ? accountDisplay(selected)
        : accounts.length === 0 ? emptyLabel
        : placeholderLabel;
    const disabled = accounts.length === 0;

    // Click-outside + ESC close. Scoped to root so the dialog's other
    // focus-trapped content keeps working.
    useEffect(() => {
        if (!open) return;
        function onDocMouseDown(e: MouseEvent) {
            if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onDocMouseDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={placeholderLabel}
                className={cn(
                    "flex h-[var(--h-wb-filter-btn)] w-full items-center justify-between gap-2 overflow-clip rounded-md bg-white px-2.5 shadow-wb-btn",
                    disabled
                        ? "cursor-not-allowed text-wb-muted"
                        : "cursor-pointer text-wb-ntrl-8",
                )}
            >
                <span className="flex-1 truncate text-left text-wb-13 font-medium">
                    {triggerLabel}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/pagination/ico-dropdown-chevron.svg"
                    alt=""
                    aria-hidden
                    className={cn(
                        "size-4 shrink-0 transition-transform",
                        open && "rotate-180",
                    )}
                />
            </button>
            {open && accounts.length > 0 && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 top-[calc(var(--h-wb-filter-btn)+4px)] z-10 max-h-60 overflow-y-auto rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    {accounts.map((a) => {
                        const key = accountKey(a);
                        const isSelected = key === selectedKey;
                        return (
                            <li key={key}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => {
                                        onSelect(key);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "block w-full truncate px-2.5 py-2 text-left text-wb-13 font-medium",
                                        isSelected
                                            ? "bg-brand-soft text-brand"
                                            : "text-wb-ink hover:bg-wb-bg-sidebar",
                                    )}
                                >
                                    {accountDisplay(a)}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
