"use client";

import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AddPurposeDraft = { code: string; name: string; description: string };

type AddPurposeRowProps = {
    onCancel: () => void;
    onSave: (draft: AddPurposeDraft) => void;
    saving?: boolean;
};

/**
 * Single inline "Add Purpose" row (legacy comm_0187_001 `new_purpose`).
 *
 * Appended below the view-mode table when the user clicks "+ Add
 * Purpose". Unlike the bulk Edit mode, it does NOT turn the existing
 * rows into inputs — only this one row is editable, and it carries its
 * own Cancel / Save. Column widths mirror the view-mode table (no
 * leading drag gutter) so the Code / Purpose inputs sit under their
 * headers; the Description input flexes and the buttons pin right.
 */
export default function AddPurposeRow({ onCancel, onSave, saving }: AddPurposeRowProps) {
    const { t } = useTranslation();
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const canSave = code.trim() !== "" && name.trim() !== "" && !saving;

    const inputCls =
        "h-8 w-full rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-13 font-medium text-wb-ink outline-none focus:border-brand focus:shadow-wb-focus";

    return (
        <div className="flex h-12 items-center border-b border-wb-table-border bg-white">
            <div className="w-[180px] px-3">
                <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    aria-label={t("settings.purpose.col.code")}
                    placeholder={t("settings.purpose.form.code_placeholder")}
                    className={inputCls}
                />
            </div>
            <div className="w-[280px] px-3">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-label={t("settings.purpose.col.name")}
                    placeholder={t("settings.purpose.form.name_placeholder")}
                    className={inputCls}
                />
            </div>
            <div className="min-w-0 flex-1 px-3">
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    aria-label={t("settings.purpose.col.description")}
                    placeholder={t("settings.purpose.form.description_placeholder")}
                    className={inputCls}
                />
            </div>
            <div className="flex items-center gap-2 pr-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                >
                    {t("dialog.cancel")}
                </button>
                <button
                    type="button"
                    disabled={!canSave}
                    onClick={() => onSave({ code, name, description })}
                    className={cn(
                        "flex h-8 items-center rounded-md px-3 text-wb-14-tight font-medium text-white",
                        canSave
                            ? "cursor-pointer bg-brand shadow-wb-brand-btn hover:bg-brand-hover"
                            : "cursor-not-allowed bg-wb-ntrl-4",
                    )}
                >
                    {t("dialog.save")}
                </button>
            </div>
        </div>
    );
}
