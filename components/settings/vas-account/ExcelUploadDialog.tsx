"use client";

import { useMemo, useRef, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    downloadVasAccountTemplate,
    importVasAccountExcel,
    previewVasAccountExcel,
    type ApiVasAccountExcelPreview,
    type ApiVasAccountExcelPreviewRow,
} from "@/lib/api/vasAccount";
import { useTranslation } from "@/lib/i18n";

type ExcelUploadDialogProps = {
    onClose: () => void;
    /** Fires after a successful import — host refetches and dismisses. */
    onSaved?: () => void | Promise<void>;
};

/** Wire option keys — match Spring `upld_optn`. */
type UploadOption = "A" | "R";

/**
 * VAS Account Excel Upload dialog — Figma 9194:9409 (UI) +
 * comm_0217_002 family (logic).
 *
 * <p>Three real round-trips:
 * <ul>
 *   <li><b>Download Template:</b> {@code GET .../excel/template}.</li>
 *   <li><b>Browse + Preview:</b> multipart upload to
 *       {@code POST .../excel/preview}. Backend parses cells,
 *       validates each row, returns the row list + counts.</li>
 *   <li><b>Upload:</b> {@code POST .../excel/import} with the upload
 *       option (Append / Replace) + the preview rows forwarded back.
 *       Backend re-validates for race-safety, persists, audits.</li>
 * </ul>
 *
 * <p>State is owned here; the shared {@code <ExcelUploadDialog>}
 * shell stays presentational.
 *
 * <p>File selection uses a hidden {@code <input type="file">}
 * triggered by the shell's Browse button via {@code onReSelect}.
 * Accepts only {@code .xls} / {@code .xlsx}; the browser's accept
 * attribute is a hint, the backend is the authoritative gate
 * ({@code WBE2043} on non-Excel binaries).
 */
