"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Info, Plus, X } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useApiData } from "@/lib/api/useApiData";
import { fetchTenantUsers } from "@/lib/api/users";
import type { ApiTenantUserRow } from "@/lib/types/api";
import { useTranslation } from "@/lib/i18n";

import AddApproverPopover from "./AddApproverPopover";
import {
    MAX_APPROVERS,
    type ApproverRow,
} from "./approverMockData";
import { validateApprovalLine } from "./schema";
import type { ApprovalLineFormValues, ApprovalLineRow } from "./types";

/**
 * Dialog mode toggles the title + footer button label, and is the
 * single switch that distinguishes Add from Update.
 */
export type ApprovalLineDialogMode = "add" | "update";

type CommonProps = {
    submitting: boolean;
    /** Save / Update handler — receives the validated form values.
     *  The host owns API calls + error surfacing; this dialog only
     *  prevents the click while a write is in flight. */
    onSubmit:   (values: ApprovalLineFormValues) => Promise<void> | void;
    onClose:    () => void;
};

type AddProps = CommonProps & {
    mode: "add";
};

type UpdateProps = CommonProps & {
    mode:        "update";
    apprLineNo:  number;
    /** Fetches the full approver chain for the dialog to seed its
     *  form values on mount. The list-row snapshot already carries
     *  the chain, but a fresh fetch ensures the dialog reflects the
     *  latest server state (matches the contacts-edit precedent). */
    loadDetail:  (apprLineNo: number) => Promise<ApprovalLineRow>;
};

type ApprovalLineDialogProps = AddProps | UpdateProps;

/**
 * Approval Line dialog — Figma 9196:11969 (Add) / 9196:11547
 * (Update). Owns the local form state (name + approver chain), Zod
 * validation gate, and the approver-picker popover; delegates the
 * actual write to the host via {@link CommonProps#onSubmit}.
 *
 * <p>Stack level 2 (parent Settings modal is L1). ESC closes only
 * this dialog. Cancel + X close without saving.
 *
 * <p>Approver picker source: today the dialog reads from the static
 * {@link APPROVER_POOL} directory. The tenant-users endpoint
 * (`GET /api/v1/users`) is a follow-up MR; backend's
 * {@code ApprovalLineService.verifyTenantLinks} will reject any
 * stub id that doesn't have an active {@code USER_BUSI_CONN_INFM}
 * link, surfacing the gap as {@code WBE_APPROVAL_LINE_APPROVER_NOT_IN_TENANT}
 * via the panel's error dialog (feature § 5.4 / OQ-1).
 */
