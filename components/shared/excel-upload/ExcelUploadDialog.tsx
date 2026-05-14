"use client";

import { RefreshCcw } from "lucide-react";

import Tooltip from "@/components/shared/Tooltip";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    type DialogStackLevel,
} from "@/components/ui/dialog";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Cell value for a preview row. `null` renders as a blank cell; the
 * `error` flag tints the cell background to the Figma red-02 to flag
 * validation issues without losing the original cell content.
 *
 * `errorMessage` (when paired with `error: true`) drives the native
 * hover tooltip on the cell — used by Contacts upload to surface
 * "Contact Code is invalid" / similar copy without forking the
 * shared shell. Falls back to no tooltip when omitted.
 */
export type ExcelUploadCell = {
    value: string | null;
    error?: boolean;
    errorMessage?: string;
};

/**
 * Column definition for the preview table. `widthPx` is required so
 * the three sibling tables (header / body / footer) share one width
 * set and columns align byte-for-byte across all three regions; the
 * sum of `widthPx` across all columns also drives the inner stack's
 * `min-width`, which engages horizontal scroll when the column total
 * exceeds the panel width.
 */
export type ExcelUploadColumn = {
    /** Stable identifier — used as React key and to look up cells in
     *  each row's `cells` map. */
    id: string;
    /** Translated header label (caller resolves i18n). */
    label: React.ReactNode;
    /** Adds the red asterisk after the label. */
    required?: boolean;
    /** Pixel width applied to the matching `<col>` in every sibling
     *  table. Inline style is used (not a Tailwind class) so the
     *  width can come from per-feature config without bloating the
     *  Tailwind safelist. */
    widthPx: number;
    /** Cell text alignment. Defaults to `left`. */
    align?: "left" | "right";
};

/**
 * Preview row — keyed cell map matching the configured columns. Cells
 * without an entry in the map render as empty whitespace.
 */
export type ExcelUploadRow = {
    id: string;
    cells: Record<string, ExcelUploadCell>;
};

/**
 * Optional pre-Step 1 "select an upload variant" section. When passed
 * to the shared dialog, renders above Download Template inside the
 * left step panel and shifts the Download / Browse step badges from
 * 1/2 to 2/3. First consumer: Settings > Contacts (Local vs Overseas
 * upload). Chart of Accounts and other single-variant flows omit this
 * prop and keep the original 1/2 badges.
 */
export type ExcelUploadSelectStep = {
    title: string;
    description: string;
    /** Stable identifiers + translated labels. Caller resolves i18n. */
    options: Array<{ value: string; label: string }>;
    /** Currently-selected option value. Caller owns the state. */
    selectedValue: string;
    onChange: (value: string) => void;
};

/**
 * Optional post-Browse "Choose Upload Options" section. Distinct from
 * `selectStep` (which pre-selects an upload *variant* before any
 * step happens): `optionsStep` is a *post-browse* decision rendered
 * below Browse without its own step badge, and each option carries a
 * helper description below the radio label. First consumer: Settings
 * > VAS Account (Add new vs Reset and replace). Does NOT shift the
 * Download / Browse step badges — they remain 1 / 2.
 */
export type ExcelUploadOptionsStep = {
    /** Section title, e.g. "Choose Upload Options". */
    title: string;
    /** Stable identifiers + translated labels + per-option helper copy. */
    options: Array<{ value: string; label: string; description: string }>;
    selectedValue: string;
    onChange: (value: string) => void;
};

/**
 * Optional Step-3 slot rendered as a fully-styled step block (numbered
 * badge + title + description + caller-supplied content). Used by
 * Payment-module upload flows for the "Withdrawal Bank / Account No."
 * picker (legacy `pymn_0009_002_v001` — Figma 1:9972).
 *
 * The shared shell paints the badge / title / description chrome so the
 * step lines up byte-for-byte with the Download / Browse steps above
 * it; the caller only owns {@link #content} (e.g. an account-picker
 * combobox). The badge number is auto-computed:
 * - selectStep absent: Download=1, Browse=2, **Extra=3**
 * - selectStep present: Select=1, Download=2, Browse=3, **Extra=4**
 */
