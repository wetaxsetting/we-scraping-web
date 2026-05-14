"use client";

import { useEffect, useState } from "react";

import PaymentExcelUploadDialog, {
    type PaymentExcelParseResult,
} from "@/components/payment/shared/PaymentExcelUploadDialog";
import { type ExcelUploadColumn } from "@/components/shared/excel-upload/ExcelUploadDialog";
import { fetchContacts } from "@/lib/api/contacts";
import { fetchOverseasWithdrawalAccounts } from "@/lib/api/payment";
import { useTranslation } from "@/lib/i18n";
import type { ApiWithdrawalAccountRow } from "@/lib/types/api";

/** Maps ACCT_TYPE_CD to the display label used in pymn_0007_003.ts. */
function acctTypeLabel(cd: string): string {
    return cd === "05" || cd === "06" || cd === "08" ? "Savings" : "Current";
}

/** Formats a withdrawal account for the dropdown: "Woori VN 100912150384 (Current USD)". */
function formatAccount(a: ApiWithdrawalAccountRow): string {
    return `${a.bank_nm} ${a.acct_no} (${acctTypeLabel(a.acct_type_cd)} ${a.ccy_cd})`;
}

/** Overseas contact row shape from the contacts list API. */
interface OverseasContact {
    hand_trco_key: string;
    trco_cmnm: string;
    overseas_beneficiaries?: {
        bene_name?: string;
        bene_bank_name?: string;
        bic_code?: string;
        bene_acct_no?: string;
        bene_addr?: string;
    }[];
}

