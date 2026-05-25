"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { ApiCallError } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import {
    buildParentHandCdIndex,
    createPurposeSetting,
    deletePurposeSetting,
    fetchPurposeSettings,
    mapPurposeSettingRow,
    updatePurposeSetting,
} from "@/lib/api/purposeSettings";
import { useDialog } from "@/components/shared/dialog";
import ExcelUploadButton from "@/components/shared/ExcelUploadButton";
import { useTranslation } from "@/lib/i18n";

import ExcelUploadDialog from "./ExcelUploadDialog";
import { mockPurposeTree } from "./mockData";
import PurposeFormRow, {
    type PurposeDraft,
    type PurposeFormMode,
} from "./PurposeFormRow";
import PurposeTable from "./PurposeTable";
import type { PurposeNode } from "./types";

/**
 * Purpose panel — Figma 9438:19204 (read-only) + 9448:19960 (inline add / edit).
 *
 * <h2>Wire-up (Phase 3 — 2026-05-12)</h2>
 *
 * - List data loads via {@link useApiData} against
 *   {@link fetchPurposeSettings}; the mapper drops the wire row into
 *   the existing {@link PurposeNode} shape so the static-UI children
 *   (`<PurposeTable>`, `<PurposeFormRow>`, `<RowActions>`) keep
 *   working unchanged.
 * - Mutations (`createPurposeSetting` / `updatePurposeSetting` /
 *   `deletePurposeSetting`) bump a local `refreshKey` to refetch the
 *   tree after a successful write. The shared dialog
 *   ({@link useDialog}) surfaces errors with the localized message
 *   from the backend's error envelope.
 * - Offline-dev fallback: on fetch error the panel renders
 *   {@link mockPurposeTree} so the modal stays usable without a
 *   backend (matches the firm-banking-settings precedent).
 *
 * <h2>Layout</h2>
 *
 *   [Header]       — title + description (shrink-0); pr-24 clears the shell's Esc/X
 *   [Toolbar]      — right-aligned Excel Upload chip
 *   [Scroll area]  — read-only `<PurposeTable>` PLUS, when active, the
 *                    sibling `<PurposeFormRow>` (sticky bottom-0 mt-auto)
 *   [Bottom slot]  — "+ Add Purpose" button when idle, or an inert
 *                    spacer matching the button's vertical footprint
 *                    when the inline form is open
 *
 * <h2>OQ-2 / OQ-FE-Frontend-1 (decided 2026-05-12)</h2>
 *
 * Parent picker shows level-1 rows only — the frontend filters them
 * out of `eligibleParents` before they reach the form. The backend's
 * `validateParent` still rejects level-2 parents as defence in depth,
 * but the picker MUST not expose those rows.
 *
 * <h2>OQ-5 + OQ-8 (decided 2026-05-12)</h2>
 *
 * `node.usedInTransactions` is server-computed AND recursive — the
 * trash button is disabled both when the row itself OR any of its
 * active children is referenced. Wire code `WBE1199` covers both
 * cases under one localized message.
 */