export type ExcelUploadExtraStep = {
    /** Step title (e.g. "Withdrawal Bank/Account No."). */
    title: string;
    /** Helper line under the title (e.g. "Select preferred withdrawal account"). */
    description: string;
    /** Caller-owned content rendered below the title (combobox, etc.). */
    content: React.ReactNode;
};

export type ExcelUploadDialogProps = {
    /** Fired when the user dismisses the dialog (X / Close button /
     *  ESC / overlay click). The host conditionally mounts this
     *  component, so closing means unmounting on the host side. */
    onClose: () => void;

    /** Modal title (e.g. "Upload"). */
    title: string;

    /** Optional Step 1 — "Select Upload Option" radio block. When
     *  provided, the Download / Browse steps shift to badges 2 / 3.
     *  Omit for single-variant uploads (Chart of Accounts). */
    selectStep?: ExcelUploadSelectStep;

    /** Optional post-Browse "Choose Upload Options" radio block.
     *  Renders below Browse, no step badge, with per-option helper
     *  descriptions. Independent from `selectStep` — both can coexist
     *  if a future flow needs a top-of-panel variant pick AND a
     *  bottom-of-panel post-browse decision. */
    optionsStep?: ExcelUploadOptionsStep;

    /** Optional Step-3 slot rendered below Browse with its own numbered
     *  badge. First consumer: Payment Internal Transfer's "Withdrawal
     *  Bank/Account No." picker (legacy `pymn_0009_002_v001`). The
     *  shared shell paints the badge / title / description; the caller
     *  owns {@code content}. */
    extraStep?: ExcelUploadExtraStep;

    /* — Step 1 (or Step 2 when selectStep is set): Download Excel Template — */
    step1Title: string;
    step1Description: string;
    downloadLabel: string;
    onDownload?: () => void;
    /** When true, the Download Template button stretches to the
     *  panel's full width (Figma 4661:24538 — VAS Account). Defaults
     *  to false (content-width — Chart of Accounts / Contacts). */
    downloadFullWidth?: boolean;
    /** Icon rendered inside the Download Template button. {@code
     *  "download"} (default) uses the generic down-arrow glyph
     *  (Chart of Accounts / Contacts); {@code "excel"} uses the
     *  green Microsoft Excel mark (VAS Account — Figma 4661:24538). */
    downloadIcon?: "download" | "excel";

    /* — Step 2: Browse Excel Form — */
    step2Title: string;
    step2Description: string;
    /** Renders the red asterisk after `step2Description`. */
    step2DescriptionRequired?: boolean;
    /** Filename rendered inside the disabled-look chip. Omit to hide
     *  the chip (e.g. before any file is selected). */
    fileName?: string;
    /** Placeholder text shown inside the file-name chip BEFORE the
     *  user picks a file. Only consumed when {@link #browseInline} is
     *  true — the stacked-default layout hides the chip entirely on
     *  an empty selection. Caller resolves i18n; defaults to "" in
     *  which case the empty-state chip renders a blank field. */
    filePlaceholder?: string;
    reSelectLabel: string;
    onReSelect?: () => void;
    /** When true, the file-name chip and the Browse button render
     *  side-by-side on one row (Figma 4661:24538 — VAS Account);
     *  the chip takes the remaining width with ellipsis truncation
     *  and the Browse button stays content-sized on the right. The
     *  Browse button drops its {@code <RefreshCcw>} icon in this
     *  variant to match the Figma frame. The empty-state chip
     *  renders the {@link #filePlaceholder} text at reduced opacity
     *  so the row stays visually anchored even before a file is
     *  picked. Defaults to false (vertically stacked chip + button —
     *  Chart of Accounts / Contacts). */
    browseInline?: boolean;

    /* — Top-right summary chips — */
    completedLabel: string;
    completedCount: number;
    errorLabel: string;
    errorCount: number;

    /* — Preview table — */
    columns: ExcelUploadColumn[];
    rows: ExcelUploadRow[];
    /** Pre-translated total-row text, e.g. "Total 6 Transaction(s)".
     *  Caller is responsible for plural / locale formatting. */
    totalLabel: string;

    /* — Footer buttons — */
    closeLabel: string;
    uploadLabel: string;
    onUpload?: () => void;
    /** Defaults to `true` (the brand-spec disabled gray button) until
     *  the host validates the import. */
    uploadDisabled?: boolean;

    /**
     * Stack level for the underlying shadcn Dialog. Defaults to `2`
     * since Excel Upload modals open from inside the Settings shell
     * (L1) by convention. Pass `1` for standalone usage outside a
     * stacked modal chain.
     */
    stackLevel?: DialogStackLevel;

    /** Optional Step 3 — custom block rendered below Browse. Used by
     *  Overseas Scheduled Payment to render the Withdrawal Account dropdown. */
    customStep3?: React.ReactNode;
};

