"use client";

import { Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
    AttachmentCountDropdown,
    type AttachmentItem,
} from "@/components/shared/attachment/AttachmentCountDropdown";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { downloadFile } from "@/lib/file";
import { useTranslation } from "@/lib/i18n";
import type { ApiContactFileRow } from "@/lib/types/api";

import { useContactsMutations } from "./useContacts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "gif",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
]);

export type AttachmentsSectionProps = {
    /**
     * `add` — files stage locally; parent uploads them sequentially
     * after Create succeeds. `edit` — files load on mount + upload /
     * delete fire immediately against the backend.
     */
    mode: "add" | "edit";
    /** Required in `edit` mode — backend identity for each call. */
    trcoKey?: string;
    /** Add mode — staged files held by parent so they can be uploaded
     *  after Create resolves the new {@code trcoKey}. */
    stagedFiles?: File[];
    onStagedChange?: (next: File[]) => void;
};

/**
 * Attachments section embedded inside the Add / Edit Contact dialog.
 * Mirrors the legacy Settings &gt; Contacts &gt; Attachments
 * sub-popup behaviour ({@code comm_0184_002_c001} write paths) over
 * the refactor's slug-named endpoints.
 *
 * <p><b>Limits.</b> 10 MB per file, container also caps the request
 * at 50 MB (multipart settings in {@code application.yml}). The
 * allow-list mirrors the backend: jpg / jpeg / png / gif / pdf /
 * doc / docx / xls / xlsx / ppt / pptx.
 *
 * <p><b>Title defaults.</b> No title input on the wire — the server
 * stamps {@code "Business Registration"} on the first file and
 * {@code "New document"} on every subsequent file. The frontend
 * therefore never asks the user for a title.
 */
export function AttachmentsSection({
    mode,
    trcoKey,
    stagedFiles = [],
    onStagedChange,
}: AttachmentsSectionProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const mutations = useContactsMutations();
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [existingFiles, setExistingFiles] = useState<ApiContactFileRow[]>([]);
    const [busy, setBusy] = useState(false);
    /** Floating "Attachments (n)" dropdown visibility — opens upward so it
     *  never overlaps the dialog footer. */
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Edit mode — load the file list on mount.
    useEffect(() => {
        if (mode !== "edit" || !trcoKey) return;
        let cancelled = false;
        (async () => {
            try {
                const rows = await mutations.listFiles(trcoKey);
                if (!cancelled) setExistingFiles(rows);
            } catch {
                // Hook already surfaced the error envelope; leave the
                // list empty so the user can still attempt an upload.
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, trcoKey]);

    const triggerPicker = () => fileInputRef.current?.click();

    const handlePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const picked = event.target.files;
        if (!picked || picked.length === 0) return;
        // Snapshot the FileList BEFORE resetting the input. `event.target.files`
        // is a live reference to the input's internal list — assigning
        // `event.target.value = ""` (so the user can re-pick the same
        // filename later) clears that list as a side effect, and any
        // previously-captured reference reads as length 0. Without the
        // snapshot, `Array.from(picked)` below would iterate zero files,
        // `accepted` would stay empty, and the staged list would never
        // update.
        const snapshot = Array.from(picked);
        event.target.value = "";

        const accepted: File[] = [];
        for (const f of snapshot) {
            const ext = extensionOf(f.name);
            if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t(
                        "settings.contacts.attachments.error.extension",
                        { exts: Array.from(ALLOWED_EXTENSIONS).join(", ") },
                    ),
                });
                return;
            }
            if (f.size <= 0) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.contacts.attachments.error.empty"),
                });
                return;
            }
            if (f.size > MAX_FILE_BYTES) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.contacts.attachments.error.too_large", {
                        size: "10 MB",
                    }),
                });
                return;
            }
            accepted.push(f);
        }
        if (accepted.length === 0) return;

        if (mode === "add") {
            onStagedChange?.([...stagedFiles, ...accepted]);
            return;
        }
        if (!trcoKey) return;
        setBusy(true);
        try {
            for (const f of accepted) {
                const row = await mutations.uploadFile(trcoKey, f);
                setExistingFiles((prev) => [...prev, row]);
            }
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
        } finally {
            setBusy(false);
        }
    };

    const removeStaged = (index: number) => {
        if (!onStagedChange) return;
        const next = stagedFiles.slice();
        next.splice(index, 1);
        onStagedChange(next);
    };

    const handleDeleteExisting = async (fileId: string) => {
        if (mode !== "edit" || !trcoKey) return;
        setBusy(true);
        try {
            await mutations.deleteFile(trcoKey, fileId);
            setExistingFiles((prev) => prev.filter((r) => r.file_id !== fileId));
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
        } finally {
            setBusy(false);
        }
    };

    const handleDownload = async (row: ApiContactFileRow) => {
        if (!trcoKey) return;
        try {
            await downloadFile(
                mutations.fileDownloadUrl(trcoKey, row.file_id),
                row.org_file_nm,
            );
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
        }
    };

    // Files driving the "Attachments (n)" dropdown — staged (add) or
    // already-persisted (edit). The dropdown row shows the file-type icon
    // + name + a red circular X (delete); edit mode also exposes the
    // per-row download glyph.
    const dropdownFiles = useMemo<AttachmentItem[]>(
        () =>
            mode === "add"
                ? stagedFiles.map((f) => ({ name: f.name }))
                : existingFiles.map((r) => ({ name: r.org_file_nm })),
        [mode, stagedFiles, existingFiles],
    );

    return (
        <div className="flex min-h-8 flex-wrap items-center gap-2.5">
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept={Array.from(ALLOWED_EXTENSIONS).map((e) => `.${e}`).join(",")}
                onChange={handlePicked}
            />
            <button
                type="button"
                onClick={triggerPicker}
                disabled={busy}
                className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-14 font-medium text-wb-dark hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
            >
                <Paperclip className="size-4" strokeWidth={1.6} aria-hidden />
                {t("settings.contacts.attachments.attach")}
            </button>

            {dropdownFiles.length > 0 && (
                <AttachmentCountDropdown
                    files={dropdownFiles}
                    open={dropdownOpen}
                    onToggle={() => setDropdownOpen((v) => !v)}
                    countLabel={t("settings.contacts.attachments.count", {
                        count: String(dropdownFiles.length),
                    })}
                    onRemove={(i) =>
                        mode === "add"
                            ? removeStaged(i)
                            : handleDeleteExisting(existingFiles[i]?.file_id ?? "")
                    }
                    removeLabel={t("settings.contacts.attachments.remove")}
                    removeVariant="clear"
                    onDownload={
                        mode === "edit"
                            ? (i) => {
                                const row = existingFiles[i];
                                if (row) void handleDownload(row);
                            }
                            : undefined
                    }
                    downloadLabel={t("settings.contacts.attachments.download")}
                />
            )}
        </div>
    );
}

function extensionOf(name: string): string | null {
    const dot = name.lastIndexOf(".");
    if (dot < 0 || dot === name.length - 1) return null;
    return name.slice(dot + 1).toLowerCase();
}
