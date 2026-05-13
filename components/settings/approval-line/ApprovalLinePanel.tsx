"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { Input } from "@/components/ui/input";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import type { FetchApprovalLinesParams } from "@/lib/api/approvalLine";
import { useTranslation } from "@/lib/i18n";

import ApprovalLineDialog from "./ApprovalLineDialog";
import ApprovalLineTable from "./ApprovalLineTable";
import type { ApprovalLineRow } from "./types";
import {
    useApprovalLineList,
    useApprovalLineMutations,
} from "./useApprovalLine";

/**
 * Discriminated dialog state — `null` keeps it closed, `{ mode: "add" }`
 * opens the empty Add dialog, `{ mode: "update", row }` seeds the
 * Update dialog with the row's id (the dialog fetches full detail on
 * mount via `useApprovalLineMutations.loadDetail`).
 */
type DialogState =
    | { mode: "add" }
    | { mode: "update"; row: ApprovalLineRow };

/**
 * Approval Line panel — Settings popup submenu (Figma 9196:11717).
 *
 * <p>Wired to the Spring `/api/v1/settings/approval-line` endpoints.
 * Search filters client-side (no server-side pagination — feature
 * § 4.3 / OQ-3). Add / Edit / Delete round-trip to the backend;
 * errors funnel through {@link useDialog} so every code is surfaced
 * with the standard error chrome + trace id.
 *
 * <p>The dialog at {@link ApprovalLineDialog} owns the form
 * lifecycle; this panel only routes "row clicked Edit" / "row
 * clicked Delete" gestures + invalidates the list after a successful
 * mutation.
 */
