"use client";

import { useEffect, useRef, useState } from "react";

import PaymentExcelUploadDialog, {
    type PaymentExcelParseResult,
} from "@/components/payment/shared/PaymentExcelUploadDialog";
import { type ExcelUploadColumn } from "@/components/shared/excel-upload/ExcelUploadDialog";

import {
    fetchOverseasWithdrawalAccounts,
    previewOverseasPaymentExcel,
    submitOverseasPaymentExcel,
    type ApiOverseasPaymentExcelPreview,
} from "@/lib/api/payment";
import { useTranslation } from "@/lib/i18n";
import type { ApiWithdrawalAccountRow } from "@/lib/types/api";
import WithdrawalAccountDropdown, {
    getWithdrawalAccountKey,
} from "@/components/payment/shared/WithdrawalAccountDropdown";

/**
 * Maps a backend per-cell error `field` id (OverseasPaymentExcelFieldError)
 * to the matching preview column id. The backend names the beneficiary detail
 * fields `bnfcNm` / `bicCode` / etc.; the preview columns use the longer Figma
 * labels (beneficiaryName / bic / ...).
 */
const ERROR_FIELD_TO_COLUMN: Record<string, string> = {
    currency:         "currency",
    amount:           "amount",
    feePayer:         "feePayer",
    beneficiaryCode:  "beneficiaryCode",
    memo:             "memo",
    reportingAccount: "reportingAccount",
    bnfcNm:           "beneficiaryName",
    bnfcBankNm:       "beneficiaryBankName",
    bicCode:          "bic",
    bnfcAcctNo:       "beneficiaryAccountNo",
    bnfcAddr:         "beneficiaryAddress",
};

