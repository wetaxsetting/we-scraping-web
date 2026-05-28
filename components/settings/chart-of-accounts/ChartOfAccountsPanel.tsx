"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import ExcelUploadButton from "@/components/shared/ExcelUploadButton";
import SearchInput from "@/components/shared/SearchInput";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { ApiCallError } from "@/lib/api/banking";
import { useTranslation } from "@/lib/i18n";

import ChartOfAccountsInlineRow from "./ChartOfAccountsInlineRow";
import ChartOfAccountsTable from "./ChartOfAccountsTable";
import ExcelUploadDialog from "./ExcelUploadDialog";
import { toFormValues } from "./mappers";
import type {
    ChartOfAccountsFormValues,
    ChartOfAccountsRow,
    InlineRowMode,
} from "./types";
import {
    useChartOfAccountsList,
    useChartOfAccountsMutations,
} from "./useChartOfAccounts";

/**
 * Chart of Accounts panel — Settings popup submenu (Figma 9196:12740).
 *
 * Phase 1 wires the existing static-UI shell to the Spring
 * `/api/v1/settings/chart-of-accounts` family. The visual contract is
 * unchanged — the table still renders a two-level tree with `kind:
 * "group" | "child"` discriminator, the "+ Add A New Account" CTA
 * still toggles the inline row, the Excel Upload chip still opens the
 * shared modal. What changed:
 *
 *   - Source data is `useChartOfAccountsList()` instead of mockData;
 *     errors from the GET surface through the shared error dialog.
 *   - "+ Add" / pencil opens the same inline row but Save now fires
 *     the matching create / update mutation.
 *   - The trash icon opens the shared `useDialog` confirmation; on
 *     Continue the delete mutation runs and the panel refetches.
 *   - Excel Upload stays inert (Phase 2 — backend doc OQ-5).
 *
 * Loading / empty states are deliberately compact — the static UI
 * doesn't ship a `<TableLoading>` primitive and the Settings shell
 * is light-touch; a centered placeholder under the table is the
 * accepted pattern (mirrors Approval Line / Contacts).
 */
