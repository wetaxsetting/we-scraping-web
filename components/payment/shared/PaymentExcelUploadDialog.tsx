"use client";

import { useState } from "react";

import SharedExcelUploadDialog, {
    type ExcelUploadColumn,
    type ExcelUploadExtraStep,
    type ExcelUploadRow,
} from "@/components/shared/excel-upload/ExcelUploadDialog";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { useTranslation } from "@/lib/i18n";

/**
 * Result of a Payment-module Excel parse step — shape independent of any
 * specific Payment type. The consumer's `onParse` callback returns this;
 * the dialog renders the preview rows verbatim.
 *
 * `rows` are keyed by column id (matching `columns[].id`) per
 * the shared `<ExcelUploadDialog>` contract.
 */
export type PaymentExcelParseResult = {
    rows: ExcelUploadRow[];
    completedCount: number;
    errorCount: number;
};

/**
 * Strings the dialog renders. Every Payment type passes its own
 * translated copy — the shared dialog itself is i18n-free per the
 * `wecms-web/CLAUDE.md` §3a "Excel Upload preview modals" rule.
 *
 * Keys mirror the canonical Chart-of-Accounts wrapper precedent —
 * one string per visible label, no fall-through defaults.
 */
export type PaymentExcelUploadStrings = {
    title:              string;
    step1Title:         string;
    step1Description:   string;
    downloadLabel:      string;
    step2Title:         string;
    step2Description:   string;
    reSelectLabel:      string;
    completedLabel:     string;
    errorLabel:         string;
    /** Rendered in the footer total row — receives the actual row
     *  count via `{count}` interpolation. */
    totalLabelKey:      string;
    closeLabel:         string;
    uploadLabel:        string;
    /** Description shown in the success dialog after a successful save. */
    successDescription: string;
};

/**
 * Props for the shared Payment-module Excel-upload wrapper. Every
 * Payment-type-specific wrapper (Internal Transfer, Vendor Payment,
 * Expense Payment, Payroll Payment, Overseas Payment) passes the same
 * shape — only the columns / endpoints / strings change.
 *
 * <p>The shared wrapper owns the file-selection state, calls
 * {@link #onParse} when the user picks (or re-picks) a file, renders
 * the preview, and calls {@link #onUpload} when the user confirms.
 * Both handlers throw {@link ApiCallError} on failure; the wrapper
 * funnels the error into the global `useDialog()` error variant so the
 * trace id propagates through the standard dialog.
 */
export type PaymentExcelUploadDialogProps = {
    /** Fired when the user dismisses the dialog (X / Close / ESC). */
    onClose: () => void;

    /** Fired after a successful upload. The wrapper closes itself
     *  before invoking this callback, so the parent can immediately
     *  refetch the list / route to a detail page. */
    onSaved?: (result: unknown) => void;

    /** Translated chrome strings. */
    strings: PaymentExcelUploadStrings;

    /** Column config — pixel widths, required flags, alignment all
     *  per-payment-type. */
    columns: ExcelUploadColumn[];

    /**
     * Parse step. Caller's responsibility to POST the multipart
     * payload to its own `/uploads/parse` endpoint and map the
     * response to `ExcelUploadRow[]` shaped for the columns above.
     *
     * <p>Throw {@link ApiCallError} on failure; the wrapper catches
     * and surfaces via `useDialog()`.
     */
    onParse: (file: File) => Promise<PaymentExcelParseResult>;

    /**
     * Save step. Caller's responsibility to POST the multipart
     * payload (file + JSON body) to its own create endpoint. Returns
     * whatever the create endpoint returns; the wrapper passes it to
     * {@link #onSaved}.
     */
    onUpload: (file: File, parsed: PaymentExcelParseResult) => Promise<unknown>;

    /** Optional template-download handler. When omitted the Download
     *  button renders inert (matches the legacy parity precedent in
     *  Chart of Accounts — template URLs land in a follow-up MR). */
    onDownload?: () => void;

    /** Optional Step-3 slot rendered in the left panel below Browse.
     *  Payment Internal Transfer uses this for the "Withdrawal
     *  Bank/Account No." picker (legacy `pymn_0009_002_v001`). The
     *  shared shell paints the numbered badge / title / description;
     *  the caller's wrapper owns the `content` (combobox, etc.). */
    extraStep?: ExcelUploadExtraStep;
};

