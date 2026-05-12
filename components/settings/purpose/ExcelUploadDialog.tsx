"use client";

import { useRef, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    downloadPurposeTemplate,
    importPurposeExcel,
    previewPurposeExcel,
    type ApiPurposeExcelPreview,
    type ApiPurposeExcelPreviewRow,
} from "@/lib/api/purposeSettings";
import { useTranslation } from "@/lib/i18n";

type PurposeExcelUploadDialogProps = {
    onClose: () => void;
    /** Fired after a successful upload — panel uses this to refetch the
     *  live tree so the freshly-inserted rows show up. */
    onUploaded?: () => void;
};

/**
 * Settings &gt; Purpose Excel Upload dialog — Figma 9718:26009 (UI) +
 * legacy {@code comm_0187_004} family (logic).
 *
 * Two real round-trips:
 *   • Browse + Preview: multipart upload to {@code POST .../excel/preview}.
 *     Backend parses cells, validates each row (required / length /
 *     dup_file / dup_db / parent_not_found / parent_not_root), returns
 *     the row list + counts.
 *   • Upload: {@code POST .../excel/import} with the preview rows
 *     forwarded back. Backend re-validates for race-safety, inserts
 *     roots before children (so children resolve their parent's
 *     freshly-generated `use_usag_cd`), and audits.
 *
 * Download Template is a plain anchor click against a static asset
 * under {@code /templates/purpose/} — no backend round-trip.
 *
 * Purpose is append-only (no Reset/Replace mode — there is no legacy
 * wipe path for the BUSI_USAG_SET_INFM tree under refactor scope).
 * State is owned here; the shared {@code <ExcelUploadDialog>} shell
 * stays presentational.
 */