export default function OverseasExcelUploadModal({ onClose }: { onClose: () => void }) {
    const { t, locale } = useTranslation();

    const [accounts, setAccounts] = useState<ApiWithdrawalAccountRow[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [contacts, setContacts] = useState<OverseasContact[]>([]);

    useEffect(() => {
        let cancelled = false;
        fetchOverseasWithdrawalAccounts()
            .then((list) => {
                if (cancelled) return;
                setAccounts(list);
                if (list.length > 0) setSelectedAccount(`${list[0].bank_cd}_${list[0].acct_no}`);
            })
            .catch(() => { /* silently degrade — dropdown stays empty */ });

        // Fetch overseas contacts from wecms-api-main for beneficiary resolution
        fetchContacts({ trcoType: "O", size: 100 })
            .then((res) => {
                if (cancelled) return;
                setContacts((res.rows ?? []) as unknown as OverseasContact[]);
            })
            .catch((err) => {
                console.error("Failed to fetch contacts for beneficiary resolution", err);
            });

        return () => { cancelled = true; };
    }, []);

    // Columns specifically required for Overseas Batch Payments matching legacy pymn_0007_001
    const columns: ExcelUploadColumn[] = [
        { id: "currency", label: t("payment.overseas.col.transfer_currency", "Transfer Currency"), widthPx: 120, required: true },
        { id: "amount", label: t("payment.overseas.col.transfer_amount", "Transfer Amount"), widthPx: 120, align: "right", required: true },
        { id: "feePayer", label: t("payment.overseas.col.fee_payer", "Fee Payer"), widthPx: 120, required: true },
        { id: "beneficiaryCode", label: t("payment.overseas.col.beneficiary_code", "Beneficiary Code"), widthPx: 150, required: true },
        { id: "beneficiaryName", label: t("payment.overseas.col.beneficiary_name", "Beneficiary Name"), widthPx: 150, required: true },
        { id: "beneficiaryBankName", label: t("payment.overseas.col.beneficiary_bank_name", "Beneficiary Bank Name"), widthPx: 180, required: true },
        { id: "bic", label: t("payment.overseas.col.bic", "Bank Identifier Code (BIC)"), widthPx: 180, required: true },
        { id: "beneficiaryAccountNo", label: t("payment.overseas.col.beneficiary_account_no", "Beneficiary Account No."), widthPx: 180, required: true },
        { id: "beneficiaryAddress", label: t("payment.overseas.col.beneficiary_address", "Beneficiary Address"), widthPx: 200, required: true },
        { id: "memo", label: t("payment.overseas.col.memo", "Memo"), widthPx: 150, required: true },
        { id: "reportingAccount", label: t("payment.overseas.col.reporting_account", "Reporting Account"), widthPx: 150 },
    ];

    const handleDownloadTemplate = () => {
        const url = `/templates/overseas-payment/WeCMS_Overseas_Payment_upload_${locale}.xlsx`;
        const link = document.createElement("a");
        link.href = url;
        link.download = `WeCMS_Overseas_Payment_upload_${locale}.xlsx`;
        link.click();
    };

    const handleParse = async (file: File): Promise<PaymentExcelParseResult> => {
        const formData = new FormData();
        formData.append("file", file);
        
        const res = await fetch("/api/v1/payment/overseas-payment/excel-preview", {
            method: "POST",
            body: formData
        });
        
        if (!res.ok) {
            throw new Error("Failed to preview excel");
        }
        
        const data = await res.json();
        
        let errorCount = 0;
        let completedCount = 0;

        const rows = data.rows.map((row: any) => {
            const errorByField = new Map<string, string>();
            for (const err of row.errors) errorByField.set(err.field, err.message);

            // Resolve beneficiary details from contacts fetched from wecms-api-main
            const beneficiaryCode = row.beneficiaryCode || "";
            const contact = contacts.find(c => c.hand_trco_key === beneficiaryCode);
            const ovrs = contact?.overseas_beneficiaries?.[0];

            const beneficiaryName = ovrs?.bene_name || contact?.trco_cmnm || "";
            const beneficiaryBankName = ovrs?.bene_bank_name || "";
            const bic = ovrs?.bic_code || "";
            const beneficiaryAccountNo = ovrs?.bene_acct_no || "";
            const beneficiaryAddress = ovrs?.bene_addr || "";

            const hasError = errorByField.size > 0;
            if (hasError) errorCount++;
            else completedCount++;

            return {
                id: `row-${row.row_index}`,
                cells: {
                    currency: { value: row.currency || "", error: errorByField.has("currency"), errorMessage: errorByField.get("currency") },
                    amount: { value: row.amount || "", error: errorByField.has("amount"), errorMessage: errorByField.get("amount") },
                    feePayer: { value: row.feePayer || "", error: errorByField.has("feePayer"), errorMessage: errorByField.get("feePayer") },
                    beneficiaryCode: { value: beneficiaryCode, error: errorByField.has("beneficiaryCode"), errorMessage: errorByField.get("beneficiaryCode") },
                    beneficiaryName: { value: beneficiaryName, error: !beneficiaryName, errorMessage: !beneficiaryName ? "Contact not found" : undefined },
                    beneficiaryBankName: { value: beneficiaryBankName, error: !beneficiaryBankName, errorMessage: !beneficiaryBankName ? "Contact not found" : undefined },
                    bic: { value: bic, error: !bic, errorMessage: !bic ? "Contact not found" : undefined },
                    beneficiaryAccountNo: { value: beneficiaryAccountNo, error: !beneficiaryAccountNo, errorMessage: !beneficiaryAccountNo ? "Contact not found" : undefined },
                    beneficiaryAddress: { value: beneficiaryAddress, error: !beneficiaryAddress, errorMessage: !beneficiaryAddress ? "Contact not found" : undefined },
                    memo: { value: row.memo || "", error: errorByField.has("memo"), errorMessage: errorByField.get("memo") },
                    reportingAccount: { value: row.reportingAccount || "", error: errorByField.has("reportingAccount"), errorMessage: errorByField.get("reportingAccount") },
                }
            };
        });

        return { rows, completedCount, errorCount };
    };

    const handleUpload = async (file: File, parsed: PaymentExcelParseResult) => {
        // Mock upload action
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { success: true };
    };

    return (
        <PaymentExcelUploadDialog
            onClose={onClose}
            strings={{
                title:              t("payment.internal.excel_upload", "Excel Upload"),
                step1Title:         t("payment.internal.excel_upload_step1", "1 Download Excel Template"),
                step1Description:   t("payment.internal.excel_upload_step1_desc", "Download and fill out an Excel template."),
                downloadLabel:      t("payment.internal.download_template", "Download Template"),
                step2Title:         t("payment.internal.excel_upload_step2", "2 Browse Excel Form"),
                step2Description:   t("payment.internal.excel_upload_step2_desc", "Select Excel template you've completed."),
                reSelectLabel:      t("payment.internal.browse", "Browse"),
                completedLabel:     t("payment.internal.excel_completed", "Completed"),
                errorLabel:         t("payment.internal.excel_error", "Error"),
                totalLabelKey:      "payment.internal.excel_total",
                closeLabel:         t("common.close", "Close"),
                uploadLabel:        t("common.upload", "Upload"),
                successDescription: t("internal_transfer.dialog.save_success", "Successfully uploaded."),
            }}
            columns={columns}
            onParse={handleParse}
            onUpload={handleUpload}
            onDownload={handleDownloadTemplate}
            extraStep={{
                title: t("payment.overseas.excel_upload_step3", "Withdrawal Bank/Account No."),
                description: t("payment.overseas.excel_upload_step3_desc", "Select preferred withdrawal account."),
                content: (
                    <div className="relative">
                        <select
                            className="w-full appearance-none rounded-md border border-black/15 bg-white py-2 pl-3 pr-8 text-wb-13 font-medium text-wb-dark outline-none focus:border-brand"
                            value={selectedAccount}
                            onChange={(e) => setSelectedAccount(e.target.value)}
                        >
                            <option value="" disabled hidden>
                                {t("payment.overseas.select_account", "Select Account")}
                            </option>
                            {accounts.map((a) => {
                                const key = `${a.bank_cd}_${a.acct_no}`;
                                return (
                                    <option key={key} value={key}>
                                        {formatAccount(a)}
                                    </option>
                                );
                            })}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 1L5 5L9 1" stroke="#666666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                ),
            }}
        />
    );
}
