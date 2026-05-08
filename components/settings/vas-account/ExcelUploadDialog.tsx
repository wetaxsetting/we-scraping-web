"use client";

import { useState } from "react";

import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import { useTranslation } from "@/lib/i18n";

type ExcelUploadDialogProps = {
    onClose: () => void;
};

/**
 * Static-UI mock preview rows — Figma 9194:9502. Three success rows
 * (no error cells) so the Completed / Error counts read 3 / 0 per the
 * Figma frame. Cells are keyed by column id so the shared dialog can
 * render them dynamically.
 */
const PREVIEW_ROWS: ExcelUploadRow[] = [
    {
        id: "row-1",
        cells: {
            code: { value: "511" },
            name: { value: "Doanh thu bán hàng và cung cấp dịch vụ" },
        },
    },
    {
        id: "row-2",
        cells: {
            code: { value: "5112" },
            name: { value: "Doanh thu bán các thành phẩm" },
        },
    },
    {
        id: "row-3",
        cells: {
            code: { value: "521" },
            name: { value: "Các khoản giảm trừ doanh thu" },
        },
    },
];

const COMPLETED_COUNT = 3;
const ERROR_COUNT = 0;

type UploadOption = "add_new" | "reset_replace";

/**
 * VAS Account Excel Upload dialog — Figma 9194:9409.
 *
 * Thin wrapper around the shared `<ExcelUploadDialog>` (CLAUDE.md
 * §3a "Excel Upload preview modals — shared shell"). Carries only
 * VAS-Account-specific configuration:
 *   - Column definitions (2 columns: VAS Code, VAS Account Name).
 *   - Mock preview rows (3 success rows).
 *   - Choose Upload Options radio block (Add new vs Reset/replace) —
 *     consumed via the shared dialog's `optionsStep` prop, the new
 *     "post-Browse decision block" extension landed in this MR.
 *   - Translation keys for every visible string.
 */
export default function ExcelUploadDialog({
    onClose,
}: ExcelUploadDialogProps) {
    const { t } = useTranslation();
    const [uploadOption, setUploadOption] =
        useState<UploadOption>("add_new");

    /**
     * Column config — translated labels, pixel widths sized to fit
     * the ~800 px preview area inside the 1120 px modal cap so NO
     * horizontal scrollbar appears (only 2 columns, plenty of room).
     * Total 200 + 580 = 780 px stays comfortably below the ~800 px
     * panel width; the shared shell's `table-fixed` + `w-full` table
     * then proportionally distributes any small remainder so the
     * columns visually fill the preview without overflow. Must be
     * built inside the component so labels re-resolve when the locale
     * changes.
     */
    const columns: ExcelUploadColumn[] = [
        {
            id: "code",
            label: t("settings.vas_account.upload.col.code"),
            widthPx: 200,
        },
        {
            id: "name",
            label: t("settings.vas_account.upload.col.name"),
            widthPx: 580,
        },
    ];

    return (
        <SharedExcelUploadDialog
            onClose={onClose}
            title={t("settings.vas_account.upload.title")}
            step1Title={t("settings.vas_account.upload.step1_title")}
            step1Description={t(
                "settings.vas_account.upload.step1_description",
            )}
            downloadLabel={t("settings.vas_account.upload.download")}
            step2Title={t("settings.vas_account.upload.step2_title")}
            step2Description={t(
                "settings.vas_account.upload.step2_description",
            )}
            step2DescriptionRequired
            fileName={t("settings.vas_account.upload.filename")}
            reSelectLabel={t("settings.vas_account.upload.browse")}
            optionsStep={{
                title: t("settings.vas_account.upload.options.title"),
                selectedValue: uploadOption,
                onChange: (value) => setUploadOption(value as UploadOption),
                options: [
                    {
                        value: "add_new",
                        label: t(
                            "settings.vas_account.upload.options.add_new.label",
                        ),
                        description: t(
                            "settings.vas_account.upload.options.add_new.description",
                        ),
                    },
                    {
                        value: "reset_replace",
                        label: t(
                            "settings.vas_account.upload.options.reset_replace.label",
                        ),
                        description: t(
                            "settings.vas_account.upload.options.reset_replace.description",
                        ),
                    },
                ],
            }}
            completedLabel={t("settings.vas_account.upload.completed")}
            completedCount={COMPLETED_COUNT}
            errorLabel={t("settings.vas_account.upload.error")}
            errorCount={ERROR_COUNT}
            columns={columns}
            rows={PREVIEW_ROWS}
            totalLabel={t(
                "settings.vas_account.upload.total_transactions",
                { count: PREVIEW_ROWS.length },
            )}
            closeLabel={t("settings.vas_account.upload.cancel")}
            uploadLabel={t("settings.vas_account.upload.upload")}
            // Figma 9194:9642 shows the Upload button in brand-blue
            // (enabled) — no per-row errors in the mock preview, so
            // the Upload action is allowed. Override the shared
            // dialog's default `uploadDisabled=true`.
            uploadDisabled={false}
        />
    );
}
