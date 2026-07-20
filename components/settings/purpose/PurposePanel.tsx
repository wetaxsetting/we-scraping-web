"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { ApiCallError } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import {
    createPurposeSetting,
    deletePurposeSetting,
    fetchDeletedPurposeSettings,
    fetchPurposeSettings,
    reorderPurposeSettings,
    restorePurposeSetting,
    updatePurposeSetting,
    type ApiPurposeSettingRow,
    type PurposeGroup,
} from "@/lib/api/purposeSettings";
import { useDialog } from "@/components/shared/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import AddPurposeRow from "./AddPurposeRow";
import DeletedPurposeTable, { type DeletedPurposeItem } from "./DeletedPurposeTable";
import PurposeTable from "./PurposeTable";
import PurposeTabs, { type PurposeTab } from "./PurposeTabs";
import type { PurposeRowVM } from "./types";

/**
 * Purpose panel — legacy-parity rebuild (Figma 1353:33776).
 *
 * Mirrors legacy comm_0187_001: three tabs (Banking Deposit =
 * usag_grp_cd 4, Banking Withdrawal = 6, Deleted Purpose), an Edit
 * button that flips the active tab into inline-editable + drag-reorder
 * rows with per-row delete and Cancel/Save, a per-row enable toggle in
 * view mode, a full-width "+ Add Purpose" button, and Restore on the
 * Deleted tab. The former refactor Excel Upload + parent-picker +
 * two-level hierarchy are intentionally dropped — they are not part of
 * the legacy UAT/PROD screen the PO asked to restore.
 */