export default function ApprovalLineDialog(props: ApprovalLineDialogProps) {
    const { t } = useTranslation();

    const [apprLineNm, setApprLineNm] = useState("");
    const [approvers, setApprovers] = useState<ApproverRow[]>([]);
    const [seedLoading, setSeedLoading] = useState(props.mode === "update");
    const [issues, setIssues] = useState<Record<string, string> | null>(null);

    /** Whether the inline "+ Add Approver" popover is open. The popover
     *  is now an absolute-positioned sibling of the trigger button
     *  (no portal, no viewport-coord math) so a boolean is enough;
     *  the anchor geometry is handled in CSS. Cleared on dismiss
     *  (outside-click / ESC / Add commit). */
    const [popoverOpen, setPopoverOpen] = useState(false);

    /* -----------------------------------------------------------------
     *  Seed values
     * ----------------------------------------------------------------- */

    useEffect(() => {
        if (props.mode !== "update") return;

        let cancelled = false;
        setSeedLoading(true);
        props.loadDetail(props.apprLineNo)
            .then((row) => {
                if (cancelled) return;
                setApprLineNm(row.apprLineNm);
                setApprovers(row.approvers);
            })
            .catch(() => {
                // The mutation hook stores the error; the host surfaces
                // it via its own catch path on the next save. We swallow
                // here so the dialog stays mounted with empty seeds
                // rather than tearing down on a network blip.
            })
            .finally(() => {
                if (!cancelled) setSeedLoading(false);
            });

        return () => {
            cancelled = true;
        };
        // Effect intentionally locks onto the props at mount — the
        // outer panel re-mounts with a fresh `key` on row change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* -----------------------------------------------------------------
     *  Approver-chain helpers
     * ----------------------------------------------------------------- */

    const handleRemove = (id: string) => {
        setApprovers((rows) => rows.filter((r) => r.id !== id));
    };

    /** Tenant-user directory — live from
     *  {@code GET /api/v1/users}. Fetched once on dialog mount;
     *  the popover does the client-side substring filter against
     *  the result. Mirrors the legacy
     *  {@code comm_0192_001_r001} ("Inquiry Approver") payload
     *  shape minus the dropped {@code CLPH_NO} / {@code ADMIN_YN} /
     *  {@code MOB_YN} fields the Approval Line picker doesn't
     *  consume (see
     *  {@code docs/refactor-wecms/migration/approval-line-add-flow-analysis.md}
     *  § 5.2). */
    const directoryQuery = useApiData(() => fetchTenantUsers(), []);
    const directory: ApproverRow[] = useMemo(
        () => (directoryQuery.data?.users ?? []).map(toApproverRow),
        [directoryQuery.data],
    );

    /** Pool of selectable approvers minus rows already in the chain
     *  so the same person can't be double-added across consecutive
     *  Add Approver opens. */
    const available = useMemo(
        () => directory.filter((poolRow) => !approvers.some((a) => a.id === poolRow.id)),
        [directory, approvers],
    );

    const remainingCapacity = Math.max(MAX_APPROVERS - approvers.length, 0);
    const addApproverDisabled =
        approvers.length >= MAX_APPROVERS || available.length === 0;

    function handleTogglePopover() {
        setPopoverOpen((open) => !open);
    }

    function handlePopoverAdd(rows: ApproverRow[]) {
        setApprovers((prev) => [...prev, ...rows].slice(0, MAX_APPROVERS));
        setPopoverOpen(false);
    }

    /* -----------------------------------------------------------------
     *  Submit
     * ----------------------------------------------------------------- */

    const handleSave = async () => {
        const values: ApprovalLineFormValues = {
            apprLineNm: apprLineNm.trim(),
            approvers,
        };
        const result = validateApprovalLine(values);
        if (result) {
            const map: Record<string, string> = {};
            for (const issue of result) map[issue.path] = issue.key;
            setIssues(map);
            return;
        }
        setIssues(null);
        await props.onSubmit(values);
    };

    /* -----------------------------------------------------------------
     *  Labels
     * ----------------------------------------------------------------- */

    const titleKey =
        props.mode === "update"
            ? "settings.approval_line.update_dialog.title"
            : "settings.approval_line.add_dialog.title";
    const primaryButtonKey =
        props.mode === "update"
            ? "settings.approval_line.update_dialog.update"
            : "settings.approval_line.add_dialog.save";

    const nameIssueKey = issues?.["apprLineNm"];
    const approversIssueKey = issues?.["approvers"];

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) props.onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                hideClose
                aria-describedby={undefined}
                className="max-w-[880px] rounded-2xl p-0"
            >
                {/* Header — title + Esc badge + custom X close. */}
                <div className="flex shrink-0 items-center gap-1 border-b border-wb-border-sidebar p-5">
                    <DialogTitle asChild>
                        <h2 className="flex-1 text-wb-16 font-semibold leading-[22.9px] tracking-wb-tight text-wb-dark">
                            {t(titleKey)}
                        </h2>
                    </DialogTitle>
                    <span className="rounded bg-wb-ntrl-3 px-1 py-px text-wb-13 font-medium text-wb-ntrl-6">
                        {t("settings.esc")}
                    </span>
                    <button
                        type="button"
                        onClick={props.onClose}
                        aria-label={t("settings.close")}
                        className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                    >
                        <X className="size-[18px]" strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex min-h-0 flex-1 flex-col p-5 pt-0">
                    {/* Approval-line name input — borderless hero. */}
                    <div className="border-b border-wb-ntrl-3 pb-3 pt-5">
                        <input
                            type="text"
                            value={apprLineNm}
                            onChange={(e) => setApprLineNm(e.target.value)}
                            placeholder={t(
                                "settings.approval_line.add_dialog.name_placeholder",
                            )}
                            aria-label={t(
                                "settings.approval_line.add_dialog.name_placeholder",
                            )}
                            aria-invalid={nameIssueKey !== undefined}
                            disabled={seedLoading || props.submitting}
                            className="w-full bg-transparent text-wb-24 font-semibold text-wb-dark caret-[#0f1fea] outline-none placeholder:text-wb-ntrl-6 placeholder:opacity-60 disabled:opacity-60"
                        />
                        {nameIssueKey && (
                            <p className="mt-2 text-wb-12 font-medium text-wb-red-07">
                                {t(nameIssueKey)}
                            </p>
                        )}
                    </div>

                    {/* Add Approver action — right-aligned default chip.
                       The button + the inline popover share a `relative`
                       wrapper so the popover anchors via CSS
                       (`absolute right-0 top-full`) without portal +
                       viewport-coord math. Keeps the popover inside
                       the Radix focus scope (input remains focusable)
                       AND inside DialogContent's `overflow-hidden`
                       clip rect (popover never escapes the modal). */}
                    <div className="flex items-center justify-end py-3">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={handleTogglePopover}
                                disabled={addApproverDisabled || seedLoading || props.submitting}
                                aria-haspopup="dialog"
                                aria-expanded={popoverOpen}
                                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Plus className="size-4" strokeWidth={2} aria-hidden />
                                {t("settings.approval_line.add_dialog.add_approver")}
                            </button>
                            {popoverOpen && (
                                <AddApproverPopover
                                    available={available}
                                    capacity={remainingCapacity}
                                    onClose={() => setPopoverOpen(false)}
                                    onAdd={handlePopoverAdd}
                                />
                            )}
                        </div>
                    </div>

                    {/* Table region */}
                    <div className="custom-scrollbar-y h-[266px] overflow-y-auto">
                        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-wb-bg-sidebar px-2.5 py-[9px]">
                            <div className="flex items-center gap-1.5">
                                <GripVertical
                                    className="size-4 shrink-0 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                    aria-hidden
                                />
                                <span className="text-wb-13 font-medium text-wb-ntrl-6">
                                    {t("settings.approval_line.add_dialog.drag_hint")}
                                </span>
                            </div>
                        </div>

                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col style={{ width: "32px" }} />
                                <col style={{ width: "44px" }} />
                                <col />
                                <col />
                                <col />
                                <col style={{ width: "104px" }} />
                            </colgroup>

                            <thead className="sticky top-[34px] z-10">
                                <tr className="h-10 border-y border-wb-table-border bg-wb-bg-card">
                                    <th className="bg-wb-bg-card" aria-hidden />
                                    <th className="bg-wb-bg-card px-2 py-3 text-center text-wb-13 font-medium text-wb-dark">
                                        #
                                    </th>
                                    <th className="bg-wb-bg-card py-3 pr-2.5 text-left text-wb-13 font-medium text-wb-dark">
                                        {t("settings.approval_line.add_dialog.col.name")}
                                    </th>
                                    <th className="bg-wb-bg-card py-3 pr-2.5 text-left text-wb-13 font-medium text-wb-dark">
                                        {t("settings.approval_line.add_dialog.col.position")}
                                    </th>
                                    <th className="bg-wb-bg-card py-3 pr-2.5 text-left text-wb-13 font-medium text-wb-dark">
                                        {t("settings.approval_line.add_dialog.col.department")}
                                    </th>
                                    <th
                                        className="bg-wb-bg-card"
                                        aria-label={t(
                                            "settings.approval_line.add_dialog.col.actions",
                                        )}
                                    />
                                </tr>
                            </thead>

                            <tbody>
                                {approvers.length === 0 ? (
                                    // Empty state — 4 ghost rows so the
                                    // table area keeps its height per
                                    // Figma 9196:11969.
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <tr
                                            key={`empty-${i}`}
                                            className="h-12 border-b border-wb-table-border last:border-b-0"
                                        >
                                            <td colSpan={6} />
                                        </tr>
                                    ))
                                ) : (
                                    approvers.map((row, i) => (
                                        <tr
                                            key={row.id}
                                            className="h-12 border-b border-wb-table-border"
                                        >
                                            <td className="px-2 align-middle">
                                                <button
                                                    type="button"
                                                    aria-label={t(
                                                        "settings.approval_line.add_dialog.drag_aria",
                                                        { name: row.name },
                                                    )}
                                                    className="flex size-4 cursor-grab items-center justify-center text-wb-ntrl-6"
                                                >
                                                    <GripVertical
                                                        className="size-4"
                                                        strokeWidth={1.8}
                                                        aria-hidden
                                                    />
                                                </button>
                                            </td>
                                            <td className="px-2 py-2.5 text-center align-middle text-wb-13 font-medium text-wb-ink">
                                                {i + 1}
                                            </td>
                                            <td className="py-2.5 pr-2.5 align-middle">
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.name}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5 align-middle">
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.position}
                                                </span>
                                            </td>
                                            <td className="py-2.5 pr-2.5 align-middle">
                                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                    {row.department}
                                                </span>
                                            </td>
                                            <td className="px-2.5 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemove(row.id)}
                                                    disabled={props.submitting}
                                                    aria-label={t(
                                                        "settings.approval_line.add_dialog.remove_aria",
                                                        { name: row.name },
                                                    )}
                                                    className="inline-flex h-7 cursor-pointer items-center rounded-[4px] border border-wb-red-04 bg-white px-1.5 text-wb-12 font-medium tracking-wb-tight text-wb-red-07 shadow-wb-warning-btn hover:bg-wb-red-04/10 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {t("settings.approval_line.add_dialog.remove")}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {approversIssueKey && (
                        <p className="pt-2 text-wb-12 font-medium text-wb-red-07">
                            {t(approversIssueKey)}
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between gap-4 border-t border-wb-border-sidebar px-5 py-4">
                    <div className="flex items-center gap-1">
                        <span className="rounded-md bg-brand-soft px-1.5 py-1 text-wb-13 font-medium leading-none text-brand-hover">
                            {t("settings.approval_line.add_dialog.count", {
                                current: String(approvers.length),
                                max: String(MAX_APPROVERS),
                            })}
                        </span>
                        <span className="text-wb-13 font-medium text-wb-ink">
                            {t("settings.approval_line.add_dialog.approvers_assigned")}
                        </span>
                        <Info
                            className="size-4 shrink-0 text-wb-dark"
                            strokeWidth={1.8}
                            aria-hidden
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={props.onClose}
                            disabled={props.submitting}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("settings.approval_line.add_dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={props.submitting || seedLoading}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t(primaryButtonKey)}
                        </button>
                    </div>
                </div>

                {/* Note: the Add Approver popover is rendered inline
                   inside the trigger's `relative` wrapper above —
                   keeps it inside Radix's focus scope so the search
                   input is focusable. */}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Wire → in-memory mapping for the tenant-user picker. Empty
 * {@code posi_nm} / {@code dept_nm} (DEV returns NULL on rows
 * where the legacy {@code USER_INFM} columns aren't populated)
 * collapse to {@code ""} so component code can render the fields
 * without null guards. {@code user_img_url} is preserved as-is —
 * undefined when the backend ships null.
 */
function toApproverRow(wire: ApiTenantUserRow): ApproverRow {
    return {
        id:         wire.user_id,
        name:       wire.user_nm,
        position:   wire.posi_nm ?? "",
        department: wire.dept_nm ?? "",
        userImgUrl: wire.user_img_url ?? undefined,
    };
}
