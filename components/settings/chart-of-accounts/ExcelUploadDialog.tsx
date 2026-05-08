"use client";

import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import { useTranslation } from "@/lib/i18n";

type ExcelUploadDialogProps = {
    onClose: () => void;
};

/**
 * Static-UI mock preview rows — Figma 9196:14185. Five red error
 * cells total. Cells are keyed by column id so the shared dialog can
 * render them dynamically.
 */
const PREVIEW_ROWS: ExcelUploadRow[] = [
    {
        id: "row-1",
        cells: {
            code: { value: "120033111" },
            name_en: { value: "Payment" },
            name_vi: { value: "Payment" },
            name_ko: { value: "Payment" },
            parent: { value: "" },
        },
    },
    {
        id: "row-2",
        cells: {
            code: { value: "000331111123123", error: true },
            name_en: { value: "Payment K1 (BLU)" },
            name_vi: { value: "Payment K1 (BLU)" },
            name_ko: { value: "Payment K1 (BLU)" },
            parent: { value: "" },
        },
    },
    {
        id: "row-3",
        cells: {
            code: { value: "00033111" },
            name_en: { value: "Payment K3 (LGP)", error: true },
            name_vi: { value: "Payment K1 (LGP)" },
            name_ko: { value: "Payment K1 (LGP)" },
            parent: { value: "" },
        },
    },
    {
        id: "row-4",
        cells: {
            code: { value: null, error: true },
            name_en: { value: "Payment K1 (LGP)" },
            name_vi: { value: "Payment K1 (LGP)" },
            name_ko: { value: "Payment K1 (LGP)" },
            parent: { value: "" },
        },
    },
    {
        id: "row-5",
        cells: {
            code: { value: "00033111", error: true },
            name_en: { value: "Payment K2(LGP)" },
            name_vi: { value: "Payment K1 (LGP)" },
            name_ko: { value: "Payment K1 (LGP)" },
            parent: { value: "" },
        },
    },
    {
        id: "row-6",
        cells: {
            code: { value: "4103311122" },
            name_en: { value: null, error: true },
            name_vi: { value: "Payment K1 (LGP)" },
            name_ko: { value: "Payment K1 (LGP)" },
            parent: { value: "" },
        },
    },
];

const COMPLETED_COUNT = 0;
const ERROR_COUNT = 5;

/**
 * Chart of Accounts Excel Upload dialog — Figma 9196:14117.
 *
 * Thin wrapper around the shared `<ExcelUploadDialog>` (CLAUDE.md
 * §3a "Excel Upload preview modals — shared shell"). This file only
 * carries Chart-of-Accounts-specific configuration:
 *   - Column definitions (5 columns: Code, EN, VI, KO, Parent).
 *   - Mock preview rows + error cells (mirrors the Figma frame).
 *   - Translation keys for every visible string.
 *
 * Other Settings submenus that need an Excel import flow MUST follow
 * the same wrapper pattern: build a per-feature `columns` + `rows`
 * config and pass them to `<SharedExcelUploadDialog>`. Do NOT fork
 * the shared shell.
 */
export default function ExcelUploadDialog({ onClose }: ExcelUploadDialogProps) {
    const { t } = useTranslation();

    /**
     * Column config — translated labels, pixel widths sized for
     * comfortable header / value spacing on the three longest
     * columns. Vietnamese, Korean, and Parent Account get extra
     * room because their headers and values run longest. Total
     * 140 + 180 + 220 + 220 + 200 = 960 px exceeds the preview
     * content area inside the 1120 px modal cap, so the shared
     * shell engages horizontal scroll — same scroll mechanism that
     * already works for header / body / footer in lockstep. Must
     * be built inside the component so labels re-resolve when the
     * locale changes.
     */
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
            widthPx: 200,
        },
    ];

    return (
        <SharedExcelUploadDialog
            onClose={onClose}
            title={t("settings.chart_of_accounts.upload.title")}
            step1Title={t("settings.chart_of_accounts.upload.step1_title")}
            step1Description={t(
                "settings.chart_of_accounts.upload.step1_description",
            )}
            downloadLabel={t("settings.chart_of_accounts.upload.download")}
            step2Title={t("settings.chart_of_accounts.upload.step2_title")}
            step2Description={t(
                "settings.chart_of_accounts.upload.step2_description",
            )}
            step2DescriptionRequired
            fileName={t("settings.chart_of_accounts.upload.filename")}
            reSelectLabel={t("settings.chart_of_accounts.upload.re_select")}
            completedLabel={t("settings.chart_of_accounts.upload.completed")}
            completedCount={COMPLETED_COUNT}
            errorLabel={t("settings.chart_of_accounts.upload.error")}
            errorCount={ERROR_COUNT}
            columns={columns}
            rows={PREVIEW_ROWS}
            totalLabel={t(
                "settings.chart_of_accounts.upload.total_transactions",
                { count: PREVIEW_ROWS.length },
            )}
            closeLabel={t("settings.chart_of_accounts.upload.close")}
            uploadLabel={t("settings.chart_of_accounts.upload.upload")}
            // Static-UI: Upload button stays disabled until validation
            // wiring lands. The shared dialog defaults to disabled.
            uploadDisabled
        />
    );
}