/**
 * Common Excel Upload preview modal — shared shell for any feature
 * that needs to:
 *   1. Let the user download an Excel template (Step 1).
 *   2. Browse / select a completed Excel file (Step 2).
 *   3. Preview the parsed rows with per-cell error highlighting.
 *   4. Confirm the upload via a primary button.
 *
 * First consumer: Chart of Accounts (Settings > Chart of Accounts >
 * Excel Upload). Subsequent settings/import flows that need the same
 * pattern (Bank Account import, User import, VAS Account import, …)
 * MUST consume this component instead of forking a new dialog.
 *
 * Layout:
 *   - Fixed-height (450 px) table area split into three sibling
 *     `<table>` elements sharing one `<colgroup>` so the header band
 *     stays at the top, the Total row stays at the bottom, and only
 *     the body scrolls vertically — regardless of row count.
 *   - Outer horizontal-scroll wrapper so all three tables pan in
 *     lockstep when the column total exceeds the panel width.
 *   - The shadcn `<Dialog>` primitive owns the portal, ESC handling,
 *     and the L2 backdrop dim.
 *
 * Columns are required to declare their `widthPx`; the shared
 * `<colgroup>` is rendered three times (once per sibling table) from
 * the same `columns` array so widths can never drift between header,
 * body, and footer.
 */