export default function ChartOfAccountsPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [keyword, setKeyword] = useState("");
    const [excelUploadOpen, setExcelUploadOpen] = useState(false);
    /**
     * Inline-row state. Mutually exclusive with the bottom "+ Add A New
     * Account" button — opening either Add (button) or Edit (pencil
     * icon) hides the button and shows the inline form inside the
     * scroll region.
     */
    const [inlineMode, setInlineMode] = useState<InlineRowMode>(null);

    /**
     * Selected `chartAcctSeqNo` set — drives the multi-select Delete /
     * Deactivate buttons in the header and is cleared after every
     * successful bulk action (or any list refetch via {@code refetch}
     * + the {@link useEffect} below that prunes stale ids).
     *
     * Restricted roots (ACC-01 / 02 / 03) and "group" rows have no
     * checkbox at all in the table, so this set only ever contains
     * eligible child rows. The backend re-validates per row as a
     * defence-in-depth — restricted ids that slip through (e.g. via a
     * stale frontend bundle) are tallied in the response's
     * {@code failed} count.
     */
    const [selectedSeqNos, setSelectedSeqNos] = useState<Set<string>>(new Set());

    // No server-side search — the backend's list endpoint returns the
    // whole tenant slice (load-all matches legacy). Filtering happens
    // in memory so the search box stays snappy and parent rows stay
    // visible when only a single child matches.
    const params = useMemo(() => ({}), []);

    const { rows, initialLoading, error, refetch } = useChartOfAccountsList(params);
    const mutations = useChartOfAccountsMutations();

    /* Smooth the initial-load indicator so fast cached responses don't
     * flash the loading text on/off. The data view stays driven by
     * `rows`; only the gating boolean below is held sticky. */
    const stickyInitialLoading = useStickyLoading(initialLoading);
    /* Sticky mirror of `mutations.submitting`: keep the bulk Delete /
     * Deactivate buttons (and the inline form's Save) visually
     * disabled for the minimum-visibility window so a fast PUT / POST
     * doesn't flicker the affordance enabled → disabled → enabled. */
    const stickyMutationSubmitting = useStickyLoading(mutations.submitting);

    /* Per-row delete guard — keyed by `chartAcctSeqNo`. Prevents a
     * duplicate single-row delete (via the row's trash icon) while the
     * first delete is still in flight. The bulk Delete / Deactivate
     * buttons remain gated by `mutations.submitting` at the toolbar
     * level. */
    const [deletingSeqNos, setDeletingSeqNos] = useState<Set<string>>(new Set());

    // Surface list-fetch failures via the shared error dialog. Mirrors
    // the contacts / approval-line pattern.
    useEffect(() => {
        if (!error) return;
        dialog.open({
            type:        "error",
            title:       t("dialog.error"),
            description: error.message,
            errorCode:   error.code,
        });
    }, [error, dialog, t]);

    /**
     * Localise the three restricted-root display names so Korean /
     * Vietnamese viewers see the localized REVENUE / EXPENSES /
     * INVESTMENT label instead of the raw EN column. Other rows pass
     * through as-is — DEV data carries native KO / VN names. The
     * mapping table is hard-coded because the set is static (V96 seed
     * + backend `ChartOfAccountsConstants.RESTRICTED_CODES`).
     */
    const localizedRows = useMemo(() => {
        return rows.map((row) => {
            if (row.kind !== "group") return row;
            const keyByCode: Record<string, string> = {
                "ACC-01": "settings.chart_of_accounts.restricted.acc_01",
                "ACC-02": "settings.chart_of_accounts.restricted.acc_02",
                "ACC-03": "settings.chart_of_accounts.restricted.acc_03",
            };
            const labelKey = keyByCode[row.accountCode];
            if (!labelKey) return row;
            const label = t(labelKey);
            return { ...row, accountTypeEn: label, accountTypeVi: label, accountTypeKo: label };
        });
    }, [rows, t]);

    /**
     * Search filters the visible row set. Group rows survive the filter
     * as long as at least one of their child rows still matches, so
     * the grouping reads correctly even when only a single child is
     * shown.
     */
    const filteredRows = useMemo(() => {
        const q = keyword.trim().toLowerCase();
        if (!q) return localizedRows;

        const childMatches = localizedRows
            .filter((row) => row.kind === "child")
            .filter((row) =>
                [
                    row.accountCode,
                    row.accountTypeEn,
                    row.accountTypeVi,
                    row.accountTypeKo,
                    row.kind === "child" ? row.parentCode ?? "" : "",
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
            );

        const matchedParents = new Set(
            childMatches
                .map((row) => (row.kind === "child" ? row.parentCode : null))
                .filter((p): p is string => !!p),
        );

        // Group rows also match if their own code / EN name matches the
        // keyword — without this, searching for "REVENUE" hides ACC-01
        // when none of its children match.
        const groupSelfMatches = localizedRows
            .filter((row) => row.kind === "group")
            .filter((row) =>
                [row.accountCode, row.accountTypeEn]
                    .join(" ")
                    .toLowerCase()
                    .includes(q),
            );

        return localizedRows.filter((row) => {
            if (row.kind === "group") {
                return (
                    matchedParents.has(row.accountCode) ||
                    groupSelfMatches.includes(row)
                );
            }
            return childMatches.includes(row);
        });
    }, [keyword, localizedRows]);

    /* ---------------------------------------------------------------
     *  Multi-select selection state
     * --------------------------------------------------------------- */

    /**
     * Every selectable row in the current filtered view — child rows
     * that are NOT restricted. Group rows (restricted roots) and any
     * non-restricted child whose backend `restricted` flag is true (the
     * union should be empty in practice) are excluded so the header
     * checkbox + bulk buttons agree with the table's own
     * checkbox-rendering rule.
     */
    const selectableSeqNos = useMemo(() => {
        const ids = new Set<string>();
        for (const row of filteredRows) {
            if (row.kind === "child" && !row.restricted) {
                ids.add(row.chartAcctSeqNo);
            }
        }
        return ids;
    }, [filteredRows]);

    /**
     * Effective selection — derived during render as the intersection
     * of the raw {@link selectedSeqNos} state and the current
     * {@link selectableSeqNos}. This makes stale ids (rows that
     * disappeared from the table after a delete / deactivate refetch,
     * or rows filtered out by the search box) invisible to every
     * consumer (header checkbox state, button count, mutation payload)
     * without a pruning {@code useEffect} that would violate React 19's
     * set-state-in-effect rule. The raw state can hold stale ids
     * harmlessly until the next explicit toggle / clear.
     */
    const effectiveSelectedSeqNos = useMemo(() => {
        if (selectedSeqNos.size === 0) return selectedSeqNos;
        const live = new Set<string>();
        for (const id of selectedSeqNos) {
            if (selectableSeqNos.has(id)) live.add(id);
        }
        return live;
    }, [selectedSeqNos, selectableSeqNos]);

    const selectedCount   = effectiveSelectedSeqNos.size;
    const allSelected     = selectableSeqNos.size > 0
                            && selectedCount === selectableSeqNos.size;
    const someSelected    = selectedCount > 0 && !allSelected;
    const hasSelection    = selectedCount > 0;

    function handleToggleRow(seqNo: string, selected: boolean) {
        setSelectedSeqNos((prev) => {
            const next = new Set(prev);
            if (selected) next.add(seqNo);
            else next.delete(seqNo);
            return next;
        });
    }

    function handleToggleAll(selectAll: boolean) {
        setSelectedSeqNos(selectAll ? new Set(selectableSeqNos) : new Set());
    }

    function clearSelection() {
        setSelectedSeqNos(new Set());
    }

    /* ---------------------------------------------------------------
     *  Handlers
     * --------------------------------------------------------------- */

    function handleEdit(row: ChartOfAccountsRow) {
        if (row.kind !== "child") return;
        if (row.restricted) return; // defensive — table also disables the button
        setInlineMode({ kind: "edit", row });
    }

    function handleAddNew() {
        setInlineMode({ kind: "add" });
    }

    function dismissInline() {
        setInlineMode(null);
    }

    async function handleSave(values: ChartOfAccountsFormValues) {
        if (!inlineMode) return;
        try {
            if (inlineMode.kind === "edit") {
                await mutations.update(inlineMode.row.chartAcctSeqNo, values);
            } else {
                await mutations.create(values);
            }
            setInlineMode(null);
            await refetch();
            dialog.open({
                type:        "success",
                title:       t("dialog.success"),
                description:
                    inlineMode.kind === "edit"
                        ? t("settings.chart_of_accounts.update_success")
                        : t("settings.chart_of_accounts.create_success"),
            });
        } catch (e: unknown) {
            // Mutation hook already records the error; surface via dialog
            // and leave the inline row open so the user can edit + retry.
            const ex = e as ApiCallError;
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: ex.message ?? "",
                errorCode:   ex.code,
            });
        }
    }

    /**
     * Open the bulk-delete confirmation dialog. The shared
     * confirmation routes through {@code useDialog()} — Continue fires
     * the bulk mutation, refetches the list, clears the selection, and
     * surfaces a success or partial-success dialog based on the
     * server-reported {@code processed} / {@code failed} totals.
     */
    function handleBulkDelete() {
        if (selectedCount === 0) return;
        const ids = Array.from(effectiveSelectedSeqNos);
        dialog.open({
            type:        "confirmation",
            title:       t("dialog.confirmation"),
            description: t("settings.chart_of_accounts.confirm_bulk_delete.description"),
            confirmText: t("settings.chart_of_accounts.confirm_bulk_delete.confirm"),
            cancelText:  t("dialog.cancel"),
            // Red destructive CTA per CLAUDE.md §"Dialog buttons" — the
            // Figma frame shows an explicit red Delete button on this
            // confirmation. Deactivate uses the standard blue Confirm.
            destructive: true,
            onConfirm: async () => {
                try {
                    const res = await mutations.bulkRemove(ids);
                    await refetch();
                    clearSelection();
                    if (res.failed === 0) {
                        dialog.open({
                            type:        "success",
                            title:       t("dialog.success"),
                            description: t(
                                "settings.chart_of_accounts.bulk_delete_success",
                                { processed: res.processed },
                            ),
                        });
                    } else {
                        dialog.open({
                            type:        "error",
                            title:       t("dialog.error"),
                            description: t(
                                "settings.chart_of_accounts.bulk_delete_partial",
                                { processed: res.processed, failed: res.failed },
                            ),
                        });
                    }
                } catch (e: unknown) {
                    const ex = e as ApiCallError;
                    dialog.open({
                        type:        "error",
                        title:       t("dialog.error"),
                        description: ex.message ?? "",
                        errorCode:   ex.code,
                    });
                }
            },
        });
    }

    /**
     * Open the bulk-deactivate confirmation dialog. Same dispatch shape
     * as {@link handleBulkDelete} — the only differences are the dialog
     * copy and the mutation. Backend treats already-inactive rows as
     * processed (idempotent), so re-running the action on an unchanged
     * selection is safe.
     */
    function handleBulkDeactivate() {
        if (selectedCount === 0) return;
        const ids = Array.from(effectiveSelectedSeqNos);
        dialog.open({
            type:        "confirmation",
            title:       t("dialog.confirmation"),
            description: t("settings.chart_of_accounts.confirm_bulk_deactivate.description"),
            confirmText: t("settings.chart_of_accounts.confirm_bulk_deactivate.confirm"),
            cancelText:  t("dialog.cancel"),
            onConfirm: async () => {
                try {
                    const res = await mutations.bulkDeactivate(ids);
                    await refetch();
                    clearSelection();
                    if (res.failed === 0) {
                        dialog.open({
                            type:        "success",
                            title:       t("dialog.success"),
                            description: t(
                                "settings.chart_of_accounts.bulk_deactivate_success",
                                { processed: res.processed },
                            ),
                        });
                    } else {
                        dialog.open({
                            type:        "error",
                            title:       t("dialog.error"),
                            description: t(
                                "settings.chart_of_accounts.bulk_deactivate_partial",
                                { processed: res.processed, failed: res.failed },
                            ),
                        });
                    }
                } catch (e: unknown) {
                    const ex = e as ApiCallError;
                    dialog.open({
                        type:        "error",
                        title:       t("dialog.error"),
                        description: ex.message ?? "",
                        errorCode:   ex.code,
                    });
                }
            },
        });
    }

    function handleDelete(row: ChartOfAccountsRow) {
        if (row.kind !== "child") return;
        if (row.restricted) return;
        // Same-row re-entry guard — ignore the trash click if a delete
        // for this row is still in flight.
        if (deletingSeqNos.has(row.chartAcctSeqNo)) return;
        dialog.open({
            type:        "confirmation",
            title:       t("settings.chart_of_accounts.confirm_delete.title"),
            description: t("settings.chart_of_accounts.confirm_delete.description", {
                code: row.accountCode,
                name: row.accountTypeEn,
            }),
            confirmText: t("settings.chart_of_accounts.confirm_delete.confirm"),
            cancelText:  t("settings.chart_of_accounts.confirm_delete.cancel"),
            onConfirm: async () => {
                if (deletingSeqNos.has(row.chartAcctSeqNo)) return;
                setDeletingSeqNos((prev) =>
                    new Set(prev).add(row.chartAcctSeqNo),
                );
                try {
                    await mutations.remove(row.chartAcctSeqNo);
                    // `refetch()` resolves only when the new list is
                    // in state, so the deleted row is gone from the
                    // table before the finally block re-enables the
                    // trash trigger.
                    await refetch();
                    dialog.open({
                        type:        "success",
                        title:       t("dialog.success"),
                        description: t("settings.chart_of_accounts.delete_success"),
                    });
                } catch (e: unknown) {
                    const ex = e as ApiCallError;
                    dialog.open({
                        type:        "error",
                        title:       t("dialog.error"),
                        description: ex.message ?? "",
                        errorCode:   ex.code,
                    });
                } finally {
                    setDeletingSeqNos((prev) => {
                        if (!prev.has(row.chartAcctSeqNo)) return prev;
                        const next = new Set(prev);
                        next.delete(row.chartAcctSeqNo);
                        return next;
                    });
                }
            },
        });
    }

    /**
     * Seed the inline form. For edit mode use the row values; for add
     * mode use defaults (Active status, no parent, no calc rule). The
     * inline row reads from this on mount.
     */
    const inlineSeed: ChartOfAccountsFormValues = useMemo(() => {
        if (inlineMode?.kind === "edit") return toFormValues(inlineMode.row);
        return {
            accountCode: "",
            nameEn:      "",
            nameVi:      "",
            nameKo:      "",
            parentCode:  "",
            calcRule:    "",
            status:      "active",
        };
    }, [inlineMode]);

    /**
     * Parent-picker options — every active row in the tenant other than
     * the row being edited and its descendants. Restricted roots are
     * eligible parents; orphans (chartAcctLevel === null) are excluded
     * because re-parenting a child under them would propagate the
     * grandfathered shape. The inline row's dropdown consumes this
     * list (Phase 2 may move to the dedicated /tree endpoint when a
     * deeper picker is needed).
     */
    const parentOptions = useMemo(() => {
        const editingSeqNo =
            inlineMode?.kind === "edit" ? inlineMode.row.chartAcctSeqNo : null;
        const editingCode =
            inlineMode?.kind === "edit" ? inlineMode.row.accountCode : null;

        // Build descendant set so the picker doesn't offer rows that
        // would create a cycle. BFS over the tenant slice.
        const descendantCodes = new Set<string>();
        if (editingCode) {
            const childrenByParent = new Map<string, string[]>();
            for (const r of rows) {
                if (r.kind === "child" && r.parentCode) {
                    const arr = childrenByParent.get(r.parentCode) ?? [];
                    arr.push(r.accountCode);
                    childrenByParent.set(r.parentCode, arr);
                }
            }
            const queue = [editingCode];
            while (queue.length > 0) {
                const cd = queue.shift()!;
                if (descendantCodes.has(cd)) continue;
                if (cd !== editingCode) descendantCodes.add(cd);
                for (const child of childrenByParent.get(cd) ?? []) {
                    queue.push(child);
                }
            }
        }

        return rows
            .filter((r) => r.chartAcctSeqNo !== editingSeqNo)
            .filter((r) => !descendantCodes.has(r.accountCode))
            // Only in-cap rows can be parents (level 1..3 — adding a
            // child to a level-4 row would breach the 4-level cap).
            .filter((r) => {
                const level = r.kind === "group" ? 1 : r.chartAcctLevel;
                return level !== null && level <= 3;
            })
            .map((r) => ({
                code:  r.accountCode,
                label: `${r.accountCode} — ${r.accountTypeEn}`,
                // Group rows are always level 1; child rows carry the
                // computed `chartAcctLevel`. The level here drives the
                // inline row's Calc Rule gating (only show +/- when the
                // prospective new row would be level 3).
                level: r.kind === "group" ? 1 : (r.chartAcctLevel ?? 1),
            }));
    }, [rows, inlineMode]);

    /* ---------------------------------------------------------------
     *  Render
     * --------------------------------------------------------------- */

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — pr-24 clears the shell's absolute Esc/X group at
               top-4 right-4 so the title row never collides with the
               close affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14 pr-24">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.chart_of_accounts.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.chart_of_accounts.description")}
                    </p>
                </div>
            </div>

            {/* Filters — Search left; right slot stacks Delete +
               Deactivate (when one or more rows are selected) BEFORE
               the persistent Excel Upload chip. Normal action buttons
               stay visible so the user can swap between the bulk
               surface and Excel Upload without losing the selection. */}
            <div className="flex shrink-0 items-center justify-between gap-3 px-8 pb-3">
                <SearchInput
                    value={keyword}
                    onChange={setKeyword}
                    placeholder={t("common.search")}
                />
                <div className="flex items-center gap-2">
                    {hasSelection && (
                        <>
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={stickyMutationSubmitting}
                                className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-wb-red-07 px-3 text-wb-14-tight font-medium text-white shadow-wb-btn hover:bg-wb-red-07/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Trash2 className="size-4" strokeWidth={1.8} />
                                {t("settings.chart_of_accounts.bulk_delete")}
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkDeactivate}
                                disabled={stickyMutationSubmitting}
                                className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-red-07 shadow-[0_0_0_1px_var(--color-wb-red-04)] hover:bg-wb-red-04/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <X className="size-4" strokeWidth={2} />
                                {t("settings.chart_of_accounts.bulk_deactivate")}
                            </button>
                        </>
                    )}
                    <ExcelUploadButton
                        label={t("settings.chart_of_accounts.excel_upload")}
                        onClick={() => setExcelUploadOpen(true)}
                    />
                </div>
            </div>

            {/* Scroll region — shared scroll container holds the read-only
               table AND, when active, the inline Add/Edit form. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <div className="flex min-h-full min-w-min flex-col">
                        <ChartOfAccountsTable
                            rows={filteredRows}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            selectedIds={effectiveSelectedSeqNos}
                            onToggleRow={handleToggleRow}
                            onToggleAll={handleToggleAll}
                            allSelected={allSelected}
                            someSelected={someSelected}
                        />
                        {stickyInitialLoading && filteredRows.length === 0 && (
                            <div
                                className="flex flex-1 items-center justify-center py-12 text-wb-13 font-medium text-wb-ntrl-6"
                                role="status"
                            >
                                {t("settings.chart_of_accounts.list.loading")}
                            </div>
                        )}
                        {!stickyInitialLoading && filteredRows.length === 0 && (
                            <div className="flex flex-1 items-center justify-center py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {keyword
                                    ? t("settings.chart_of_accounts.empty_search")
                                    : t("settings.chart_of_accounts.empty_default")}
                            </div>
                        )}
                        {inlineMode && (
                            <ChartOfAccountsInlineRow
                                key={
                                    inlineMode.kind === "edit"
                                        ? `edit-${inlineMode.row.chartAcctSeqNo}`
                                        : "add"
                                }
                                mode={inlineMode}
                                initialValues={inlineSeed}
                                parentOptions={parentOptions}
                                submitting={stickyMutationSubmitting}
                                onCancel={dismissInline}
                                onSave={handleSave}
                                className="sticky bottom-0 z-10 mt-auto"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom slot — "+ Add A New Account" CTA OR a spacer when
               inline mode is active. The spacer keeps the panel's
               vertical rhythm consistent across modes. */}
            {inlineMode ? (
                <div aria-hidden className="mb-3 mt-3 shrink-0" />
            ) : (
                <button
                    type="button"
                    onClick={handleAddNew}
                    className="mx-8 mb-3 mt-3 flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.chart_of_accounts.add_account")}
                </button>
            )}

            {excelUploadOpen && (
                <ExcelUploadDialog
                    onClose={() => setExcelUploadOpen(false)}
                    onUploadDone={async (created, failed) => {
                        setExcelUploadOpen(false);
                        await refetch();
                        if (failed === 0) {
                            dialog.open({
                                type:        "success",
                                title:       t("dialog.success"),
                                description: t(
                                    "settings.chart_of_accounts.upload.result.success",
                                    { created },
                                ),
                            });
                        } else {
                            dialog.open({
                                type:        "error",
                                title:       t("dialog.error"),
                                description: t(
                                    "settings.chart_of_accounts.upload.result.partial",
                                    { created, failed },
                                ),
                            });
                        }
                    }}
                />
            )}
        </div>
    );
}