export default function PurposePanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [activeTab, setActiveTab] = useState<PurposeTab>("deposit");
    const [mode, setMode] = useState<"view" | "edit">("view");
    const [draft, setDraft] = useState<PurposeRowVM[]>([]);
    const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
    /* Inline single-row Add (legacy `new_purpose`) — independent of the
     * bulk Edit mode. Only one add row at a time. */
    const [addOpen, setAddOpen] = useState(false);
    const [addSaving, setAddSaving] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const refresh = () => setRefreshKey((k) => k + 1);

    const group: PurposeGroup = activeTab === "withdrawal" ? "6" : "4";

    /* Active list (deposit / withdrawal). The fetcher short-circuits on
     * the Deleted tab so switching tabs doesn't fire a wasted group
     * query. */
    const { data: activeData, loading: activeLoading } = useApiData(
        () =>
            activeTab === "deleted"
                ? Promise.resolve({ list: [] as ApiPurposeSettingRow[] })
                : fetchPurposeSettings({ group }),
        [activeTab, group, refreshKey],
    );

    /* Deleted list — only fetched while the Deleted tab is active. */
    const { data: deletedData, loading: deletedLoading } = useApiData(
        () =>
            activeTab === "deleted"
                ? fetchDeletedPurposeSettings()
                : Promise.resolve({ list: [] }),
        [activeTab, refreshKey],
    );

    const stickyLoading = useStickyLoading(
        activeTab === "deleted" ? deletedLoading : activeLoading,
    );

    const viewRows: PurposeRowVM[] = useMemo(() => {
        if (!activeData) return [];
        return flatten(activeData.list);
    }, [activeData]);

    const deletedRows: DeletedPurposeItem[] = useMemo(() => {
        if (!deletedData) return [];
        return deletedData.list.map((r) => ({
            useUsagCd: r.use_usag_cd,
            code: r.hand_use_usag_cd ?? "",
            name: r.use_usag_nm ?? "",
            description: r.use_usag_cont ?? "",
            group: r.usag_grp_cd,
        }));
    }, [deletedData]);

    /* Rows the table renders: the live view list, or the editable draft
     * while an Edit / Add session is open. */
    const rows = mode === "edit" ? draft : viewRows;

    /* ---------------------------------------------------------------- */
    /*  Tab switching (blocked mid-edit to avoid silent data loss)       */
    /* ---------------------------------------------------------------- */
    function switchTab(tab: PurposeTab) {
        if (mode === "edit" || addOpen) return; // guarded by disabled tabs
        setActiveTab(tab);
    }

    /* ---------------------------------------------------------------- */
    /*  Edit-mode lifecycle (bulk edit / reorder / delete)              */
    /* ---------------------------------------------------------------- */
    function enterEdit() {
        setAddOpen(false); // Add and Edit are mutually exclusive (legacy)
        setDraft(viewRows.map((r) => ({ ...r })));
        setMode("edit");
    }

    function cancelEdit() {
        setDraft([]);
        setMode("view");
    }

    /* ---------------------------------------------------------------- */
    /*  Inline single-row Add (legacy — does NOT enter Edit mode)       */
    /* ---------------------------------------------------------------- */
    function openAdd() {
        if (mode === "edit" || addOpen) return;
        setAddOpen(true);
    }

    async function handleAddSave(d: { code: string; name: string; description: string }) {
        if (!d.code.trim() || !d.name.trim()) {
            surfaceErrorDialog("WBE_VALIDATION", t("settings.purpose.error.required"));
            return;
        }
        setAddSaving(true);
        try {
            await createPurposeSetting({
                hand_use_usag_cd: d.code.trim(),
                use_usag_nm: d.name.trim(),
                use_usag_cont: d.description.trim() || null,
                disp_yn: "Y",
                usag_grp_cd: group,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.purpose.success.created"),
            });
            setAddOpen(false);
            refresh();
        } catch (err) {
            surfaceMutationError(err);
        } finally {
            setAddSaving(false);
        }
    }

    function editField(key: string, field: "code" | "name" | "description", value: string) {
        setDraft((d) => d.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    }

    function deleteDraftRow(key: string) {
        setDraft((d) => d.filter((r) => r.key !== key));
    }

    function reorderDraft(from: number, to: number) {
        setDraft((d) => {
            const next = [...d];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
        });
    }

    async function handleSave() {
        // Drop wholly-empty appended rows; every kept row needs code + name.
        const kept = draft.filter((r) => !(r.isNew && !r.code.trim() && !r.name.trim()));
        for (const r of kept) {
            if (!r.code.trim() || !r.name.trim()) {
                surfaceErrorDialog("WBE_VALIDATION", t("settings.purpose.error.required"));
                return;
            }
        }

        const origByCd = new Map(viewRows.filter((r) => r.useUsagCd).map((r) => [r.useUsagCd, r]));
        const keptCds = new Set(kept.filter((r) => r.useUsagCd).map((r) => r.useUsagCd));

        try {
            // 1. Deletes — persisted rows removed from the draft.
            for (const o of viewRows) {
                if (o.useUsagCd && !keptCds.has(o.useUsagCd)) {
                    await deletePurposeSetting(o.useUsagCd);
                }
            }
            // 2. Creates + updates, capturing the resolved PK order.
            const orderedCds: string[] = [];
            for (const r of kept) {
                if (r.isNew || !r.useUsagCd) {
                    const created = await createPurposeSetting({
                        hand_use_usag_cd: r.code.trim(),
                        use_usag_nm: r.name.trim(),
                        use_usag_cont: r.description.trim() || null,
                        disp_yn: "Y",
                        usag_grp_cd: group,
                    });
                    orderedCds.push(created.use_usag_cd);
                } else {
                    const o = origByCd.get(r.useUsagCd);
                    if (
                        o &&
                        (o.code !== r.code.trim() ||
                            o.name !== r.name.trim() ||
                            (o.description ?? "") !== r.description.trim())
                    ) {
                        await updatePurposeSetting(r.useUsagCd, {
                            hand_use_usag_cd: r.code.trim(),
                            use_usag_nm: r.name.trim(),
                            use_usag_cont: r.description.trim() || null,
                            disp_yn: o.enabled ? "Y" : "N",
                        });
                    }
                    orderedCds.push(r.useUsagCd);
                }
            }
            // 3. Persist the new display order in one shot.
            if (orderedCds.length > 0) {
                await reorderPurposeSettings({
                    items: orderedCds.map((cd, i) => ({ use_usag_cd: cd, disp_ord: i + 1 })),
                });
            }
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.purpose.success.saved"),
            });
            setMode("view");
            setDraft([]);
            refresh();
        } catch (err) {
            surfaceMutationError(err);
        }
    }

    /* ---------------------------------------------------------------- */
    /*  View-mode row actions                                            */
    /* ---------------------------------------------------------------- */
    async function handleToggle(row: PurposeRowVM, next: boolean) {
        if (!row.useUsagCd) return;
        try {
            await updatePurposeSetting(row.useUsagCd, {
                hand_use_usag_cd: row.code,
                use_usag_nm: row.name,
                use_usag_cont: row.description.trim() || null,
                disp_yn: next ? "Y" : "N",
            });
            refresh();
        } catch (err) {
            surfaceMutationError(err);
        }
    }

    async function handleRestore(row: DeletedPurposeItem) {
        if (busyIds.has(row.useUsagCd)) return;
        setBusyIds((s) => new Set(s).add(row.useUsagCd));
        try {
            await restorePurposeSetting(row.useUsagCd);
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.purpose.success.restored"),
            });
            refresh();
        } catch (err) {
            surfaceMutationError(err);
        } finally {
            setBusyIds((s) => {
                const n = new Set(s);
                n.delete(row.useUsagCd);
                return n;
            });
        }
    }

    /* ---------------------------------------------------------------- */
    /*  Error surfacing (shared with the previous panel)                */
    /* ---------------------------------------------------------------- */
    function surfaceMutationError(err: unknown) {
        if (err instanceof ApiCallError) {
            surfaceErrorDialog(err.code, err.message);
            return;
        }
        const message = err instanceof Error ? err.message : String(err);
        surfaceErrorDialog("WBE9999", message);
    }

    function surfaceErrorDialog(code: string, serverMessage: string) {
        let description = serverMessage;
        if (code === "WBE1199") description = t("settings.purpose.error.delete_blocked");
        else if (code === "WBW1152") description = t("settings.purpose.error.duplicate_code");
        else if (code === "WBW1138") description = t("settings.purpose.error.duplicate_name");
        else if (code === "WBE_VALIDATION") description = serverMessage;
        else if (code === "NETWORK") description = t("settings.purpose.error.network");
        dialog.open({ type: "error", title: t("dialog.error"), description, errorCode: code });
    }

    /* ---------------------------------------------------------------- */
    /*  Render                                                           */
    /* ---------------------------------------------------------------- */
    const isDeleted = activeTab === "deleted";
    const showEmpty =
        !stickyLoading &&
        (isDeleted ? deletedRows.length === 0 : rows.length === 0) &&
        mode !== "edit";

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header */}
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

            {/* Tabs */}
            <div className="shrink-0 px-8">
                <PurposeTabs
                    active={activeTab}
                    onChange={switchTab}
                    disabled={mode === "edit" || addOpen}
                />
            </div>

            {/* Toolbar — Edit / Cancel+Save (active tabs only) */}
            {!isDeleted && (
                <div className="flex shrink-0 items-center justify-end gap-2 px-8 pt-4">
                    {mode === "view" ? (
                        <button
                            type="button"
                            onClick={enterEdit}
                            disabled={addOpen}
                            className="flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Pencil className="size-4" strokeWidth={1.8} />
                            {t("settings.purpose.edit")}
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t("dialog.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            >
                                {t("dialog.save")}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Scroll region */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pt-3">
                <div className="custom-scrollbar-y h-full overflow-auto">
                    <div className="flex h-full min-w-min flex-col">
                        {isDeleted ? (
                            <DeletedPurposeTable
                                rows={deletedRows}
                                onRestore={handleRestore}
                                restoringIds={busyIds}
                            />
                        ) : (
                            <>
                                <PurposeTable
                                    rows={rows}
                                    mode={mode}
                                    onToggle={handleToggle}
                                    onFieldChange={editField}
                                    onDeleteRow={deleteDraftRow}
                                    onReorder={reorderDraft}
                                />
                                {mode === "view" && addOpen && (
                                    <AddPurposeRow
                                        onCancel={() => setAddOpen(false)}
                                        onSave={handleAddSave}
                                        saving={addSaving}
                                    />
                                )}
                            </>
                        )}
                        {(stickyLoading || showEmpty) && (
                            <div
                                className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6"
                                role="status"
                            >
                                {stickyLoading
                                    ? t("settings.purpose.list.loading")
                                    : t("settings.purpose.list.empty")}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* + Add Purpose (active tabs only) */}
            {!isDeleted && (
                <button
                    type="button"
                    onClick={openAdd}
                    disabled={mode === "edit" || addOpen}
                    className={cn(
                        "mx-8 mb-3 mt-3 flex h-9 shrink-0 items-center justify-center gap-1 rounded-md border border-wb-ntrl-4 bg-white text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]",
                        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.purpose.add")}
                </button>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------- */
/*  Helpers                                                              */
/* -------------------------------------------------------------------- */

function flatten(rows: ApiPurposeSettingRow[]): PurposeRowVM[] {
    const out: PurposeRowVM[] = [];
    for (const r of rows) {
        out.push({
            key: r.use_usag_cd,
            useUsagCd: r.use_usag_cd,
            // Legacy grp 4/6 rows can carry NULL hand code / name; coerce
            // to "" so the Edit-mode controlled <input>s never receive null.
            code: r.hand_use_usag_cd ?? "",
            name: r.use_usag_nm ?? "",
            description: r.use_usag_cont ?? "",
            enabled: r.disp_yn === "Y",
        });
        if (r.children?.length) out.push(...flatten(r.children));
    }
    return out;
}

