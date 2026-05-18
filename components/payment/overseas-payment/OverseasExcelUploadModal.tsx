"use client";

import { useEffect, useState } from "react";

import PaymentExcelUploadDialog, {
    type PaymentExcelParseResult,
} from "@/components/payment/shared/PaymentExcelUploadDialog";
import { type ExcelUploadColumn } from "@/components/shared/excel-upload/ExcelUploadDialog";
import * as xlsx from "xlsx";

import { fetchContactsByBeneficiaryCodes } from "@/lib/api/contacts";
import {
    fetchOverseasWithdrawalAccounts,
    submitOverseasPaymentExcel,
} from "@/lib/api/payment";
import { useTranslation } from "@/lib/i18n";
import type { ApiContactDetail, ApiWithdrawalAccountRow } from "@/lib/types/api";
import WithdrawalAccountDropdown, {
    getWithdrawalAccountKey,
} from "@/components/payment/shared/WithdrawalAccountDropdown";


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

    useEffect(() => {
        let cancelled = false;
        fetchOverseasWithdrawalAccounts()
            .then((list) => {
                if (cancelled) return;
                setAccounts(list);
                if (list.length > 0) setSelectedAccount(getWithdrawalAccountKey(list[0]));
            })
            .catch(() => { /* silently degrade — dropdown stays empty */ });
        return () => { cancelled = true; };
    }, []);

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

    const handleParse = async (file: File): Promise<PaymentExcelParseResult> => {
        // Parse Excel client-side — no backend call needed.
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // sheet_to_json with header:1 returns each row as a string[].
        // Row index 0-2 = title / spacer / headers → skip (data starts at row 4, index 3).
        const allRows = xlsx.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
        const dataRows = allRows.slice(3).filter((row) =>
            row.some((cell) => String(cell ?? "").trim() !== ""),
        );

        // Column positions in the template (0-based) — 6 columns only.
        // Beneficiary detail fields are NOT in the Excel; they are resolved from the contacts API.
        // 0=beneficiaryCode  1=currency  2=amount  3=feePayer  4=memo  5=reportingAccount
        const cell = (row: string[], col: number) => String(row[col] ?? "").trim();

        // Collect unique beneficiary codes, then resolve contacts in one round-trip.
        // Index 0 = Beneficiary Code
        const uniqueCodes = [
            ...new Set(dataRows.map((row) => cell(row, 0)).filter(Boolean)),
        ];

        const contactList = uniqueCodes.length > 0
            ? await fetchContactsByBeneficiaryCodes(uniqueCodes).catch(() => [] as ApiContactDetail[])
            : [] as ApiContactDetail[];

        const contactMap = new Map<string, ApiContactDetail>(
            contactList.map((c) => [c.hand_trco_key, c]),
        );

        let errorCount = 0;
        let completedCount = 0;

        const rows = dataRows.map((row, idx) => {
            const beneficiaryCode    = cell(row, 0);
            const currency           = cell(row, 1);
            const amount             = cell(row, 2);
            const feePayer           = cell(row, 3);
            const memo               = cell(row, 4);
            const reportingAccount   = cell(row, 5);

            const errorByField = new Map<string, string>();
            if (!currency)        errorByField.set("currency",        t("payment.overseas.error.required"));
            if (!amount)          errorByField.set("amount",          t("payment.overseas.error.required"));
            if (!feePayer)        errorByField.set("feePayer",        t("payment.overseas.error.required"));
            if (!beneficiaryCode) errorByField.set("beneficiaryCode", t("payment.overseas.error.required"));
            if (!memo)            errorByField.set("memo",            t("payment.overseas.error.required"));

            const contact = contactMap.get(beneficiaryCode);
            const ovrs = contact?.overseas_beneficiaries?.[0];

            const beneficiaryName    = ovrs?.bene_name    || contact?.trco_cmnm || "";
            const beneficiaryBankName = ovrs?.bene_bank_name || "";
            const bic                = ovrs?.bic_code     || "";
            const beneficiaryAccountNo = ovrs?.bene_acct_no || "";
            const beneficiaryAddress  = ovrs?.bene_addr   || "";

            const hasError = errorByField.size > 0 || !beneficiaryName;
            if (hasError) errorCount++; else completedCount++;

            return {
                id: `row-${idx + 4}`,
                cells: {
                    currency:            { value: currency,            error: errorByField.has("currency"),            errorMessage: errorByField.get("currency") },
                    amount:              { value: amount,              error: errorByField.has("amount"),              errorMessage: errorByField.get("amount") },
                    feePayer:            { value: feePayer,            error: errorByField.has("feePayer"),            errorMessage: errorByField.get("feePayer") },
                    beneficiaryCode:     { value: beneficiaryCode,     error: errorByField.has("beneficiaryCode"),     errorMessage: errorByField.get("beneficiaryCode") },
                    beneficiaryName:     { value: beneficiaryName,     error: !beneficiaryName,                        errorMessage: !beneficiaryName ? t("payment.overseas.error.contact_not_found") : undefined },
                    beneficiaryBankName: { value: beneficiaryBankName, error: !beneficiaryBankName,                    errorMessage: !beneficiaryBankName ? t("payment.overseas.error.contact_not_found") : undefined },
                    bic:                 { value: bic,                 error: !bic,                                    errorMessage: !bic ? t("payment.overseas.error.contact_not_found") : undefined },
                    beneficiaryAccountNo:{ value: beneficiaryAccountNo,error: !beneficiaryAccountNo,                   errorMessage: !beneficiaryAccountNo ? t("payment.overseas.error.contact_not_found") : undefined },
                    beneficiaryAddress:  { value: beneficiaryAddress,  error: !beneficiaryAddress,                     errorMessage: !beneficiaryAddress ? t("payment.overseas.error.contact_not_found") : undefined },
                    memo:                { value: memo,                error: errorByField.has("memo"),                errorMessage: errorByField.get("memo") },
                    reportingAccount:    { value: reportingAccount,    error: false,                                   errorMessage: undefined },
                },
            };
        });

        return { rows, completedCount, errorCount };
    };

    const handleUpload = async (file: File, parsed: PaymentExcelParseResult) => {
        const [bankCd, acctNo] = selectedAccount.split("|");
        const acct = accounts.find((a) => a.bank_cd === bankCd && a.acct_no === acctNo);

        const totalTranAmt = parsed.rows.reduce((sum, row) => {
            const v = parseFloat(String(row.cells.amount?.value ?? "").replace(/,/g, ""));
            return sum + (isNaN(v) ? 0 : v);
        }, 0);

        const ccyCodes = [...new Set(
            parsed.rows.map((r) => String(r.cells.currency?.value ?? "").trim()).filter(Boolean),
        )];
        const ccyCd = ccyCodes.length === 1 ? ccyCodes[0] : "MULTI";

        const detailRows = parsed.rows.map((row, idx) => ({
            trn_seq:      idx + 1,
            bnfc_code:    String(row.cells.beneficiaryCode?.value    ?? ""),
            ccy_cd:       String(row.cells.currency?.value           ?? ""),
            trnf_amt:     parseFloat(String(row.cells.amount?.value  ?? "0").replace(/,/g, "")) || 0,
            fee_payer_cd: String(row.cells.feePayer?.value           ?? ""),
            memo:         String(row.cells.memo?.value               ?? ""),
            rprt_acct_cd: String(row.cells.reportingAccount?.value   ?? "") || null,
            bnfc_nm:      String(row.cells.beneficiaryName?.value    ?? ""),
            bnfc_bank_nm: String(row.cells.beneficiaryBankName?.value ?? ""),
            bic_cd:       String(row.cells.bic?.value                ?? ""),
            bnfc_acct_no: String(row.cells.beneficiaryAccountNo?.value ?? ""),
            bnfc_addr:    String(row.cells.beneficiaryAddress?.value  ?? ""),
        }));

        const res = await submitOverseasPaymentExcel({
            file_nm:        file.name,
            ccy_cd:         ccyCd,
            total_tran_amt: totalTranAmt,
            tot_trns_cnt:   parsed.rows.length,
            wdrl_bank_cd:   bankCd,
            wdrl_bank_nm:   acct?.bank_nm ?? bankCd,
            wdrl_acct_no:   acctNo,
            rows:           detailRows,
        }, file);

        return res;
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
                reSelectLabel:      t("payment.internal.browse"),
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