export default function OverseasExcelUploadModal({
    onClose,
    onSaved,
}: {
    onClose: () => void;
    onSaved?: () => void;
}) {
    const { t, locale } = useTranslation();

    const [accounts, setAccounts] = useState<ApiWithdrawalAccountRow[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    // Currency of the parsed file — drives the withdrawal-account currency filter
    // (legacy comm_1001_001 is called with the file's CCY_CD). null = all accounts
    // (initial mount, before a file is parsed).
    const [detectedCcy, setDetectedCcy] = useState<string | null>(null);
    // Last backend preview — kept so the upload step builds its detail rows from
    // the server-resolved beneficiary data (not a second client-side lookup).
    const lastPreviewRef = useRef<ApiOverseasPaymentExcelPreview | null>(null);

    // Load (and re-filter on currency change) the withdrawal accounts. Keeps the
    // current selection when it is still valid for the new currency, otherwise
    // auto-selects the first account.
    useEffect(() => {
        let cancelled = false;
        fetchOverseasWithdrawalAccounts(detectedCcy ?? undefined)
            .then((list) => {
                if (cancelled) return;
                setAccounts(list);
                setSelectedAccount((prev) => {
                    const stillValid =
                        prev && list.some((a) => getWithdrawalAccountKey(a) === prev);
                    if (stillValid) return prev;
                    return list.length > 0 ? getWithdrawalAccountKey(list[0]) : "";
                });
            })
            .catch(() => { /* silently degrade — dropdown stays empty */ });
        return () => { cancelled = true; };
    }, [detectedCcy]);

    // Columns specifically required for Overseas Batch Payments matching legacy pymn_0007_001
    const columns: ExcelUploadColumn[] = [
        { id: "currency", label: t("payment.overseas.col.transfer_currency"), widthPx: 120, required: true },
        { id: "amount", label: t("payment.overseas.col.transfer_amount"), widthPx: 120, align: "right", required: true },
        { id: "feePayer", label: t("payment.overseas.col.fee_payer"), widthPx: 120, required: true },
        { id: "beneficiaryCode", label: t("payment.overseas.col.beneficiary_code"), widthPx: 150, required: true },
        { id: "beneficiaryName", label: t("payment.overseas.col.beneficiary_name"), widthPx: 150, required: true },
        { id: "beneficiaryBankName", label: t("payment.overseas.col.beneficiary_bank_name"), widthPx: 180, required: true },
        { id: "bic", label: t("payment.overseas.col.bic"), widthPx: 180, required: true },
        { id: "beneficiaryAccountNo", label: t("payment.overseas.col.beneficiary_account_no"), widthPx: 180, required: true },
        { id: "beneficiaryAddress", label: t("payment.overseas.col.beneficiary_address"), widthPx: 200, required: true },
        { id: "memo", label: t("payment.overseas.col.memo"), widthPx: 150, required: true },
        { id: "reportingAccount", label: t("payment.overseas.col.reporting_account"), widthPx: 150 },
    ];

    const handleDownloadTemplate = () => {
        const url = `/templates/overseas-payment/WeCMS_Overseas_Payment_upload_${locale}.xlsx`;
        const link = document.createElement("a");
        link.href = url;
        link.download = `WeCMS_Overseas_Payment_upload_${locale}.xlsx`;
        link.click();
    };

    /**
     * Parse + validate through the backend `/excel-preview` endpoint. The server
     * owns every legacy validation rule (header titles, currency 3-char +
     * single-currency, amount > 0, fee-payer code, memo length, special chars,
     * beneficiary resolution, reporting-account lookup, max-rows). The selected
     * withdrawal bank code drives the bank-specific special-character rules.
     */
    const handleParse = async (file: File): Promise<PaymentExcelParseResult> => {
        const bankCd = selectedAccount ? selectedAccount.split("|")[0] : undefined;
        const preview = await previewOverseasPaymentExcel(file, bankCd);
        lastPreviewRef.current = preview;

        // Drive the withdrawal-account currency filter from the file currency
        // (single-currency only — a mixed-currency file is flagged as an error by
        // the backend and cannot be uploaded).
        const ccyCodes = [
            ...new Set(
                preview.rows.map((r) => (r.currency ?? "").trim().toUpperCase()).filter(Boolean),
            ),
        ];
        if (ccyCodes.length === 1) setDetectedCcy(ccyCodes[0]);

        const rows = preview.rows.map((row) => {
            const errorByColumn = new Map<string, string>();
            for (const err of row.errors ?? []) {
                const colId = ERROR_FIELD_TO_COLUMN[err.field];
                if (colId && !errorByColumn.has(colId)) errorByColumn.set(colId, err.message);
            }
            const cell = (colId: string, value: string) => ({
                value,
                error: errorByColumn.has(colId),
                errorMessage: errorByColumn.get(colId),
            });
            return {
                id: `row-${row.row_index}`,
                cells: {
                    currency:             cell("currency", row.currency),
                    amount:               cell("amount", row.amount),
                    feePayer:             cell("feePayer", row.fee_payer),
                    beneficiaryCode:      cell("beneficiaryCode", row.beneficiary_code),
                    beneficiaryName:      cell("beneficiaryName", row.bnfc_nm ?? ""),
                    beneficiaryBankName:  cell("beneficiaryBankName", row.bnfc_bank_nm ?? ""),
                    bic:                  cell("bic", row.bic_code ?? ""),
                    beneficiaryAccountNo: cell("beneficiaryAccountNo", row.bnfc_acct_no ?? ""),
                    beneficiaryAddress:   cell("beneficiaryAddress", row.bnfc_addr ?? ""),
                    memo:                 cell("memo", row.memo),
                    reportingAccount:     cell("reportingAccount", row.reporting_account ?? ""),
                },
            };
        });

        return {
            rows,
            completedCount: preview.completed_count,
            errorCount: preview.error_count,
        };
    };

    const handleUpload = async (file: File) => {
        const preview = lastPreviewRef.current;
        if (!preview) return;

        const [bankCd, acctNo] = selectedAccount.split("|");
        const acct = accounts.find((a) => a.bank_cd === bankCd && a.acct_no === acctNo);

        // Build detail rows from the server-resolved preview (beneficiary details
        // already cross-filled by the backend) — never a second client-side lookup.
        const detailRows = preview.rows.map((row, idx) => ({
            trn_seq:      idx + 1,
            bnfc_code:    row.beneficiary_code,
            ccy_cd:       (row.currency ?? "").trim(),
            trnf_amt:     parseFloat(String(row.amount ?? "0").replace(/,/g, "")) || 0,
            fee_payer_cd: row.fee_payer,
            memo:         row.memo,
            rprt_acct_cd: row.reporting_account?.trim() ? row.reporting_account.trim() : null,
            bnfc_nm:      row.bnfc_nm ?? "",
            bnfc_bank_nm: row.bnfc_bank_nm ?? "",
            bic_cd:       row.bic_code ?? "",
            bnfc_acct_no: row.bnfc_acct_no ?? "",
            bnfc_addr:    row.bnfc_addr ?? "",
        }));

        const totalTranAmt = detailRows.reduce((sum, r) => sum + r.trnf_amt, 0);

        // Single currency only — the backend blocks mixed-currency uploads, so a
        // valid batch carries exactly one currency. Never send the "MULTI" sentinel.
        const ccyCodes = [...new Set(detailRows.map((r) => r.ccy_cd).filter(Boolean))];
        const ccyCd = ccyCodes[0] ?? "";

        return submitOverseasPaymentExcel({
            file_nm:        file.name,
            ccy_cd:         ccyCd,
            total_tran_amt: totalTranAmt,
            tot_trns_cnt:   detailRows.length,
            wdrl_bank_cd:   bankCd,
            wdrl_bank_nm:   acct?.bank_nm ?? bankCd,
            wdrl_acct_no:   acctNo,
            rows:           detailRows,
        }, file);
    };

    return (
        <PaymentExcelUploadDialog
            onClose={onClose}
            onSaved={onSaved}
            strings={{
                title:              t("payment.internal.excel_upload"),
                step1Title:         t("payment.internal.excel_upload_step1"),
                step1Description:   t("payment.internal.excel_upload_step1_desc"),
                downloadLabel:      t("payment.internal.download_template"),
                step2Title:         t("payment.internal.excel_upload_step2"),
                step2Description:   t("payment.internal.excel_upload_step2_desc"),
                browseLabel:        t("payment.internal.browse"),
                reSelectLabel:      t("payment.internal.re_select"),
                filePlaceholder:    t("payment.internal.filename"),
                completedLabel:     t("payment.internal.excel_completed"),
                errorLabel:         t("payment.internal.excel_error"),
                totalLabelKey:      "payment.internal.excel_total",
                closeLabel:         t("common.close"),
                uploadLabel:        t("common.upload"),
                successDescription: t("internal_transfer.dialog.save_success"),
            }}
            columns={columns}
            onParse={handleParse}
            onUpload={handleUpload}
            onDownload={handleDownloadTemplate}
            // Re-run the preview when the withdrawal account changes so the
            // bank-specific server-side validation re-evaluates (legacy parity).
            reparseSignal={selectedAccount}
            extraStep={{
                title: t("payment.overseas.excel_upload_step3"),
                description: t("payment.overseas.excel_upload_step3_desc"),
                content: (
                    <WithdrawalAccountDropdown
                        accounts={accounts}
                        selectedKey={selectedAccount}
                        onSelect={setSelectedAccount}
                        emptyLabel={t("payment.overseas.select_account")}
                        placeholderLabel={t("payment.overseas.select_account")}
                    />
                 ),
            }}
        />
    );
}