export default function PurposePanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /* Bumped after every successful mutation — drives `useApiData` to
     * refetch the live tree. Initial 0 fires the first GET on mount. */
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = () => setRefreshKey((k) => k + 1);

    const { data, error, loading } = useApiData(
        () => fetchPurposeSettings(),
        [refreshKey],
    );

    /* Map the wire shape into the in-memory `PurposeNode` tree the
     * static-UI components already render. When the fetch fails (no
     * backend, network down, etc.) fall back to the static mock seed
     * so offline-dev work continues. */
    const nodes: PurposeNode[] = useMemo(() => {
        if (!data) return error ? mockPurposeTree : [];
        const parentIdx = buildParentHandCdIndex(data.list);
        return data.list.map((r) => mapPurposeSettingRow(r, parentIdx));
    }, [data, error]);

    /* Auto-expand every level-1 row that ships at least one child so
     * the freshly-loaded tree opens flat (mirrors the static mock's
     * `expandedIds: new Set(["bd01"])` convenience). */
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    useMemo(() => {
        // Recompute the seed set whenever `nodes` changes shape — fresh
        // tree from the API should expand its children by default. We
        // only seed when the user hasn't explicitly collapsed anything
        // yet (best-effort UX; collapsing then refreshing won't re-open).
        setExpandedIds((prev) => {
            if (prev.size > 0) return prev;
            const next = new Set<string>();
            for (const n of nodes) {
                if ((n.children?.length ?? 0) > 0) next.add(n.id);
            }
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes]);

    const [inlineMode, setInlineMode] = useState<PurposeFormMode | null>(null);
    const [excelUploadOpen, setExcelUploadOpen] = useState(false);

    function toggleExpand(id: string) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function startEdit(node: PurposeNode) {
        setInlineMode({
            kind: "edit",
            node,
            parentCode: node.parentHandCd ?? "",
        });
    }

    function startAdd() {
        setInlineMode({ kind: "add" });
    }

    function dismissInline() {
        setInlineMode(null);
    }

    /* Resolve a user-visible parent code from the form back to its
     * system-PK counterpart (`use_usag_cd`). Only level-1 rows are
     * eligible parents (OQ-FE-Frontend-1 decided 2026-05-12). Returns
     * null when the picker was left blank OR when the typed code did
     * not match any active level-1 row — the backend's `validateParent`
     * is still authoritative either way. */
    function resolveParentSystemCd(handCd: string): string | null {
        const t = handCd.trim();
        if (!t) return null;
        const match = nodes.find(
            (n) => n.code === t && !n.parentSystemCd && n.useUsagCd,
        );
        return match?.useUsagCd ?? null;
    }

    async function handleSave(draft: PurposeDraft) {
        if (!inlineMode) return;
        try {
            if (inlineMode.kind === "edit") {
                const editing = inlineMode.node;
                if (!editing.useUsagCd) {
                    // Mock-seed rows have no system PK — defensive guard.
                    // Should never fire against live data.
                    surfaceErrorDialog("WBE9999", t("settings.purpose.error.generic"));
                    return;
                }
                await updatePurposeSetting(editing.useUsagCd, {
                    hand_use_usag_cd: draft.code,
                    use_usag_nm: draft.name,
                    use_usag_cont: draft.description.trim() || null,
                    parent_use_usag_cd: resolveParentSystemCd(draft.parentCode),
                    disp_yn: editing.enabled ? "Y" : "N",
                });
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("settings.purpose.success.updated"),
                });
            } else {
                await createPurposeSetting({
                    hand_use_usag_cd: draft.code,
                    use_usag_nm: draft.name,
                    use_usag_cont: draft.description.trim() || null,
                    parent_use_usag_cd: resolveParentSystemCd(draft.parentCode),
                    disp_yn: "Y",
                });
                dialog.open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t("settings.purpose.success.created"),
                });
            }
            dismissInline();
            refresh();
        } catch (err) {
            surfaceMutationError(err);
        }
    }

    async function handleDelete(node: PurposeNode) {
        if (!node.useUsagCd) {
            // Mock-seed row — no PK to send.
            surfaceErrorDialog("WBE9999", t("settings.purpose.error.generic"));
            return;
        }
        const useUsagCd = node.useUsagCd;
        const hasChildren = (node.children?.length ?? 0) > 0;

        // Leaf rows delete without confirmation per the Figma flow at
        // node 9542:20102 ("Purpose Used? → no → Dialogue (Success)"
        // path has no intermediate Confirmation). Parent rows with
        // sub-purposes ALWAYS get the Confirmation dialog first
        // because the delete cascades — the user must acknowledge that
        // every child row goes with the parent.
        //
        // The existing `usedInTransactions` flag is no longer a frontend
        // gate (the trash button is always enabled). It still drives the
        // server response: `WBE1199` lands here through
        // `surfaceMutationError` and renders the Error dialog
        // ("Cannot delete — this purpose or one of its sub-purposes is
        // in use.") via `surfaceErrorDialog`.
        if (!hasChildren) {
            performDelete(useUsagCd);
            return;
        }
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("settings.purpose.confirm.delete_with_children"),
            confirmText: t("settings.purpose.confirm.delete_continue"),
            // Primary brand-blue button per the Figma at node
            // 9542:20102 — the destructive (red) ramp is reserved for
            // dialogs that need an extra "pause before clicking"
            // affordance; this Confirmation already lives behind the
            // trash button, so the standard blue suffices.
            onConfirm: () => performDelete(useUsagCd),
        });
    }

    /** Shared delete commit — fires after either the leaf-immediate
     *  branch or the parent-with-children confirmation. Surfaces the
     *  Success dialog on the happy path; any server error
     *  (including `WBE1199`) routes through `surfaceMutationError`. */
    async function performDelete(useUsagCd: string) {
        try {
            await deletePurposeSetting(useUsagCd);
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.purpose.success.deleted"),
            });
            refresh();
        } catch (err) {
            surfaceMutationError(err);
        }
    }

    /* Toggle handler — backend Update PUT requires the full required
     * field set (per legacy parity OQ-4). Echo every required field
     * on every toggle write so we never accidentally null-out a name
     * or a hand code by sending a partial body. */
    async function handleToggle(node: PurposeNode, next: boolean) {
        if (!node.useUsagCd) {
            surfaceErrorDialog("WBE9999", t("settings.purpose.error.generic"));
            return;
        }
        try {
            await updatePurposeSetting(node.useUsagCd, {
                hand_use_usag_cd: node.code,
                use_usag_nm: node.name,
                use_usag_cont:
                    node.description && node.description !== "-"
                        ? node.description
                        : null,
                parent_use_usag_cd: node.parentSystemCd ?? null,
                disp_yn: next ? "Y" : "N",
            });
            refresh();
        } catch (err) {
            surfaceMutationError(err);
        }
    }

    function surfaceMutationError(err: unknown) {
        if (err instanceof ApiCallError) {
            surfaceErrorDialog(err.code, err.message);
            return;
        }
        const message = err instanceof Error ? err.message : String(err);
        surfaceErrorDialog("WBE9999", message);
    }

    /** Maps the backend wire code to a localized message. Falls back
     *  to the server-supplied `message` (already localized by the
     *  backend's `MessageResolver`) when the code isn't one of our
     *  feature-specific overrides. */
    function surfaceErrorDialog(code: string, serverMessage: string) {
        let description = serverMessage;
        if (code === "WBE1199") {
            description = t("settings.purpose.error.delete_blocked");
        } else if (code === "WBW1152") {
            description = t("settings.purpose.error.duplicate_code");
        } else if (code === "WBW1138") {
            description = t("settings.purpose.error.duplicate_name");
        } else if (code === "NETWORK") {
            description = t("settings.purpose.error.network");
        }
        dialog.open({
            type: "error",
            // Shared project-wide error-dialog title ("Error" / "오류" /
            // "Lỗi"). Same pattern as the success dialog uses
            // `dialog.success` — matches firm-banking-settings,
            // bank-account, login-credentials. The feature-specific
            // "Couldn't save the purpose" wording was replaced by the
            // generic key on 2026-05-12 to align Purpose with the
            // standard error-dialog convention.
            title: t("dialog.error"),
            description,
            errorCode: code,
        });
    }

    /* Only level-1 nodes are eligible as parent purposes (depth cap = 2;
     * OQ-FE-Frontend-1 decided 2026-05-12 — frontend filters out
     * level-2 rows). When editing, exclude the node itself so the
     * picker can't loop a node onto itself. */
    const eligibleParents = nodes
        .filter((n) => !n.parentSystemCd) // level-1 only
        .filter((n) =>
            inlineMode?.kind === "edit" ? n.id !== inlineMode.node.id : true,
        )
        .map((n) => ({ code: n.code, name: n.name }));

    /* Loading + empty notices share the same centered-in-available-area
     * pattern as ERP Transaction History (see
     * `ErpTransactionHistoryPanel` § "empty-state sibling"): a sibling
     * `<div>` with `flex flex-1 items-center justify-center` inside an
     * `h-full` flex column, so the message centers BOTH horizontally
     * AND vertically in the space below the table header — never
     * hugging the header at its natural cell-padding height.
     *
     * Empty notice suppressed while the inline Add/Edit form is open —
     * during that flow the user is actively typing, so "No Data Found"
     * would just be visual noise. */
    const showLoadingNotice = loading && !data && !error;
    const showEmptyNotice = !loading && !showLoadingNotice
        && nodes.length === 0 && !inlineMode;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 reserves space for the shell's absolute Esc/X
               group at top-4 right-4 so the title row never collides with
               the close affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.purpose.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.purpose.description")}
                    </p>
                </div>
            </div>

            {/* Toolbar — only Excel Upload today. Chrome owned by the
               shared <ExcelUploadButton> so Purpose, VAS Account and
               Chart of Accounts read identically. */}
            <div className="flex shrink-0 items-center justify-end px-8 pb-3">
                <ExcelUploadButton
                    label={t("settings.purpose.excel_upload")}
                    onClick={() => setExcelUploadOpen(true)}
                />
            </div>

            {/* Scroll region — shared scroll container holds the read-only
               table AND, when active, the inline Add/Edit form. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    {/* `h-full` on the inner flex column (not `min-h-full`)
                       lets the empty-state sibling stretch to fill the
                       remaining vertical space via `flex-1`, which is
                       what makes "No Data Found" center vertically below
                       the header instead of sitting flush against it.
                       Mirrors ErpTransactionHistoryPanel exactly. */}
                    <div className="flex h-full min-w-min flex-col">
                        <PurposeTable
                            nodes={nodes}
                            expandedIds={expandedIds}
                            onToggleExpand={toggleExpand}
                            onEdit={startEdit}
                            onDelete={handleDelete}
                            onToggle={handleToggle}
                        />
                        {(showLoadingNotice || showEmptyNotice) && (
                            <div
                                className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6"
                                role="status"
                            >
                                {showLoadingNotice
                                    ? t("settings.purpose.list.loading")
                                    : t("settings.purpose.list.empty")}
                            </div>
                        )}
                        {inlineMode && (
                            <PurposeFormRow
                                key={
                                    inlineMode.kind === "edit"
                                        ? `edit-${inlineMode.node.id}`
                                        : "add"
                                }
                                mode={inlineMode}
                                eligibleParents={eligibleParents}
                                onCancel={dismissInline}
                                onSave={handleSave}
                                className="sticky bottom-0 z-10 mt-auto"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom slot — Add button vs inert spacer. */}
            {inlineMode ? (
                <div aria-hidden className="mb-3 mt-3 shrink-0" />
            ) : (
                <button
                    type="button"
                    onClick={startAdd}
                    className="mx-8 mb-3 mt-3 flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md border border-wb-ntrl-4 bg-white text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.purpose.add")}
                </button>
            )}

            {/* Excel Upload dialog — wired to live upload endpoint;
               on success refetches the panel. */}
            {excelUploadOpen && (
                <ExcelUploadDialog
                    onClose={() => setExcelUploadOpen(false)}
                    onUploaded={() => refresh()}
                />
            )}
        </div>
    );
}
