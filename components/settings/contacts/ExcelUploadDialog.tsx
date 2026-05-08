"use client";

import { useState } from "react";

import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import { useTranslation } from "@/lib/i18n";

import type { ContactLocation } from "./types";

type ExcelUploadDialogProps = {
    onClose: () => void;
};

/**
 * Static-UI mock preview rows — Figma 9194:11192. Two rows: the first
 * is fully valid; the second has an invalid Contact Code ("C00 001" —
 * spaces are not allowed) which paints the cell red and surfaces the
 * "Contact Code is invalid" tooltip on hover. Cells are keyed by
 * column id so the shared dialog can render them dynamically.
 */
const PREVIEW_ROWS: ExcelUploadRow[] = [
    {
        id: "row-1",
        cells: {
            code: { value: "C0001" },
            name: { value: "CÔNG TY TNHH WEBCASH VIỆT NAM" },
            tax_id: { value: "1201496252" },
            bank: { value: "Vietcom" },
            account_no: { value: "123456789012" },
            currency: { value: "VND" },
            recipient: { value: "NGUYEN VAN" },
            current_address: {
                value: "LK08-13, Khu phố 3, Phường 6, Thành phố Mỹ Tho, Tỉnh Tiền Giang, Việt Nam",
            },
            old_address: {
                value: "Khu phố 3, Phường 3, Thành phố Mỹ Tho, Tỉnh Tiền Giang, Việt Nam",
            },
            valid_date: { value: "31-08-2022" },
        },
    },
    {
        id: "row-2",
        cells: {
            // Invalid: Contact Code with embedded space. The tooltip
            // surfaces on hover via the shared cell's `title` attribute.
            code: {
                value: "C00 001",
                error: true,
                errorMessage: "Contact Code is invalid",
            },
            name: { value: "CÔNG TY TNHH WEBCASH" },
            tax_id: { value: "0201496352-001" },
            bank: { value: "Vietcom" },
            account_no: { value: "123456789012" },
            currency: { value: "USD" },
            recipient: { value: null },
            current_address: {
                value: "LK08-13, Khu phố 3, Phường 6, Thành phố Mỹ Tho, Tỉnh Tiền Giang, Việt Nam",
            },
            old_address: { value: null },
            valid_date: { value: null },
        },
    },
];

const COMPLETED_COUNT = 1;
const ERROR_COUNT = 1;

/**
 * Contacts Excel Upload dialog — Figma 9194:11192.
 *
 * Thin wrapper around the shared `<ExcelUploadDialog>` (CLAUDE.md §3a
 * "Excel Upload preview modals — shared shell"). This file only
 * carries Contacts-specific configuration:
 *   - Local vs Overseas radio block fed through the shared
 *     `selectStep` prop (the new extension lands here first; Chart
 *     of Accounts continues without it).
 *   - 10-column preview table covering Contact Code / Contact Name /
 *     Tax ID / Deposit Bank / Deposit Account No. / Currency /
 *     Recipient / Current Address / Old Address / Valid Date.
 *   - Mock preview rows (one valid + one invalid) mirroring the
 *     Figma frame.
 *   - Translation keys for every visible string.
 *
 * Other Settings submenus that need an Excel import flow MUST follow
 * the same wrapper pattern: build a per-feature config and pass it to
 * `<SharedExcelUploadDialog>`. Do NOT fork the shared shell.
 */
export default function ExcelUploadDialog({ onClose }: ExcelUploadDialogProps) {
    const { t } = useTranslation();

    // Local UI state — Local vs Overseas variant. Defaults to "local"
    // per Figma. Static UI only: switching variants does not currently
    // re-fetch / re-validate the preview rows.
    const [variant, setVariant] = useState<ContactLocation>("local");

    /**
     * Column config — translated labels with Figma-spec'd widths.
     * Total width ~1660px exceeds the panel; the shared shell
     * engages horizontal scroll at the body / header / footer
     * tables in lockstep. Must be built inside the component so
     * labels re-resolve when the locale changes.
     */
    const columns: ExcelUploadColumn[] = [
        {
            id: "code",
            label: t("settings.contacts.upload.col.contact_code"),
            required: true,
            widthPx: 130,
        },
        {
            id: "name",
            label: t("settings.contacts.upload.col.contact_name"),
            required: true,
            widthPx: 240,
        },
        {
            id: "tax_id",
            label: t("settings.contacts.upload.col.tax_id"),
            widthPx: 140,
        },
        {
            id: "bank",
            label: t("settings.contacts.upload.col.deposit_bank"),
            required: true,
            widthPx: 140,
        },
        {
            id: "account_no",
            label: t("settings.contacts.upload.col.deposit_account_no"),
            required: true,
            widthPx: 180,
        },
        {
            id: "currency",
            label: t("settings.contacts.upload.col.currency"),
            required: true,
            widthPx: 110,
        },
        {
            id: "recipient",
            label: t("settings.contacts.upload.col.recipient"),
            widthPx: 140,
        },
        {
            id: "current_address",
            label: t("settings.contacts.upload.col.current_address"),
            widthPx: 280,
        },
        {
            id: "old_address",
            label: t("settings.contacts.upload.col.old_address"),
            widthPx: 220,
        },
        {
            id: "valid_date",
            label: t("settings.contacts.upload.col.valid_date"),
            widthPx: 120,
        },
    ];

    return (
        <SharedExcelUploadDialog
            onClose={onClose}
            title={t("settings.contacts.upload.title")}
            // Step 1 — Local vs Overseas radio. Drives the badge
            // renumbering inside the shared shell (Download → 2,
            // Browse → 3) automatically.
            selectStep={{
                title: t("settings.contacts.upload.select_option_title"),
                description: t(
                    "settings.contacts.upload.select_option_description",
                ),
                options: [
                    {
                        value: "local",
                        label: t("settings.contacts.upload.option.local"),
                    },
                    {
                        value: "overseas",
                        label: t("settings.contacts.upload.option.overseas"),
                    },
                ],
                selectedValue: variant,
                onChange: (v) => setVariant(v as ContactLocation),
            }}
            step1Title={t("settings.contacts.upload.step_download_title")}
            step1Description={t(
                "settings.contacts.upload.step_download_description",
            )}
            downloadLabel={t("settings.contacts.upload.download")}
            step2Title={t("settings.contacts.upload.step_browse_title")}
            step2Description={t(
                "settings.contacts.upload.step_browse_description",
            )}
            fileName={t("settings.contacts.upload.filename")}
            reSelectLabel={t("settings.contacts.upload.re_select")}
            completedLabel={t("settings.contacts.upload.completed")}
            completedCount={COMPLETED_COUNT}
            errorLabel={t("settings.contacts.upload.error")}
            errorCount={ERROR_COUNT}
            columns={columns}
            rows={PREVIEW_ROWS}
            totalLabel={t("settings.contacts.upload.total_contacts", {
                count: PREVIEW_ROWS.length,
            })}
            closeLabel={t("settings.contacts.upload.close")}
            uploadLabel={t("settings.contacts.upload.upload")}
            // Static-UI: Upload stays disabled until validation wiring
            // lands. The shared dialog defaults to disabled.
            uploadDisabled
        />
    );
}