/**
 * Payment-module shared Excel-upload wrapper. Composes the cross-app
 * `<ExcelUploadDialog>` (CLAUDE.md §3a) and owns the parse/save state
 * machine + error handling that every Payment-type-specific upload
 * flow needs.
 *
 * <p>Canonical first consumer: {@code <InternalTransferUploadDialog>}
 * (legacy {@code pymn_0009_002}). Future Payment-type wrappers
 * (Vendor Payment / Expense Payment / Payroll / Overseas) mirror the
 * Internal Transfer wrapper — they each supply their own columns +
 * endpoints + i18n strings and reuse this shared shell verbatim. Do
 * not fork.
 *
 * <p>Per the global modal rule, this dialog opens at `stackLevel=1`
 * because Payment-module upload flows are launched from a top-level
 * Payment list page, not from inside the Settings modal. (The
 * Settings-side Excel uploads in Chart of Accounts / Contacts /
 * VAS Account default to `stackLevel=2` because they open above the
 * Settings shell at L1.)
 */
export default function PaymentExcelUploadDialog({
    onClose,
    onSaved,
    strings,
    columns,
    onParse,
    onUpload,
    onDownload,
    extraStep,
}: PaymentExcelUploadDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsed, setParsed] = useState<PaymentExcelParseResult | null>(null);
    const [isBusy, setIsBusy] = useState(false);

    async function handleReSelect(file: File) {
        setIsBusy(true);
        try {
            const result = await onParse(file);
            setSelectedFile(file);
            setParsed(result);
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            const message =
                err instanceof Error ? err.message : t("dialog.error_generic");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setIsBusy(false);
        }
    }

    async function handleUpload() {
        if (!selectedFile || !parsed) return;
        if (parsed.errorCount > 0) return;  // shared shell already disables, defence in depth
        setIsBusy(true);
        try {
            const result = await onUpload(selectedFile, parsed);
            // Close FIRST so the success dialog renders cleanly above
            // the now-dismissed upload modal stack — matches the
            // existing pattern in Chart of Accounts / VAS Account.
            onClose();
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: strings.successDescription,
            });
            onSaved?.(result);
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            const message =
                err instanceof Error ? err.message : t("dialog.error_generic");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setIsBusy(false);
        }
    }

    const rows = parsed?.rows ?? [];
    const completedCount = parsed?.completedCount ?? 0;
    const errorCount     = parsed?.errorCount     ?? 0;

    return (
        <SharedExcelUploadDialog
            stackLevel={1}
            onClose={onClose}
            extraStep={extraStep}
            title={strings.title}
            step1Title={strings.step1Title}
            step1Description={strings.step1Description}
            downloadLabel={strings.downloadLabel}
            onDownload={onDownload}
            step2Title={strings.step2Title}
            step2Description={strings.step2Description}
            step2DescriptionRequired
            fileName={selectedFile?.name}
            reSelectLabel={strings.reSelectLabel}
            onReSelect={() => triggerFilePicker(handleReSelect)}
            completedLabel={strings.completedLabel}
            completedCount={completedCount}
            errorLabel={strings.errorLabel}
            errorCount={errorCount}
            columns={columns}
            rows={rows}
            totalLabel={t(strings.totalLabelKey, { count: rows.length })}
            closeLabel={strings.closeLabel}
            uploadLabel={strings.uploadLabel}
            // Disabled until: (a) the user picks a file and parse
            // succeeds, (b) parse returned zero per-cell errors,
            // (c) the wrapper is not currently mid-flight.
            uploadDisabled={!selectedFile || !parsed || errorCount > 0 || isBusy}
            onUpload={handleUpload}
        />
    );
}

/**
 * Spawn a hidden `<input type="file">` and resolve when the user
 * picks one. Cancel resolves to no-op (handler never fires) — matches
 * the browser-native cancel semantics. We use this rather than a
 * persistent input so the same dialog instance can re-pick a file
 * multiple times without state leakage.
 */
function triggerFilePicker(handler: (file: File) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";
    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (file) handler(file);
    });
    input.click();
}