export default function PurposeExcelUploadDialog({
    onClose,
    onUploaded,
}: PurposeExcelUploadDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ApiPurposeExcelPreview | null>(null);
    const [busy, setBusy] = useState<"idle" | "previewing" | "uploading">("idle");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const columns: ExcelUploadColumn[] = [
        {
            id: "hand_use_usag_cd",
            label: t("settings.purpose.upload.col.code"),
            required: true,
            widthPx: 140,
        },
        {
            id: "use_usag_nm",
            label: t("settings.purpose.upload.col.name"),
            required: true,
            widthPx: 200,
        },
        {
            id: "use_usag_cont",
            label: t("settings.purpose.upload.col.description"),
            widthPx: 280,
        },
        {
            id: "parent_use_usag_cd",
            label: t("settings.purpose.upload.col.parent"),
            widthPx: 200,
        },
    ];

    const rows: ExcelUploadRow[] = (preview?.rows ?? []).map(toUploadRow);
    const completedCount = preview?.completed_count ?? 0;
    const errorCount = preview?.error_count ?? 0;
    const totalCount = preview?.total_count ?? 0;

    const handleDownload = () => {
        downloadPurposeTemplate(locale);
    };

    const handleReSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (evt: React.ChangeEvent<HTMLInputElement>) => {
        const file = evt.target.files?.[0];
        // Reset so re-picking the SAME filename still fires `change`.
        evt.target.value = "";
        if (!file) return;
        if (!isExcelFilename(file.name)) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.purpose.upload.error_file_type"),
            });
            return;
        }
        setSelectedFile(file);
        setPreview(null);
        setBusy("previewing");
        try {
            const res = await previewPurposeExcel(file);
            setPreview(res);
        } catch (e) {
            const ex = e as ApiCallError;
            // Standard error dialog (red X) — preview failures come from
            // the backend (corrupt workbook / invalid header / row-cap
            // exceeded) and warrant the same chrome as the import
            // failure path below. Title stays `t("dialog.error")` so the
            // dialog reads "Error" — pairing the title with `type:
            // "error"` is the contract the §"Dialogs & modals" rule
            // expects.
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
            // Keep the filename chip so the user knows which file failed.
        } finally {
            setBusy("idle");
        }
    };

    const handleUpload = async () => {
        if (!preview || preview.rows.length === 0) return;
        if (errorCount > 0) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.purpose.upload.error_has_errors"),
            });
            return;
        }
        setBusy("uploading");
        try {
            const result = await importPurposeExcel({
                rows: preview.rows.map((r) => ({
                    hand_use_usag_cd: r.hand_use_usag_cd,
                    use_usag_nm: r.use_usag_nm,
                    use_usag_cont: r.use_usag_cont.trim() || null,
                    parent_use_usag_cd: r.parent_use_usag_cd.trim() || null,
                })),
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.purpose.success.uploaded", {
                    count: String(result.inserted_count),
                }),
                onConfirm: () => {
                    onUploaded?.();
                    onClose();
                },
            });
        } catch (e) {
            const ex = e as ApiCallError;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
        } finally {
            setBusy("idle");
        }
    };

    const uploadDisabled =
        !preview ||
        preview.rows.length === 0 ||
        errorCount > 0 ||
        busy !== "idle";

    return (
        <>
            <SharedExcelUploadDialog
                onClose={onClose}
                title={t("settings.purpose.upload.title")}
                step1Title={t("settings.purpose.upload.step1_title")}
                step1Description={t("settings.purpose.upload.step1_description")}
                downloadLabel={t("settings.purpose.upload.download")}
                onDownload={handleDownload}
                downloadFullWidth
                downloadIcon="excel"
                step2Title={t("settings.purpose.upload.step2_title")}
                step2Description={t("settings.purpose.upload.step2_description")}
                fileName={selectedFile?.name}
                filePlaceholder={t("settings.purpose.upload.filename")}
                reSelectLabel={
                    selectedFile
                        ? t("settings.purpose.upload.reselect")
                        : t("settings.purpose.upload.browse")
                }
                onReSelect={handleReSelect}
                completedLabel={t("settings.purpose.upload.completed")}
                completedCount={completedCount}
                errorLabel={t("settings.purpose.upload.error")}
                errorCount={errorCount}
                columns={columns}
                rows={rows}
                totalLabel={t("settings.purpose.upload.total", {
                    count: String(totalCount),
                })}
                closeLabel={t("settings.purpose.upload.close")}
                uploadLabel={
                    busy === "uploading"
                        ? t("settings.purpose.upload.uploading")
                        : t("settings.purpose.upload.upload")
                }
                uploadDisabled={uploadDisabled}
                onUpload={handleUpload}
            />

            {/* Hidden file picker — pinned to the dialog so the shared
                shell's Browse button can trigger it. `accept` is a UX
                hint; backend `WBE2043` is the authoritative gate. */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
            />
        </>
    );
}

/** Wire row → shared-dialog row. Distributes the per-cell errors to
 *  the matching column cell so the preview's tooltip + red highlight
 *  attach correctly. */
function toUploadRow(row: ApiPurposeExcelPreviewRow): ExcelUploadRow {
    const errorByField = new Map<string, string>();
    for (const err of row.errors) errorByField.set(err.field, err.message);
    const errCode = errorByField.get("hand_use_usag_cd");
    const errName = errorByField.get("use_usag_nm");
    const errDesc = errorByField.get("use_usag_cont");
    const errParent = errorByField.get("parent_use_usag_cd");

    return {
        id: `row-${row.row_index}`,
        cells: {
            hand_use_usag_cd: {
                value: row.hand_use_usag_cd,
                error: errCode !== undefined,
                errorMessage: errCode,
            },
            use_usag_nm: {
                value: row.use_usag_nm,
                error: errName !== undefined,
                errorMessage: errName,
            },
            use_usag_cont: {
                value: row.use_usag_cont,
                error: errDesc !== undefined,
                errorMessage: errDesc,
            },
            parent_use_usag_cd: {
                value: row.parent_use_usag_cd,
                error: errParent !== undefined,
                errorMessage: errParent,
            },
        },
    };
}

function isExcelFilename(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith(".xls") || lower.endsWith(".xlsx");
}