export default function ExcelUploadDialog({
    onClose,
    title,
    selectStep,
    optionsStep,
    extraStep,
    step1Title,
    step1Description,
    downloadLabel,
    onDownload,
    downloadFullWidth = false,
    downloadIcon = "download",
    step2Title,
    step2Description,
    step2DescriptionRequired,
    fileName,
    filePlaceholder,
    reSelectLabel,
    onReSelect,
    browseInline = false,
    completedLabel,
    completedCount,
    errorLabel,
    errorCount,
    columns,
    rows,
    totalLabel,
    closeLabel,
    uploadLabel,
    onUpload,
    uploadDisabled = true,
    stackLevel = 2,
    customStep3,
}: ExcelUploadDialogProps) {
    /**
     * Sum of column widths drives the inner stack's `min-width` so
     * the three tables share one minimum width and horizontal scroll
     * engages when the panel is narrower. Computed inline because
     * it's a trivial reduce that runs once per render.
     */
    const tableMinWidthPx = columns.reduce(
        (acc, col) => acc + col.widthPx,
        0,
    );

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={stackLevel}
                aria-describedby={undefined}
                className="flex max-h-[85vh] max-w-[1120px] flex-col rounded-md p-0"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#e0e0e0] px-5 py-5 pr-14">
                    <DialogTitle className="text-wb-18 font-semibold text-wb-dark">
                        {title}
                    </DialogTitle>
                </div>

                {/* Body — left step panel + right preview table */}
                <div className="flex min-h-0 flex-1">
                    <StepPanel
                        selectStep={selectStep}
                        optionsStep={optionsStep}
                        extraStep={extraStep}
                        step1Title={step1Title}
                        step1Description={step1Description}
                        downloadLabel={downloadLabel}
                        onDownload={onDownload}
                        downloadFullWidth={downloadFullWidth}
                        downloadIcon={downloadIcon}
                        step2Title={step2Title}
                        step2Description={step2Description}
                        step2DescriptionRequired={step2DescriptionRequired}
                        fileName={fileName}
                        filePlaceholder={filePlaceholder}
                        reSelectLabel={reSelectLabel}
                        onReSelect={onReSelect}
                        browseInline={browseInline}
                        customStep3={customStep3}
                    />
                    <PreviewSection
                        completedLabel={completedLabel}
                        completedCount={completedCount}
                        errorLabel={errorLabel}
                        errorCount={errorCount}
                        columns={columns}
                        rows={rows}
                        totalLabel={totalLabel}
                        tableMinWidthPx={tableMinWidthPx}
                    />
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#e0e0e0] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {closeLabel}
                    </button>
                    <button
                        type="button"
                        disabled={uploadDisabled}
                        onClick={uploadDisabled ? undefined : onUpload}
                        className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-md px-3 text-wb-14-tight font-medium tracking-wb-tight text-white",
                            uploadDisabled
                                ? "cursor-not-allowed bg-[#d4d4d4] shadow-wb-outline"
                                : "cursor-pointer bg-brand shadow-wb-brand-btn hover:bg-brand-hover",
                        )}
                    >
                        {uploadLabel}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ──────────────────────────────────────────────────────────────────
 * Sub-components — kept inline so the shared module is one file.
 * ────────────────────────────────────────────────────────────────── */