export default function ApprovalLinePanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [keyword, setKeyword] = useState("");
    const [dialogState, setDialogState] = useState<DialogState | null>(null);

    // No server-side search — the list endpoint returns the whole
    // tenant set (feature § 4.3) and the panel filters by name in
    // memory. `params` stays empty so the hook fires exactly once on
    // mount.
    const params = useMemo<FetchApprovalLinesParams>(() => ({}), []);

    const { rows, initialLoading, error, refetch } = useApprovalLineList(params);
    const mutations = useApprovalLineMutations();

    // Common table-sort cycle (default → ASC → DESC → default). Sort is
    // client-side because the panel already runs unpaginated (feature
    // § 4.3 / OQ-3) and the search filter above is also client-side —
    // keeping sort local keeps the panel's data lifecycle consistent.
    // FIELD_IDs match the View Setting semantic convention; "APPRVR_NM"
    // sorts on the primary approver only (the chain itself stays
    // server-ordered by `apprvr_disp_ord ASC`).
    const { sortField, sortDirection, toggleSort } = useTableSort();

    // Tracks which row's approver-list popover is currently open. Single
    // id hoisted here so opening row B auto-closes row A — toggling the
    // SAME id closes (close-on-second-click semantics). The table
    // component renders the popover inside the matching row's cell.
    const [openApproversRowId, setOpenApproversRowId] = useState<number | null>(null);
    const handleToggleApprovers = (id: number | null) => {
        setOpenApproversRowId((prev) => {
            if (id === null) return null;
            return prev === id ? null : id;
        });
    };

    // Surface list-fetch failures via the shared error dialog. Mirrors
    // the contacts pattern at ContactsPanel.tsx.
    useEffect(() => {
        if (!error) return;
        dialog.open({
            type:        "error",
            title:       t("dialog.error"),
            description: error.message,
            errorCode:   error.code,
        });
    }, [error, dialog, t]);

    const filteredRows = useMemo(() => {
        const needle = keyword.trim().toLowerCase();
        const base = needle
            ? rows.filter((row) => row.apprLineNm.toLowerCase().includes(needle))
            : rows;

        if (!sortField || !sortDirection) return base;

        const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
        const sorted = [...base].sort((a, b) => {
            let av: string;
            let bv: string;
            switch (sortField) {
                case "APPR_LINE_NM":
                    av = a.apprLineNm ?? "";
                    bv = b.apprLineNm ?? "";
                    break;
                case "APPRVR_NM":
                    // Sort on the primary approver's display name. The
                    // chain itself stays server-ordered by
                    // `apprvr_disp_ord ASC`; this only rearranges rows.
                    av = a.approvers[0]?.name ?? "";
                    bv = b.approvers[0]?.name ?? "";
                    break;
                case "REG_DTM":
                    // Legacy `yyyyMMddHHmmss` is lexicographically
                    // sortable; no parse needed.
                    av = a.regDtm ?? "";
                    bv = b.regDtm ?? "";
                    break;
                default:
                    return 0;
            }
            const cmp = collator.compare(av, bv);
            return sortDirection === "ASC" ? cmp : -cmp;
        });
        return sorted;
    }, [rows, keyword, sortField, sortDirection]);

    const openDeleteConfirm = (row: ApprovalLineRow) =>
        dialog.open({
            type:        "confirmation",
            title:       t("settings.approval_line.confirm_delete.title"),
            description: t("settings.approval_line.confirm_delete.description", {
                name: row.apprLineNm,
            }),
            confirmText: t("settings.approval_line.confirm_delete.confirm"),
            cancelText:  t("settings.approval_line.confirm_delete.cancel"),
            onConfirm: async () => {
                try {
                    await mutations.remove(row.apprLineNo);
                    await refetch();
                    dialog.open({
                        type:        "success",
                        title:       t("dialog.success"),
                        description: t("settings.approval_line.delete_success"),
                    });
                } catch (e: unknown) {
                    const ex = e as ApiCallError;
                    dialog.open({
                        type:        "error",
                        title:       t("dialog.error"),
                        description: resolveBackendMessage(t, ex),
                        errorCode:   ex.code,
                    });
                }
            },
        });

    const handleSaved = async (mode: "add" | "update") => {
        setDialogState(null);
        await refetch();
        dialog.open({
            type:  "success",
            title: t("dialog.success"),
            description:
                mode === "add"
                    ? t("settings.approval_line.create_success")
                    : t("settings.approval_line.update_success"),
        });
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 clears the shell's absolute Esc/X group. */}
            <div className="flex shrink-0 flex-col gap-1 px-8 pb-5 pr-24 pt-14">
                <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                    {t("settings.approval_line.title")}
                </h3>
                <p className="text-wb-13 font-normal text-wb-muted">
                    {t("settings.approval_line.description")}
                </p>
            </div>

            {/* Filter row — search input on the left, Add button on
               the right. Single justify-between flex row per Figma
               9196:11793. */}
            <div className="flex shrink-0 items-center justify-between gap-4 px-8 pb-4">
                <div className="h-[var(--h-wb-filter-btn)] w-full max-w-[290px]">
                    <div className="relative h-full">
                        <Search
                            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-wb-ntrl-5"
                            strokeWidth={1.8}
                        />
                        <Input
                            type="text"
                            placeholder={t("settings.approval_line.search_placeholder")}
                            aria-label={t("settings.approval_line.search_placeholder")}
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="h-full rounded-md pl-8 pr-2 text-wb-14-tight font-medium placeholder:text-wb-ntrl-5"
                        />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setDialogState({ mode: "add" })}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.approval_line.add")}
                </button>
            </div>

            {/* Scroll region — table body scrolls; header is sticky
               inside. The inner flex column lets the empty-state
               sibling expand via `flex-1` so the message centers in
               the area below the header instead of hugging the
               header at its natural cell-padding height. Mirrors
               the ERP Transaction History panel structure. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar-y h-full overflow-y-auto">
                    <div className="flex h-full flex-col">
                        <ApprovalLineTable
                            rows={filteredRows}
                            sortField={sortField}
                            sortDirection={sortDirection}
                            onSort={toggleSort}
                            openApproversRowId={openApproversRowId}
                            onToggleApprovers={handleToggleApprovers}
                            onEdit={(row) => setDialogState({ mode: "update", row })}
                            onDelete={openDeleteConfirm}
                        />
                        {filteredRows.length === 0 && (
                            <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {initialLoading
                                    ? t("settings.approval_line.loading")
                                    : t("settings.approval_line.empty")}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Approval Line dialog — Figma 9196:11969 (Add) /
               9196:11547 (Update). Conditional mount + row-keyed key
               so opening row B after row A remounts the dialog with
               row B's seed values instead of leaking row A's draft.
               Sits at stackLevel=2 (set inside the dialog) on top of
               the L1 Settings shell. */}
            {dialogState?.mode === "add" && (
                <ApprovalLineDialog
                    mode="add"
                    submitting={mutations.submitting}
                    onSubmit={async (values) => {
                        try {
                            await mutations.create(values);
                            await handleSaved("add");
                        } catch (e: unknown) {
                            const ex = e as ApiCallError;
                            dialog.open({
                                type:        "error",
                                title:       t("dialog.error"),
                                description: resolveBackendMessage(t, ex),
                                errorCode:   ex.code,
                            });
                        }
                    }}
                    onClose={() => {
                        mutations.clearError();
                        setDialogState(null);
                    }}
                />
            )}
            {dialogState?.mode === "update" && (
                <ApprovalLineDialog
                    key={`update-${dialogState.row.apprLineNo}`}
                    mode="update"
                    apprLineNo={dialogState.row.apprLineNo}
                    submitting={mutations.submitting}
                    loadDetail={mutations.loadDetail}
                    onSubmit={async (values) => {
                        try {
                            await mutations.update(dialogState.row.apprLineNo, values);
                            await handleSaved("update");
                        } catch (e: unknown) {
                            const ex = e as ApiCallError;
                            dialog.open({
                                type:        "error",
                                title:       t("dialog.error"),
                                description: resolveBackendMessage(t, ex),
                                errorCode:   ex.code,
                            });
                        }
                    }}
                    onClose={() => {
                        mutations.clearError();
                        setDialogState(null);
                    }}
                />
            )}
        </div>
    );
}

/**
 * Map backend `WBE_*` codes to user-facing copy. Every Approval Line
 * code surfaces a feature-specific message; unknown codes fall back
 * to the envelope's localized text so we never render "UNKNOWN" or a
 * blank dialog body.
 */
function resolveBackendMessage(
    t: (key: string, vars?: Record<string, string>) => string,
    error: ApiCallError,
): string {
    switch (error.code) {
        case "WBE_APPROVAL_LINE_NOT_FOUND":
            return t("settings.approval_line.error.not_found");
        case "WBE_APPROVAL_LINE_TOO_MANY_APPROVERS":
            return t("settings.approval_line.error.too_many_approvers");
        case "WBE_APPROVAL_LINE_DUP_APPROVER":
            return t("settings.approval_line.error.duplicate_approver");
        case "WBE_APPROVAL_LINE_APPROVER_NOT_IN_TENANT":
            return t("settings.approval_line.error.approver_not_in_tenant");
        case "WBE_APPROVAL_LINE_EMPTY_APPROVERS":
            return t("settings.approval_line.error.empty_approvers");
        case "WBE_APPROVAL_LINE_NAME_BLANK":
            return t("settings.approval_line.error.name_blank");
        default:
            return error.message;
    }
}