export default function ExcelUploadDialog({
    onClose,
    onSaved,
}: ExcelUploadDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    const [uploadOption, setUploadOption] = useState<UploadOption>("A");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ApiVasAccountExcelPreview | null>(null);
    const [busy, setBusy] = useState<"idle" | "previewing" | "uploading">("idle");

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Column widths mirror the main VAS Account table
    // (`VasAccountTableColumns`) for visual parity between the panel
    // list and the upload preview — 220 / 600 sums to 820 which fits
    // inside the modal's right pane without horizontal scroll.
    const columns: ExcelUploadColumn[] = [
        {
            id: "vas_acct_cd",
            label: t("settings.vas_account.upload.col.code"),
            widthPx: 220,
        },
        {
            id: "vas_acct_nm",
            label: t("settings.vas_account.upload.col.name"),
            widthPx: 600,
        },
    ];

    /**
     * Apply the upload-option filter to the raw preview rows so the
     * preview chips + table reflect what the SELECTED option will
     * actually accept. Per the legacy comm_0217_002 behaviour + the
     * PO spec:
     *
     *   • Append ("A")           — every error category blocks the row.
     *   • Reset/Replace ("R")    — `dup_db` errors are dropped client-
     *                              side (the wipe-and-insert path
     *                              clears the conflict before write);
     *                              every other category still blocks.
     *
     * The memo keys on `(preview, uploadOption)` so toggling the
     * radio re-derives instantly — no second network round-trip.
     */
    const filtered = useMemo(() => {
        if (!preview) {
            return { rows: [] as ApiVasAccountExcelPreviewRow[], completed: 0, errored: 0 };
        }
        const dropCategory: ApiVasAccountExcelPreviewRow["errors"][number]["code"] | null =
            uploadOption === "R" ? "dup_db" : null;
        let completed = 0;
        let errored = 0;
        const rows = preview.rows.map((r) => {
            const filteredErrors = dropCategory
                ? r.errors.filter((e) => e.code !== dropCategory)
                : r.errors;
            const valid = filteredErrors.length === 0;
            if (valid) completed++;
            else errored++;
            return { ...r, errors: filteredErrors, valid };
        });
        return { rows, completed, errored };
    }, [preview, uploadOption]);

    const rows: ExcelUploadRow[] = filtered.rows.map(toUploadRow);

    const showError = (e: unknown) => {
        const ex = e as ApiCallError;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: ex.message,
            errorCode: ex.code,
        });
    };

    /**
     * Run the actual import after the user confirms. Split out from
     * {@link handleUpload} so the confirmation dialog's {@code onConfirm}
     * callback can invoke it directly; the async flow handles dialog
     * chaining cleanly because each {@code await} yields control back
     * to React so the previous dialog can dismiss before the next one
     * opens.
     */
    const runUpload = async () => {
        if (!preview || preview.rows.length === 0) return;
        setBusy("uploading");
        try {
            // Forward only rows that pass the SELECTED option's
            // validation — in Replace mode that means we include rows
            // whose only errors were `dup_db` (filtered out client-
            // side; backend wipes live rows before insert so the dup
            // is resolved there too).
            const rowsToSend = filtered.rows.filter((r) => r.valid);
            await importVasAccountExcel({
                upld_optn: uploadOption,
                rows: rowsToSend.map((r) => ({
                    vas_acct_cd: r.vas_acct_cd,
                    vas_acct_nm: r.vas_acct_nm,
                })),
            });
            // Success — green-check dialog with "Done". Clicking Done
            // closes the upload modal AND refetches the list (via the
            // parent's `onSaved` callback). Matches Figma 4661:24538
            // success branch.
            dialog.open({
                type: "success",
                title: t("settings.vas_account.upload.success.title"),
                description: t("settings.vas_account.upload.success.message"),
                confirmText: t("settings.vas_account.upload.success.done"),
                onConfirm: () => {
                    if (onSaved) void onSaved();
                    else onClose();
                },
            });
        } catch (e) {
            // Error — red-alert dialog with "Okay". Clicking Okay
            // dismisses ONLY the error dialog; the upload modal stays
            // open so the user can fix the file and re-Browse (per the
            // Figma fail branch). The server-supplied error code +
            // trace id are still surfaced via the dialog's standard
            // diagnostic trailer so support can grep them.
            const ex = e as ApiCallError;
            dialog.open({
                type: "error",
                title: t("settings.vas_account.upload.failure.title"),
                description: t("settings.vas_account.upload.failure.message"),
                errorCode: ex.code,
                confirmText: t("settings.vas_account.upload.failure.okay"),
            });
        } finally {
            setBusy("idle");
        }
    };

    const handleDownload = () => {
        // Pre-made static asset under public/file/excel/VN/ — no
        // backend round-trip, no try/catch (anchor.click can't throw
        // synchronously). Mirrors legacy comm_0217_002.ts
        // fnDownloadExcelForm: locale-aware URL + yyyyMMdd cache-buster
        // + custom download filename.
        downloadVasAccountTemplate(locale);
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
                description: t("settings.vas_account.upload.error_file_type"),
            });
            return;
        }
        setSelectedFile(file);
        setPreview(null);
        setBusy("previewing");
        try {
            const res = await previewVasAccountExcel(file);
            setPreview(res);
        } catch (e) {
            showError(e);
            // Keep the filename chip so the user knows which file
            // failed; they can fix it and re-Browse.
        } finally {
            setBusy("idle");
        }
    };

    /**
     * Step 1 of the Upload button flow — open the confirmation dialog
     * (Figma 4661:24538). Two different bodies depending on the
     * selected upload option:
     *
     *   • Add New ("A")        — informational: "New VAS accounts will
     *                            be added from the file without
     *                            affecting the existing data."
     *   • Reset/Replace ("R")  — cautionary: "Are you sure? All
     *                            existing data will be lost."
     *
     * Both variants use the standard {@code "confirmation"} dialog —
     * neutral icon, Cancel + primary-blue Confirm. The wipe-and-replace
     * branch is NOT flagged {@code destructive}: per the Figma
     * "Confirmation" component (the Settings module's standard
     * confirmation popup) the primary button stays in the brand-blue
     * ramp. The danger-red {@code destructive} variant is reserved for
     * irrecoverable actions explicitly designed as red CTAs (e.g.
     * single-row delete confirmations). The Excel-replace flow is
     * destructive in semantics but uses the standard confirmation
     * chrome by design.
     *
     * Confirm fires {@link runUpload} (the async API call); Cancel
     * dismisses the confirmation dialog and leaves the upload modal
     * open so the user can adjust the option / file before retrying.
     *
     * The pre-upload row-error guard stays — when any row in the
     * filtered preview is invalid we surface the same warning as
     * before WITHOUT opening the confirmation dialog (no point
     * confirming an import the backend would reject row-1).
     */
    const handleUpload = () => {
        if (!preview || preview.rows.length === 0) return;
        if (filtered.errored > 0) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.vas_account.upload.error_has_errors"),
            });
            return;
        }
        dialog.open({
            type: "confirmation",
            title: t("settings.vas_account.upload.confirm.title"),
            description: uploadOption === "R"
                ? t("settings.vas_account.upload.confirm.reset_replace")
                : t("settings.vas_account.upload.confirm.add_new"),
            confirmText: t("settings.vas_account.upload.confirm.confirm"),
            cancelText: t("settings.vas_account.upload.confirm.cancel"),
            onConfirm: () => { void runUpload(); },
        });
    };

    const completedCount = filtered.completed;
    const errorCount = filtered.errored;
    const totalCount = preview?.total_count ?? 0;
    const uploadDisabled =
        !preview ||
        preview.rows.length === 0 ||
        errorCount > 0 ||
        busy !== "idle";

    return (
        <>
            <SharedExcelUploadDialog
                onClose={onClose}
                title={t("settings.vas_account.upload.title")}
                step1Title={t("settings.vas_account.upload.step1_title")}
                step1Description={t(
                    "settings.vas_account.upload.step1_description",
                )}
                downloadLabel={t("settings.vas_account.upload.download")}
                onDownload={handleDownload}
                // Figma 4661:24538 — full-width button + Excel icon.
                downloadFullWidth
                downloadIcon="excel"
                step2Title={t("settings.vas_account.upload.step2_title")}
                step2Description={t(
                    "settings.vas_account.upload.step2_description",
                )}
                fileName={selectedFile?.name}
                // Empty-state placeholder shown before the user picks
                // a file — matches Figma 4661:24538 ("VAS Account_
                // YYMMDD.xls" example string at reduced opacity).
                // `{date}` interpolation gets today's date in YYMMDD;
                // the date is computed once per mount (the dialog is
                // short-lived; recomputing on every render would
                // serve no purpose). Locale-agnostic — YYMMDD is the
                // same numeric format everywhere.
                filePlaceholder={t("settings.vas_account.upload.filename", {
                    date: formatYyMmDd(new Date()),
                })}
                reSelectLabel={
                    selectedFile
                        ? t("settings.vas_account.upload.reselect")
                        : t("settings.vas_account.upload.browse")
                }
                onReSelect={handleReSelect}
                // Figma 4661:24538 — file-chip + Browse on one row.
                browseInline
                optionsStep={{
                    title: t("settings.vas_account.upload.options.title"),
                    selectedValue:
                        uploadOption === "A" ? "add_new" : "reset_replace",
                    onChange: (value) =>
                        setUploadOption(value === "reset_replace" ? "R" : "A"),
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
                completedCount={completedCount}
                errorLabel={t("settings.vas_account.upload.error")}
                errorCount={errorCount}
                columns={columns}
                rows={rows}
                totalLabel={t(
                    "settings.vas_account.upload.total_transactions",
                    { count: totalCount },
                )}
                closeLabel={t("settings.vas_account.upload.cancel")}
                uploadLabel={
                    busy === "uploading"
                        ? t("settings.vas_account.upload.uploading")
                        : t("settings.vas_account.upload.upload")
                }
                uploadDisabled={uploadDisabled}
                onUpload={handleUpload}
            />

            {/* Hidden file picker — pinned to the dialog so the shared
                shell's "Browse" button can trigger it. `accept` is a
                UX hint; backend `WBE2043` is the authoritative gate. */}
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
function toUploadRow(row: ApiVasAccountExcelPreviewRow): ExcelUploadRow {
    const errorByField = new Map<string, string>();
    for (const err of row.errors) errorByField.set(err.field, err.message);
    const errCode = errorByField.get("vas_acct_cd");
    const errName = errorByField.get("vas_acct_nm");

    return {
        id: `row-${row.row_index}`,
        cells: {
            vas_acct_cd: {
                value: row.vas_acct_cd ?? "",
                error: errCode !== undefined,
                errorMessage: errCode,
            },
            vas_acct_nm: {
                value: row.vas_acct_nm ?? "",
                error: errName !== undefined,
                errorMessage: errName,
            },
        },
    };
}

function isExcelFilename(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith(".xls") || lower.endsWith(".xlsx");
}

/** `YYMMDD` — 6-digit numeric date used as the empty-state placeholder
 *  example filename (e.g. {@code "VAS Account_260511.xls"} on
 *  2026-05-11). Local time, mirrors the legacy `comm_0217_002.ts`
 *  placeholder convention. The two-digit year wraps at the century;
 *  this is a display-only placeholder so the wrap is acceptable. */
function formatYyMmDd(d: Date): string {
    const yy = (d.getFullYear() % 100).toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    return `${yy}${mm}${dd}`;
}
