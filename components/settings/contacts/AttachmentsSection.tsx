"use client";

import { Download, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
        event.target.value = "";

        const accepted: File[] = [];
        for (const f of Array.from(picked)) {
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

    const isEmpty = useMemo(
        () =>
            (mode === "add" ? stagedFiles.length : existingFiles.length) === 0,
        [mode, stagedFiles.length, existingFiles.length],
    );

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                    {t("settings.contacts.attachments.label")}
                </span>
                <button
                    type="button"
                    onClick={triggerPicker}
                    disabled={busy}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.contacts.attachments.add")}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept={Array.from(ALLOWED_EXTENSIONS).map((e) => `.${e}`).join(",")}
                    onChange={handlePicked}
                />
            </div>

            <p className="text-wb-12 font-medium text-wb-ntrl-6">
                {t("settings.contacts.attachments.help", { size: "10 MB" })}
            </p>

            {isEmpty ? (
                <div className="rounded-md border border-dashed border-wb-table-border bg-white px-3 py-4 text-center text-wb-13 font-medium text-wb-ntrl-6">
                    {t("settings.contacts.attachments.empty")}
                </div>
            ) : (
                <ul className="flex flex-col gap-1">
                    {mode === "add"
                        ? stagedFiles.map((f, idx) => (
                            <li
                                key={`staged-${idx}-${f.name}`}
                                className="flex items-center gap-2 rounded-md border border-wb-table-border bg-white px-3 py-2"
                            >
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                                        {f.name}
                                    </span>
                                    <span className="text-wb-12 font-medium text-wb-ntrl-6">
                                        {formatBytes(f.size)}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    aria-label={t("settings.contacts.attachments.remove")}
                                    onClick={() => removeStaged(idx)}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
                                >
                                    <Trash2 className="size-3.5" strokeWidth={2} />
                                </button>
                            </li>
                        ))
                        : existingFiles.map((row) => (
                            <li
                                key={`file-${row.file_id}`}
                                className="flex items-center gap-2 rounded-md border border-wb-table-border bg-white px-3 py-2"
                            >
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-wb-13 font-medium text-wb-ink">
                                        {row.org_file_nm}
                                    </span>
                                    <span className="text-wb-12 font-medium text-wb-ntrl-6">
                                        {row.trco_infm_titl}
                                        {row.file_size ? ` · ${formatBytes(Number(row.file_size))}` : ""}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    aria-label={t("settings.contacts.attachments.download")}
                                    onClick={() => handleDownload(row)}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
                                >
                                    <Download className="size-3.5" strokeWidth={2} />
                                </button>
                                <button
                                    type="button"
                                    aria-label={t("settings.contacts.attachments.remove")}
                                    onClick={() => handleDeleteExisting(row.file_id)}
                                    disabled={busy}
                                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Trash2 className="size-3.5" strokeWidth={2} />
                                </button>
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
}

function extensionOf(name: string): string | null {
    const dot = name.lastIndexOf(".");
    if (dot < 0 || dot === name.length - 1) return null;
    return name.slice(dot + 1).toLowerCase();
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