function StepPanel({
    selectStep,
    optionsStep,
    extraStep,
    step1Title,
    step1Description,
    downloadLabel,
    onDownload,
    downloadFullWidth,
    downloadIcon,
    step2Title,
    step2Description,
    step2DescriptionRequired,
    fileName,
    filePlaceholder,
    reSelectLabel,
    onReSelect,
    browseInline,
    customStep3,
}: {
    selectStep?: ExcelUploadSelectStep;
    optionsStep?: ExcelUploadOptionsStep;
    extraStep?: ExcelUploadExtraStep;
    step1Title: string;
    step1Description: string;
    downloadLabel: string;
    onDownload?: () => void;
    downloadFullWidth?: boolean;
    downloadIcon?: "download" | "excel";
    step2Title: string;
    step2Description: string;
    step2DescriptionRequired?: boolean;
    fileName?: string;
    filePlaceholder?: string;
    reSelectLabel: string;
    onReSelect?: () => void;
    browseInline?: boolean;
    customStep3?: React.ReactNode;
}) {
    // Badge numbering shifts when the optional Select Upload Option
    // section is present — Select=1, Download=2, Browse=3. Without
    // selectStep the original Download=1, Browse=2 layout holds. The
    // extraStep (when present) lands one number after Browse.
    const downloadBadge = selectStep ? 2 : 1;
    const browseBadge = selectStep ? 3 : 2;
    const extraBadge = browseBadge + 1;

    return (
        <div className="flex w-[320px] shrink-0 flex-col self-stretch border-r border-[#e0e0e0]">
            {/* Step 1 (optional) — Select Upload Option */}
            {selectStep && (
                <div className="flex flex-col gap-4 border-b border-[#d9d9d9] px-5 pb-5 pt-4">
                    <div className="flex flex-col gap-[7px]">
                        <div className="flex items-center gap-2.5">
                            <StepBadge>1</StepBadge>
                            <span className="text-wb-13 font-semibold text-wb-dark">
                                {selectStep.title}
                            </span>
                        </div>
                        <p className="text-wb-13 font-normal text-wb-muted">
                            {selectStep.description}
                        </p>
                    </div>
                    <div
                        role="radiogroup"
                        className="flex flex-col gap-3"
                    >
                        {selectStep.options.map((opt) => {
                            const checked = opt.value === selectStep.selectedValue;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={checked}
                                    onClick={() => selectStep.onChange(opt.value)}
                                    className="inline-flex cursor-pointer items-center gap-2.5 self-start"
                                >
                                    <span
                                        className={cn(
                                            "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                            checked ? "border-brand" : "border-wb-ntrl-4",
                                        )}
                                    >
                                        {checked && (
                                            <span className="size-2 rounded-full bg-brand" />
                                        )}
                                    </span>
                                    <span className="text-wb-13 font-medium text-wb-ntrl-8">
                                        {opt.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Download Excel Template */}
            <div className="flex flex-col gap-4 border-b border-[#d9d9d9] px-5 pb-5 pt-4">
                <div className="flex flex-col gap-[7px]">
                    <div className="flex items-center gap-2.5">
                        <StepBadge>{downloadBadge}</StepBadge>
                        <span className="text-wb-13 font-semibold text-wb-dark">
                            {step1Title}
                        </span>
                    </div>
                    <p className="text-wb-13 font-normal text-wb-muted">
                        {step1Description}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onDownload}
                    className={cn(
                        "inline-flex cursor-pointer items-center justify-center gap-1 rounded-md bg-white p-2 text-wb-14 font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03]",
                        // Figma 4661:24538 (VAS Account) stretches the
                        // button to the panel's full width. Other
                        // consumers (Chart of Accounts / Contacts)
                        // keep the historical content-width default.
                        downloadFullWidth ? "w-full" : "w-fit",
                    )}
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={
                            downloadIcon === "excel"
                                ? "/assets/common/ico-excel.svg"
                                : "/assets/common/ico-download.svg"
                        }
                        alt=""
                        aria-hidden
                        className="size-4"
                    />
                    {downloadLabel}
                </button>
            </div>

            {/* Browse Excel Form — adds border-b when an optionsStep
               sits below it so the divider matches the chrome of the
               Download / Browse sections above. Without optionsStep,
               Browse remains the trailing block (no divider needed). */}
            <div
                className={cn(
                    "flex flex-col gap-5 p-5",
                    optionsStep && "border-b border-[#e0e0e0]",
                )}
            >
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2.5">
                        <StepBadge>{browseBadge}</StepBadge>
                        <span className="text-wb-13 font-semibold text-wb-dark">
                            {step2Title}
                        </span>
                    </div>
                    <p className="text-wb-13 font-normal text-wb-muted">
                        {step2Description}
                        {step2DescriptionRequired && (
                            <span className="ml-px text-[#e1232e]">*</span>
                        )}
                    </p>
                </div>

                {browseInline ? (
                    // Figma 4661:24538 (VAS Account) — file-name chip
                    // and Browse button share one row, both in the
                    // empty AND selected state. Chip takes the
                    // remaining width (truncated with ellipsis); the
                    // Browse button stays content-sized on the right
                    // and drops the RefreshCcw icon to match the
                    // Figma frame. The empty-state chip renders the
                    // placeholder text at reduced opacity so the row
                    // stays visually anchored before a file is picked.
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-black/15 bg-wb-bg-card py-2 pl-2.5 pr-2">
                            <span
                                className={cn(
                                    "block w-full truncate text-wb-13 font-medium text-wb-dark",
                                    // Selected filename renders at the
                                    // canonical 60% opacity (matches
                                    // the legacy disabled-input look);
                                    // the placeholder renders lighter
                                    // so the chip reads as "empty" /
                                    // hint-only before the user picks.
                                    fileName ? "opacity-60" : "opacity-40",
                                )}
                            >
                                {fileName ?? filePlaceholder ?? ""}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={onReSelect}
                            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-white px-3 py-2 text-wb-14 font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {reSelectLabel}
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Stacked layout — chip on its own row, Browse
                           below. When the host passes a `filePlaceholder`
                           string the chip ALSO renders in the empty
                           state (showing the placeholder at reduced
                           opacity, same look as the inline variant)
                           so the user sees an example filename before
                           picking a file. Existing consumers that omit
                           `filePlaceholder` keep the historical
                           hide-until-picked behaviour. */}
                        {(fileName !== undefined || filePlaceholder) && (
                            <div className="flex h-8 items-center gap-1 overflow-hidden rounded-md border border-black/15 bg-wb-bg-card py-2 pl-2.5 pr-2">
                                <span
                                    className={cn(
                                        "flex-1 truncate text-wb-13 font-medium text-wb-dark",
                                        fileName ? "opacity-60" : "opacity-40",
                                    )}
                                >
                                    {fileName ?? filePlaceholder}
                                </span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={onReSelect}
                            className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-md bg-white p-2 text-wb-14 font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            <RefreshCcw className="size-4" strokeWidth={1.8} />
                            {reSelectLabel}
                        </button>
                    </>
                )}
            </div>

            {/* Choose Upload Options — post-Browse decision block. No
               step badge, plain title, radio options each carrying a
               helper description below the label (Figma 9194:9473
               canonical example).

               Spacing was deliberately tightened (vs. the sibling
               Download / Browse blocks above) so the consumer's left
               panel doesn't push the dialog noticeably taller than
               consumers without `optionsStep` (e.g. Contacts upload,
               which uses `selectStep` instead). The block now uses
               `py-3 px-5` (24 px vertical vs the 40 px the sibling
               sections use), `gap-3` between title/radios and between
               options (vs gap-4), `gap-1` between each radio button
               and its helper line (vs gap-1.5), and `leading-[14px]`
               on the helper text (vs the default `leading-4` = 16 px).
               Net height savings on a two-option block ≈ 40 px,
               bringing VAS Account's left panel close to the height
               of a Contacts-style left panel — so the modal renders
               at the same overall size for both flows. */}
            {optionsStep && (
                <div className="flex flex-col gap-3 px-5 py-3">
                    <span className="text-wb-13 font-semibold text-wb-dark">
                        {optionsStep.title}
                    </span>
                    <div role="radiogroup" className="flex flex-col gap-3">
                        {optionsStep.options.map((opt) => {
                            const checked =
                                opt.value === optionsStep.selectedValue;
                            return (
                                <div
                                    key={opt.value}
                                    className="flex flex-col gap-1"
                                >
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={checked}
                                        onClick={() =>
                                            optionsStep.onChange(opt.value)
                                        }
                                        className="inline-flex cursor-pointer items-center gap-2.5 self-start"
                                    >
                                        <span
                                            className={cn(
                                                "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                                                checked
                                                    ? "border-brand"
                                                    : "border-wb-ntrl-4",
                                            )}
                                        >
                                            {checked && (
                                                <span className="size-2 rounded-full bg-brand" />
                                            )}
                                        </span>
                                        <span className="text-wb-14 font-medium text-wb-ntrl-8">
                                            {opt.label}
                                        </span>
                                    </button>
                                    {/* Helper text — indented to align with
                                       the radio label (18px circle + 10px
                                       gap = 28px). Matches Figma 9194:9479
                                       / 9194:9484 placement. Tighter
                                       leading reduces the per-option
                                       footprint on multi-line wraps. */}
                                    <p className="pl-[28px] text-wb-12 font-normal leading-[14px] text-wb-ntrl-6">
                                        {opt.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Optional Step 3 — Withdrawal Bank/Account No. (or any
               post-Browse caller-owned step). Same chrome as Download
               / Browse blocks above so the visual rhythm matches the
               legacy `pymn_0009_002` left panel byte-for-byte. */}
            {extraStep && (
                <div className="flex flex-col gap-4 border-b border-[#d9d9d9] px-5 pb-5 pt-4">
                    <div className="flex flex-col gap-[7px]">
                        <div className="flex items-center gap-2.5">
                            <StepBadge>{extraBadge}</StepBadge>
                            <span className="text-wb-13 font-semibold text-wb-dark">
                                {extraStep.title}
                            </span>
                        </div>
                        <p className="text-wb-13 font-normal text-wb-muted">
                            {extraStep.description}
                        </p>
                    </div>
                    {extraStep.content}
                </div>
            )}

            {customStep3}
        </div>
    );
}

function StepBadge({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex w-5 shrink-0 items-center justify-center rounded-sm bg-wb-ntrl-3 px-1.5 py-0.5 text-wb-13 font-semibold text-wb-dark">
            {children}
        </span>
    );
}

function PreviewSection({
    completedLabel,
    completedCount,
    errorLabel,
    errorCount,
    columns,
    rows,
    totalLabel,
    tableMinWidthPx,
}: {
    completedLabel: string;
    completedCount: number;
    errorLabel: string;
    errorCount: number;
    columns: ExcelUploadColumn[];
    rows: ExcelUploadRow[];
    totalLabel: string;
    tableMinWidthPx: number;
}) {
    return (
        <div className="flex min-w-0 flex-1 flex-col">
            {/* Summary chips */}
            <div className="flex shrink-0 items-center justify-end gap-5 px-5 py-2.5">
                <span className="inline-flex items-center gap-1.5 text-wb-13 font-medium text-[#04662e]">
                    {completedLabel}
                    <span>{completedCount}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-wb-13 font-medium text-[#cb0d0d]">
                    {errorLabel}
                    <span>{errorCount}</span>
                </span>
            </div>

            {/* Table area — three sibling tables sharing one colgroup
               so columns align across header / body / footer regardless
               of row count. Header pinned at top (natural ~40 px), body
               wrapper takes flex-1 (vertical scroll only), footer
               pinned at bottom by being the last flex child. The outer
               wrapper owns the shared horizontal scroll.

               Sizing: `flex-1` makes the area expand to fill the right
               panel's remaining height so the Total footer hugs the
               bottom of the preview region (just above the modal's
               Cancel / Upload row) — without this the area was a fixed
               450 px and the Total floated mid-modal whenever the LEFT
               panel grew taller (e.g. with `optionsStep`).
               `min-h-[450px]` preserves the original 450 px floor so
               flows where the right panel is the tallest column
               (Chart of Accounts) keep their existing layout. */}
            <div className="custom-scrollbar-x flex min-h-[450px] flex-1 flex-col overflow-x-auto overflow-y-hidden">
                <div
                    className="flex min-h-0 flex-1 flex-col"
                    style={{ minWidth: `${tableMinWidthPx}px` }}
                >
                    {/* Header table */}
                    <table className="w-full table-fixed border-collapse">
                        <SharedColgroup columns={columns} />
                        <TableHeader>
                            <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                {columns.map((col) => (
                                    <UploadHeaderCell
                                        key={col.id}
                                        required={col.required}
                                        align={col.align}
                                    >
                                        {col.label}
                                    </UploadHeaderCell>
                                ))}
                            </TableRow>
                        </TableHeader>
                    </table>

                    {/* Body — flex-1, vertical scroll only. */}
                    <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                        <table className="w-full table-fixed border-collapse">
                            <SharedColgroup columns={columns} />
                            <TableBody>
                                {rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        className="border-b border-wb-table-border last:border-b-0"
                                    >
                                        {columns.map((col) => {
                                            const cell =
                                                row.cells[col.id] ?? { value: null };
                                            return (
                                                <UploadBodyCell
                                                    key={col.id}
                                                    cell={cell}
                                                    align={col.align}
                                                />
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </table>
                    </div>

                    {/* Footer table — Total row pinned at bottom by
                       being the last flex child. */}
                    <table className="w-full table-fixed border-collapse">
                        <SharedColgroup columns={columns} />
                        <tfoot>
                            <tr className="h-12 border-t border-wb-table-border bg-wb-bg-card">
                                <td
                                    colSpan={columns.length}
                                    className="bg-wb-bg-card px-2.5 py-4 text-wb-13 font-medium text-wb-dark"
                                >
                                    {totalLabel}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}

/**
 * Shared `<colgroup>` rendered identically in all three sibling
 * tables. Inline `style={{ width: ... }}` is used on each `<col>`
 * because column widths come from per-feature config (props), not
 * from a Tailwind safelist.
 */
function SharedColgroup({ columns }: { columns: ExcelUploadColumn[] }) {
    return (
        <colgroup>
            {columns.map((col) => (
                <col key={col.id} style={{ width: `${col.widthPx}px` }} />
            ))}
        </colgroup>
    );
}

function UploadHeaderCell({
    children,
    required,
    align = "left",
}: {
    children: React.ReactNode;
    required?: boolean;
    align?: "left" | "right";
}) {
    // Matches Settings table header standard (CLAUDE.md §3b.D /
    // Firm Banking History) — `text-wb-13 font-semibold text-wb-dark`
    // with `px-3 py-3` padding. Drop tracking-wb-tight from Settings
    // table headers per §3b.A.
    return (
        <TableHead
            className={cn(
                "whitespace-nowrap border-b border-wb-table-border bg-wb-bg-sidebar px-3 py-3 align-middle text-wb-13 font-semibold text-wb-dark",
                align === "right" ? "text-right" : "text-left",
            )}
        >
            <span className="inline-flex items-center gap-1">
                <span>
                    {children}
                    {required && <span className="text-[#e1232e]">*</span>}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/table/ico-sort.svg"
                    alt=""
                    aria-hidden
                    className="h-3 w-2 shrink-0 opacity-60"
                />
            </span>
        </TableHead>
    );
}

function UploadBodyCell({
    cell,
    align,
}: {
    cell: ExcelUploadCell;
    align?: "left" | "right";
}) {
    // Matches the canonical Settings-popup table body cell — same
    // structure used by VasAccountTable / ChartOfAccountsTable /
    // BankAccountTable: `<td className="px-3 py-3 align-middle">`
    // owns the padding + alignment, the inner `<span>` carries
    // `block truncate text-wb-13 font-medium text-wb-ink` so cell
    // text overflows with ellipsis instead of pushing the column
    // wider. No flex / h-full / items-center on the inner content —
    // the cell's natural height comes from the padded body cell,
    // not from a stretched flex child.
    //
    // Custom dark tooltip (Figma 9198:8036) surfaces the validation
    // message on hover/focus when the cell is in the error state.
    // Native `title` is intentionally NOT used. The Tooltip's
    // trigger `<span>` reuses the same `block truncate ...` class
    // chain so the error-cell DOM rhythm is identical to non-error
    // cells — only the parent `<td>` adds the red error background.
    const tipContent =
        cell.error && cell.errorMessage ? cell.errorMessage : undefined;
    const contentClassName = cn(
        "block truncate text-wb-13 font-medium text-wb-ink",
        align === "right" && "text-right",
    );
    return (
        <TableCell
            className={cn(
                "px-3 py-3 align-middle",
                align === "right" && "text-right",
                cell.error && "bg-[#ffe1e3]",
            )}
        >
            {tipContent ? (
                <Tooltip content={tipContent} className={contentClassName}>
                    {cell.value ?? " "}
                </Tooltip>
            ) : (
                <span className={contentClassName}>
                    {cell.value ?? " "}
                </span>
            )}
        </TableCell>
    );
}
