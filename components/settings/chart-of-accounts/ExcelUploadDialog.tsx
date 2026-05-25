"use client";

import { useState } from "react";

import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import {
    CHART_OF_ACCOUNTS_TEMPLATE_SPEC,
    validateExcelTemplate,
} from "@/components/shared/excel-upload/templateValidator";
import { useDialog } from "@/components/shared/dialog";
import { bulkCreateChartOfAccounts } from "@/lib/api/chartOfAccounts";
import { useTranslation } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/LocaleProvider";

import { useChartOfAccountsExcelUpload } from "./useExcelUpload";

type ExcelUploadDialogProps = {
    onClose: () => void;
    /** Called after the upload batch completes so the panel can refetch
     *  and show the result dialog. */
    onUploadDone?: (created: number, failed: number) => void;
};

/**
 * Per-locale static template URL. Files live in
 * `public/templates/chart-of-accounts/` and are served by Next.js as
 * static assets — same pattern as expense-payment / internal-transfer /
 * contacts templates. The spreadsheet headers match the locale so the
 * upload hook's header-based column resolver finds them automatically.
 */
const TEMPLATE_URL: Record<Locale, string> = {
    EN: "/templates/chart-of-accounts/WeCMS_Chart_of_Accounts_upload_EN.xlsx",
    KO: "/templates/chart-of-accounts/WeCMS_Chart_of_Accounts_upload_KO.xlsx",
    VI: "/templates/chart-of-accounts/WeCMS_Chart_of_Accounts_upload_VI.xlsx",
};

/**
 * Chart of Accounts Excel Upload dialog.
 *
 * Flow:
 *   1. "Download" → serves the locale-matched static template from
 *      `public/templates/chart-of-accounts/`.
 *   2. "Re-Select" → hidden `<input type="file">` opens; user picks
 *      a completed .xlsx/.xls file.
 *   3. `useChartOfAccountsExcelUpload` parses and validates every row,
 *      returning `rows / completedCount / errorCount / isReady`.
 *   4. Preview table shows errors highlighted (red cell + hover tooltip).
 *      Upload button stays disabled while any error exists or no file
 *      is loaded.
 *   5. On Upload each valid row calls `createChartOfAccount`; totals
 *      are forwarded to `onUploadDone` so the panel refetches and shows
 *      a success / partial-failure dialog.
 */
export default function ExcelUploadDialog({
    onClose,
    onUploadDone,
}: ExcelUploadDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();
    const [uploading, setUploading] = useState(false);

    const {
        inputRef,
        loadFile,
        triggerFilePick,
        reset,
        fileName,
        rows,
        completedCount,
        errorCount,
        isReady,
    } = useChartOfAccountsExcelUpload();

    // Template gate — runs BEFORE the hook parses the file so a
    // mismatched template never updates preview rows or the
    // Completed / Error counts. Rejecting clears any prior selection
    // so the chip + Upload button reset to the empty state.
    async function handleFileInputChange(
        e: React.ChangeEvent<HTMLInputElement>,
    ) {
        const file = e.target.files?.[0];
        // Always clear the input value so re-picking the SAME file
        // re-fires `change` (matches the prior hook behaviour).
        e.target.value = "";
        if (!file) return;
        const tplCheck = await validateExcelTemplate(
            file,
            CHART_OF_ACCOUNTS_TEMPLATE_SPEC,
        );
        if (!tplCheck.valid) {
            reset();
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.upload.template_mismatch"),
            });
            return;
        }
        loadFile(file);
    }

    const columns: ExcelUploadColumn[] = [
        {
            id: "code",
            label: t("settings.chart_of_accounts.upload.col.account_code"),
            required: true,
            widthPx: 140,
        },
        {
            id: "name_en",
            label: t("settings.chart_of_accounts.upload.col.name_english"),
            required: true,
            widthPx: 180,
        },
        {
            id: "name_vi",
            label: t("settings.chart_of_accounts.upload.col.name_vietnamese"),
            widthPx: 220,
        },
        {
            id: "name_ko",
            label: t("settings.chart_of_accounts.upload.col.name_korean"),
            widthPx: 220,
        },
        {
            id: "parent",
            label: t("settings.chart_of_accounts.upload.col.parent_account"),
            // PO directive 2026-05-25: parent is required (level 1 is
            // reserved for ACC-01 / ACC-02 / ACC-03; user writes land
            // at level 2 or 3).
            required: true,
            widthPx: 200,
        },
    ];

    function handleDownload() {
        const url = TEMPLATE_URL[locale] ?? TEMPLATE_URL.EN;
        const a = document.createElement("a");
        a.href = url;
        a.download = url.split("/").pop() ?? "WeCMS_Chart_of_Accounts_upload.xlsx";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function handleUpload() {
        if (!isReady || uploading) return;
        setUploading(true);

        try {
            const items = rows
                .filter((row) => !row.cells.code?.error && !row.cells.name_en?.error)
                .map((row) => ({
                    chart_acct_cd:        row.cells.code!.value!,
                    chart_acct_nm_en:     row.cells.name_en!.value!,
                    chart_acct_nm_vn:     row.cells.name_vi?.value ?? null,
                    chart_acct_nm_ko:     row.cells.name_ko?.value ?? null,
                    parent_chart_acct_cd: row.cells.parent?.value ?? null,
                    cal_rule:             null,
                    stts:                 "A" as const,
                }));

            const result = await bulkCreateChartOfAccounts({ items });
            onUploadDone?.(result.created, result.failed);
        } catch {
            // Network / server error before any rows were processed.
            onUploadDone?.(0, rows.length);
        } finally {
            setUploading(false);
        }
    }

    return (
        <>
            {/* Hidden file input — triggered by "Re-Select" button. */}
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileInputChange}
            />

            <SharedExcelUploadDialog
                onClose={onClose}
                title={t("settings.chart_of_accounts.upload.title")}
                /* ── Step 1: Download Template ── */
                step1Title={t("settings.chart_of_accounts.upload.step1_title")}
                step1Description={t(
                    "settings.chart_of_accounts.upload.step1_description",
                )}
                downloadLabel={t("settings.chart_of_accounts.upload.download")}
                onDownload={handleDownload}
                downloadFullWidth
                downloadIcon="excel"
                /* ── Step 2: Browse Excel Form ── */
                step2Title={t("settings.chart_of_accounts.upload.step2_title")}
                step2Description={t(
                    "settings.chart_of_accounts.upload.step2_description",
                )}
                step2DescriptionRequired
                fileName={fileName ?? undefined}
                filePlaceholder={t(
                    "settings.chart_of_accounts.upload.filename",
                )}
                browseLabel={t("settings.chart_of_accounts.upload.browse")}
                reSelectLabel={t("settings.chart_of_accounts.upload.re_select")}
                onReSelect={triggerFilePick}
                /* ── Summary chips ── */
                completedLabel={t("settings.chart_of_accounts.upload.completed")}
                completedCount={completedCount}
                errorLabel={t("settings.chart_of_accounts.upload.error")}
                errorCount={errorCount}
                /* ── Preview table ── */
                columns={columns}
                rows={rows}
                totalLabel={t(
                    "settings.chart_of_accounts.upload.total_transactions",
                    { count: rows.length },
                )}
                /* ── Footer buttons ── */
                closeLabel={t("settings.chart_of_accounts.upload.close")}
                uploadLabel={
                    uploading
                        ? t("settings.chart_of_accounts.upload.uploading")
                        : t("settings.chart_of_accounts.upload.upload")
                }
                onUpload={handleUpload}
                uploadDisabled={!isReady || uploading}
            />
        </>
    );
}
