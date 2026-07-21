"use client";

import {
    ChevronDown,
    ChevronUp,
    Download,
    FileArchive,
    File as FileIcon,
    FileImage,
    FileSpreadsheet,
    FileText,
    Presentation,
    X,
} from "lucide-react";

import DeleteIcon from "@/components/shared/icons/DeleteIcon";
import { cn } from "@/lib/utils";

/* ============================================================================
 *  Shared attachment UI — one implementation for every WeCMS attachment
 *  surface (Request Approval footer, New Receipt modal, and — once the wire
 *  carries file metadata — the saved-receipt list). Lifted verbatim from the
 *  Request Approval / Approval Details footer attachment list so every
 *  surface renders identical glyphs, spacing, shadow, and hover.
 *
 *  Matches Figma 770:22631 (Attachment_dropdown): white card, rounded-6,
 *  soft popup shadow, compact width, 32px rows with file-type icon + name.
 * ========================================================================== */

/** File-type icon by extension — same lucide glyphs + colors as the legacy
 *  Request Approval / Approval Details `FileTypeIcon`. */
export function FileTypeIcon({ name, className }: { name: string; className?: string }) {
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    const base = cn("shrink-0", className);
    if (ext === "xls" || ext === "xlsx" || ext === "csv")
        return <FileSpreadsheet className={cn(base, "text-green-600")} strokeWidth={1.8} />;
    if (ext === "doc" || ext === "docx")
        return <FileText className={cn(base, "text-blue-600")} strokeWidth={1.8} />;
    if (ext === "pdf")
        return <FileText className={cn(base, "text-red-600")} strokeWidth={1.8} />;
    if (ext === "ppt" || ext === "pptx")
        return <Presentation className={cn(base, "text-orange-500")} strokeWidth={1.8} />;
    if (["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"].includes(ext))
        return <FileImage className={cn(base, "text-sky-500")} strokeWidth={1.8} />;
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext))
        return <FileArchive className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
    if (ext === "txt")
        return <FileText className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
    return <FileIcon className={cn(base, "text-wb-ntrl-6")} strokeWidth={1.8} />;
}

export type AttachmentItem = { name: string };

/** Split a filename into base + dotted extension so the extension stays
 *  visible even when the base truncates — matches the Figma
 *  Attachment_dropdown rows (`Loan_docu… .xlsx`). Returns an empty `ext`
 *  for dotfiles / extension-less names so nothing is dropped. */
function splitFileName(name: string): { base: string; ext: string } {
    const dot = name.lastIndexOf(".");
    if (dot <= 0 || dot === name.length - 1) return { base: name, ext: "" };
    return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * "Attachment(s) (N)" count toggle + floating file-list dropdown.
 *
 * - `onClear` → renders a red trash icon *beside* the count (Figma New
 *   Receipt frame — clears the whole selection).
 * - `onRemove` → renders a per-row remove affordance *inside* the
 *   dropdown. `removeVariant` selects the glyph: `"trash"` (default —
 *   Request Approval / Approval Details lucide trash) or `"clear"` (a
 *   filled red circular X matching the Figma `ico_clear`, used by the
 *   Add/Edit Contact dialog).
 * - `onDownload` → renders a per-row download glyph *before* the remove
 *   affordance (used by surfaces that list already-persisted files, e.g.
 *   the Edit Contact attachment list).
 *
 * Pass whichever affordance the design calls for (or several). `direction`
 * defaults to `"up"` so the popover opens above the trigger and never
 * overlaps a modal footer.
 */
export function AttachmentCountDropdown({
    files,
    open,
    onToggle,
    countLabel,
    onClear,
    onRemove,
    onDownload,
    clearLabel,
    removeLabel,
    downloadLabel,
    removeVariant = "trash",
    direction = "up",
    className,
}: {
    files:          AttachmentItem[];
    open:           boolean;
    onToggle:       () => void;
    countLabel:     string;
    onClear?:       () => void;
    onRemove?:      (index: number) => void;
    onDownload?:    (index: number) => void;
    clearLabel?:    string;
    removeLabel?:   string;
    downloadLabel?: string;
    removeVariant?: "trash" | "clear";
    direction?:     "up" | "down";
    className?:     string;
}) {
    return (
        <div className={cn("flex items-center gap-1", className)}>
            <div className="relative">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    className="inline-flex cursor-pointer items-center gap-1 text-wb-14-tight font-medium text-brand hover:underline"
                >
                    {countLabel}
                    {open ? (
                        <ChevronUp className="size-3.5" strokeWidth={1.8} aria-hidden />
                    ) : (
                        <ChevronDown className="size-3.5" strokeWidth={1.8} aria-hidden />
                    )}
                </button>
                {open && files.length > 0 && (
                    <div
                        className={cn(
                            "custom-scrollbar-y absolute left-0 z-50 flex max-h-60 min-w-[260px] flex-col gap-0.5 overflow-y-auto rounded-md bg-white p-1 shadow-wb-popup",
                            direction === "up" ? "bottom-full mb-2" : "top-full mt-2",
                        )}
                    >
                        {files.map((f, i) => {
                            const { base, ext } = splitFileName(f.name);
                            return (
                                <div
                                    key={`${f.name}-${i}`}
                                    className="flex h-8 items-center gap-2.5 rounded-md px-2 hover:bg-wb-bg-sidebar"
                                >
                                    <FileTypeIcon name={f.name} className="size-4" />
                                    <span className="flex min-w-0 flex-1 items-center gap-1 text-wb-13 font-medium text-wb-ink">
                                        <span className="min-w-0 flex-1 truncate">{base}</span>
                                        {ext && <span className="shrink-0">{ext}</span>}
                                    </span>
                                    {onDownload && (
                                        <button
                                            type="button"
                                            onClick={() => onDownload(i)}
                                            aria-label={downloadLabel}
                                            className="shrink-0 cursor-pointer text-wb-ntrl-6 hover:text-wb-ink"
                                        >
                                            <Download className="size-3.5" strokeWidth={1.8} aria-hidden />
                                        </button>
                                    )}
                                    {onRemove && (
                                        <button
                                            type="button"
                                            onClick={() => onRemove(i)}
                                            aria-label={removeLabel}
                                            className="shrink-0 cursor-pointer"
                                        >
                                            {removeVariant === "clear" ? (
                                                <span className="flex size-4 items-center justify-center rounded-full bg-wb-red-07 hover:opacity-80">
                                                    <X className="size-2.5 text-white" strokeWidth={3} aria-hidden />
                                                </span>
                                            ) : (
                                                <DeleteIcon className="size-3.5 text-wb-status-rejected-text hover:opacity-80" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            {onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label={clearLabel}
                    className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-wb-status-rejected-text hover:bg-black/5"
                >
                    <DeleteIcon className="size-4" />
                </button>
            )}
        </div>
    );
}
