"use client";

import { useEffect, useRef, useState } from "react";

import PaymentExcelUploadDialog, {
    type PaymentExcelParseResult,
} from "@/components/payment/shared/PaymentExcelUploadDialog";
import {
    type ExcelUploadColumn,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import {
    createExpensePayment,
    fetchExpenseWithdrawalAccounts,
    parseExpensePaymentExcel,
} from "@/lib/api/expensePayment";
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
 * (`WECMS_DEV/WECMS_STATIC/web/file/excel/VN/WeCMS_Expense_Payment_upload_*.xlsx`)
 * copied verbatim into the Next.js `public/templates/expense-payment/`
 * so the spreadsheet a user downloads in the refactor is byte-identical
 * to the one they get on `dev.wecms.vn`.
 *
 * <p>KM falls back to EN — the JEX side has no KM template either.
 *
 * <p>The Vendor template differs from Internal Transfer by one column:
 * Vendor carries a {@code HAND_TRCO_KEY} (Contact Code) column the
 * legacy {@code pymn_0003_002_r001} parser reads at index 7 to validate
 * the recipient against the tenant's Contacts master. Internal Transfer
 * has no such column.
 */
const TEMPLATE_URL: Record<Locale, string> = {
    EN: "/templates/expense-payment/WeCMS_Expense_Payment_upload_EN.xlsx",
    KO: "/templates/expense-payment/WeCMS_Expense_Payment_upload_KO.xlsx",
    VI: "/templates/expense-payment/WeCMS_Expense_Payment_upload_VI.xlsx",
};

const DEFAULT_TRNF_CCY_CD = "VND";

const ACCT_TYPE_LABEL: Record<string, string> = {
    "03": "Current",
    "04": "Current",
    "05": "Savings",
    "06": "Savings",
    "07": "Current",
    "08": "Savings",
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
    onSaved?: (scdulPymnNo: string) => void;
};

/**
 * Payment > Expense Payment — Excel-upload dialog (legacy
 * `pymn_0003_002`). Thin wrapper over the shared
 * {@link PaymentExcelUploadDialog} — Vendor mirrors Internal Transfer's
 * upload shape because both modules share the same physical
 * `SCDUL_PYMN_SUMR` table and the same Excel template format. The
 * only difference is the backend endpoints (`/expense-payment/...`)
 * and the i18n key prefix.
 */
export default function ExpensePaymentUploadDialog({ onClose, onSaved }: Props) {
    const { t, locale } = useTranslation();

    const [accounts, setAccounts] = useState<ApiWithdrawalAccountRow[]>([]);
    const [selectedKey, setSelectedKey] = useState<string>("");
    const [parsedLines, setParsedLines] = useState<ApiParsedTransferLine[]>([]);

    useEffect(() => {
        let cancelled = false;
        fetchExpenseWithdrawalAccounts()
            .then((list) => {
                if (cancelled) return;
                setAccounts(list);
                if (list.length > 0) setSelectedKey(accountKey(list[0]));
            })
            .catch(() => {
                // Silent — picker shows the empty-state label and Save
                // stays disabled via `!selectedAccount` below.
            });
        return () => { cancelled = true; };
    }, []);
    const selectedAccount = accounts.find((a) => accountKey(a) === selectedKey);

    function handleDownloadTemplate() {
        const url = TEMPLATE_URL[locale] ?? TEMPLATE_URL.EN;
        const a = document.createElement("a");
        a.href = url;
        a.download = url.split("/").pop() ?? "WeCMS_Expense_Payment_upload.xlsx";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    // 10 columns matching legacy `pymn_0003_002_view.jsp` order. The
    // extra column over Internal Transfer is `HAND_TRCO_KEY` (Contact
    // Key) — Vendor validates each line's recipient against the
    // tenant's Contacts master (`TRCO_INFM`) before accepting the
    // batch (legacy `PymnHelper.uploadPaymentExcel` lines 1386-1421).
    // Phase 1 backend reuses the Internal Transfer parser which does
    // not populate `HAND_TRCO_KEY` — the column renders empty until
    // a Vendor-specific parser ships.
    const columns: ExcelUploadColumn[] = [
        { id: "ANT_DIV_CD",    label: t("internal_transfer.upload.col.bank_code"),         required: true, widthPx: 160 },
        { id: "FINC_MDA_NO",   label: t("internal_transfer.upload.col.deposit_no"),        required: true, widthPx: 160 },
        { id: "TAR_BANK_NM",   label: t("internal_transfer.upload.col.bank"),                              widthPx: 160 },
        { id: "TRAN_AMT",      label: t("internal_transfer.upload.col.transfer_amount"),   required: true, widthPx: 160, align: "right" },
        { id: "TRNF_CCY_CD",   label: t("internal_transfer.upload.col.transfer_currency"), required: true, widthPx: 160 },
        { id: "TRAN_USAG",     label: t("internal_transfer.upload.col.remarks"),                           widthPx: 160 },
        { id: "CHART_ACCT_CD", label: t("internal_transfer.upload.col.reporting_account"),                 widthPx: 180 },
        { id: "HAND_TRCO_KEY", label: t("expense_payment.upload.col.contact_code"),                         widthPx: 150 },
        { id: "NOTE",          label: t("internal_transfer.upload.col.description"),                       widthPx: 150 },
        { id: "DOC_NO",        label: t("internal_transfer.upload.col.document_no"),                       widthPx: 150 },
    ];

    async function handleParse(file: File): Promise<PaymentExcelParseResult> {
        const bankCd = selectedAccount?.bank_cd ?? accounts[0]?.bank_cd ?? "";
        const response = await parseExpensePaymentExcel(file, bankCd);
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
        void parsed;
        if (!selectedAccount) {
            throw new Error("Withdrawal account is required.");
        }
        const successLines = parsedLines.filter(
            (l) => !l.err_fld || l.err_fld.length === 0,
        );
        const lines: ApiTransferLineInput[] = successLines.map(parsedToWire);
        const titl = file.name.replace(/\.[^/.]+$/, "");
        // Batch `ccy_cd` is the TRANSFER currency from the Excel rows,
        // not the withdrawal account's currency. Same fix that landed in
        // InternalTransferUploadDialog + VendorPaymentUploadDialog.
        const batchCcyCd =
            successLines[0]?.trnf_ccy_cd
            ?? selectedAccount.ccy_cd
            ?? DEFAULT_TRNF_CCY_CD;
        const request: ApiCreateScheduledTransferRequest = {
            titl,
            bank_cd:     selectedAccount.bank_cd,
            acct_no:     selectedAccount.acct_no,
            ccy_cd:      batchCcyCd,
            trnf_ccy_cd: batchCcyCd,
            lines,
        };
        return await createExpensePayment(file, request);
    }

    return (
        <PaymentExcelUploadDialog
            onClose={onClose}
            onSaved={(result) => {
                const created = result as { scdul_pymn_no: string } | undefined;
                if (created?.scdul_pymn_no) onSaved?.(created.scdul_pymn_no);
            }}
            strings={{
                // Vendor-specific dialog title + success message; the
                // remaining chrome (Step 1/2 labels, Re-Select, etc.)
                // is identical to Internal Transfer's, so we share
                // those keys to avoid translation duplication.
                title:              t("expense_payment.upload.title"),
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
                successDescription: t("expense_payment.dialog.save_success"),
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
 *  Wire-row mappers — mirror Internal Transfer's adapters byte-for-byte.
 * -------------------------------------------------------------------------- */

function toUploadRow(line: ApiParsedTransferLine, index: number): ExcelUploadRow {
    const fields = (line.err_fld ?? "")
        .split("|").map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0);
    const causes = (line.err_fld_caus ?? "")
        .split("|").map((s) => s.trim()).filter((s) => s.length > 0);
    const causeByField = new Map<string, string>();
    fields.forEach((id, i) => {
        if (!causeByField.has(id)) causeByField.set(id, causes[i] ?? "");
    });
    const cell = (fieldId: string, value: string | null) => ({
        value,
        error: causeByField.has(fieldId),
        errorMessage: causeByField.get(fieldId) || undefined,
    });
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
            HAND_TRCO_KEY: cell("HAND_TRCO_KEY", line.hand_trco_key),
            NOTE:          cell("NOTE",          line.note),
            DOC_NO:        cell("DOC_NO",        line.doc_no),
        },
    };
}

function parsedToWire(line: ApiParsedTransferLine): ApiTransferLineInput {
    return {
        finc_mda_no:       line.finc_mda_no ?? "",
        ant_div_cd:        line.ant_div_cd ?? null,
        // RCPT_NM — CITAD branch cross-fills this from
        // TRCO_ACCT_INFO.FINC_MDA_OWNER_NM during parse (NAPAS branch
        // resolves it via the external bank API). Without forwarding
        // it back on the save request, SCDUL_PYMN_SUMR_DETL.rcpt_nm is
        // null and the detail tables render "—".
        rcpt_nm:           line.rcpt_nm ?? null,
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
 *  Withdrawal-account chip dropdown — same shape as Internal Transfer.
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
