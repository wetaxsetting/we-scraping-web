"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchApprovalLines } from "@/lib/api/approvalLine";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type EditApprovalLinePreview = {
    apprLineNo:  number;
    apprLineNm:  string;
    approvers:   { apprvrId: string; apprvrNm: string }[];
};

type EditApprovalLinePickerProps = {
    /** Currently picked line — drives the trigger label. */
    value:    number | null;
    onPick:   (line: EditApprovalLinePreview) => void;
};

/**
 * Inline "Select approval line" dropdown rendered next to the
 * "Approver (X/Y)" label on the shared {@link ApprovalDetailsDialog}
 * when the kebab "Edit" action is active. Visual chrome mirrors the
 * {@code <ChipSelect>} used on
 * {@link import("@/components/payment/shared/RequestApprovalDialog").default}
 * ({@code comm_0195_001.ts:225} `btn_edit` click +
 * {@code comm_0222_003} approval-line picker, scoped to a single swap).
 */
export default function EditApprovalLinePicker({
    value,
    onPick,
}: EditApprovalLinePickerProps) {
    const { t } = useTranslation();

    const [open, setOpen] = useState(false);
    const ref             = useRef<HTMLDivElement>(null);

    const state = useApiData(() => fetchApprovalLines({}), []);
    const lines = state.data?.approval_lines ?? [];

    const current = lines.find((l) => l.appr_line_no === value) ?? null;

    // Close on outside click / ESC — same UX as the
    // RequestApprovalDialog ChipSelect.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClick);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [open]);

    const display = current?.appr_line_nm
        ?? t("payment.card.approval_detail.edit_picker.placeholder");

    return (
        <div ref={ref} className="relative inline-block w-55">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-[var(--h-wb-filter-btn)] w-full cursor-pointer items-center justify-between gap-2 overflow-clip rounded-md border-0 bg-white px-3 shadow-wb-btn"
            >
                <span
                    className={cn(
                        "truncate text-wb-13 font-medium",
                        current ? "text-wb-ink" : "text-wb-ntrl-5",
                    )}
                >
                    {display}
                </span>
                <ChevronDown className="size-4 shrink-0 text-wb-ntrl-6" strokeWidth={1.8} />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-full overflow-y-auto overflow-x-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
                >
                    {state.loading && (
                        <li className="px-3 py-2 text-wb-13 text-wb-muted">
                            {t("common.loading")}
                        </li>
                    )}
                    {!state.loading && lines.length === 0 && (
                        <li className="px-3 py-2 text-wb-13 text-wb-muted">
                            {t("payment.card.approval_detail.edit_picker.empty")}
                        </li>
                    )}
                    {!state.loading && lines.map((line) => {
                        const isSel = value === line.appr_line_no;
                        return (
                            <li
                                key={line.appr_line_no}
                                role="option"
                                aria-selected={isSel}
                                onClick={() => {
                                    onPick({
                                        apprLineNo: line.appr_line_no,
                                        apprLineNm: line.appr_line_nm,
                                        approvers:  line.approvers.map((a) => ({
                                            apprvrId: a.apprvr_id,
                                            apprvrNm: a.apprvr_nm,
                                        })),
                                    });
                                    setOpen(false);
                                }}
                                className={cn(
                                    "cursor-pointer px-3 py-2 text-wb-13 font-medium text-wb-ink hover:bg-neutral-100",
                                    isSel && "bg-brand-soft text-brand",
                                )}
                            >
                                {line.appr_line_nm}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
