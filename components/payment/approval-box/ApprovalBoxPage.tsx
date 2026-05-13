"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import { useDialog } from "@/components/shared/dialog";
import {
    ViewSettingPopover,
    useViewSetting,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { approvalBoxCurrencyTotal } from "@/lib/api/mappers";
import { useTranslation } from "@/lib/i18n";
import { SCREEN_IDS } from "@/lib/viewSettingScreens";

import ApprovalTable from "./ApprovalTable";
import ApprovalTableFooter from "./ApprovalTableFooter";
import ApprovalTabs from "./ApprovalTabs";
import BulkActionBar from "./BulkActionBar";
import FilterBar from "./FilterBar";
import RowActionDialog from "./RowActionDialog";
import { useApprovalBoxList } from "./useApprovalBoxList";
import type { ApprovalRow, RowAction } from "./types";

/** Maps the View Setting `FIELD_ID` seeded in V84 to the i18n header
 *  key the page already uses for the table column. Used by the popover
 *  so the row label reads "Date" / "Type" / … instead of the raw DB
 *  identifier. */
const FIELD_ID_TO_LABEL_KEY: Record<string, string> = {
    REG_DTM: "approval.col.date",
    DOC_NM: "approval.col.type",
    DOC_NO: "approval.col.document_no",
    TITL: "approval.col.title",
    TOT_PAY_AMT: "approval.col.amount",
    PAY_END_YN: "approval.col.status",
    PAY_DATE: "approval.col.scheduled",
    DRAFT_USER_NM: "approval.col.requestor",
    APPRER_NM: "approval.col.approver",
    CURRENCY: "approval.col.currency",
};

export default function ApprovalBoxPage() {
    const { t } = useTranslation();
    const sysDialog = useDialog();
    const list = useApprovalBoxList();
    const viewSetting = useViewSetting(SCREEN_IDS.PAYMENT_APPROVAL_BOX);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [activeRow, setActiveRow] = useState<ApprovalRow | null>(null);
    const [activeAction, setActiveAction] = useState<RowAction>("approve");
    const [dialogOpen, setDialogOpen] = useState(false);

    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[]>([]);

    const data = list.data;
    const rows = useMemo(() => data?.rows ?? [], [data]);
    const tabCounts = data?.tabCounts ?? {
        all: 0,
        draft: 0,
        pending: 0,
        in_progress: 0,
        approved: 0,
        rejected: 0,
    };
    const totalCount = data?.totalCount ?? 0;
    const totalPages = data?.totalPages ?? 0;

    const displayRows = useMemo<ApprovalRow[]>(
        () =>
            rows.map((r) => ({
                ...r,
                type: r.typeKey ? t(`approval.type.${r.typeKey}`) : r.documentNo,
            })),
        [rows, t],
    );

    const currencyTotals = useMemo(
        () => approvalBoxCurrencyTotal(displayRows),
        [displayRows],
    );

    const toggleRow = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(
        (next: boolean) => {
            setSelected(next ? new Set(displayRows.map((r) => r.id)) : new Set());
        },
        [displayRows],
    );

    const clearSelection = useCallback(() => setSelected(new Set()), []);

    const openRowAction = useCallback((row: ApprovalRow, action: RowAction) => {
        setActiveRow(row);
        setActiveAction(action);
        setDialogOpen(true);
    }, []);

    const onActionSuccess = useCallback(() => {
        void list.refetch();
    }, [list]);

    const listError = list.error;
    useEffect(() => {
        if (!listError) return;
        sysDialog.open({
            type: "error",
            title: t("dialog.error"),
            description: listError.message,
            errorCode: listError.code,
            uuid: listError.traceId,
        });
    }, [listError, sysDialog, t]);

    const openViewSetting = useCallback(
        (anchor: DOMRect) => {
            setVsDraft(viewSetting.items as ViewSettingItem[]);
            setVsAnchor(anchor);
        },
        [viewSetting.items],
    );
    const closeViewSetting = useCallback(() => setVsAnchor(null), []);

    const notifyDeferred = useCallback(
        (key: "print" | "excel") => {
            sysDialog.open({
                type: "warning",
                title: t("dialog.warning"),
                description: t(`approval.deferred.${key}`),
            });
        },
        [sysDialog, t],
    );

    return (
        <PageLayout>
            <PageHeader title={t("approval.title")}>
                <PageActionButtons
                    showList
                    showPrint
                    showExcel
                    onList={openViewSetting}
                    onPrint={() => notifyDeferred("print")}
                    onExport={() => notifyDeferred("excel")}
                />
            </PageHeader>

            <ApprovalTabs
                active={list.tab}
                counts={tabCounts}
                onChange={list.setTab}
            />

            <FilterBar
                startDateIso={list.fromDateIso}
                endDateIso={list.toDateIso}
                search={list.search}
                onSearchChange={list.setSearch}
                onDateChange={list.setDateRange}
            />

            <DataTableShell
                footerMode="paginationWithTotals"
                table={
                    <ApprovalTable
                        rows={displayRows}
                        selectedIds={selected}
                        onToggleRow={toggleRow}
                        onToggleAll={toggleAll}
                        onRowAction={openRowAction}
                    />
                }
                footer={
                    <ApprovalTableFooter
                        documentCount={totalCount}
                        totals={currencyTotals}
                        className="mt-auto"
                    />
                }
                pagination={
                    <Pagination
                        page={list.page + 1}
                        pageCount={Math.max(totalPages, 1)}
                        pageSize={list.pageSize}
                        totalLabel={t("approval.pagination_label", {
                            shown: displayRows.length,
                            total: totalCount,
                        })}
                        className="shrink-0"
                        onPageChange={(p: number) => list.setPage(Math.max(0, p - 1))}
                        onPageSizeChange={(s: number) => list.setPageSize(s)}
                    />
                }
            />

            <BulkActionBar
                selectedIds={Array.from(selected)}
                onClear={clearSelection}
                onSuccess={onActionSuccess}
            />

            <RowActionDialog
                open={dialogOpen}
                row={activeRow}
                action={activeAction}
                onClose={() => setDialogOpen(false)}
                onSuccess={onActionSuccess}
            />

            {vsAnchor && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={setVsDraft}
                    getLabel={(item) => {
                        const key = FIELD_ID_TO_LABEL_KEY[item.field_id];
                        return key ? t(key) : item.field_nm;
                    }}
                    onSave={async () => {
                        await viewSetting.save(vsDraft);
                        closeViewSetting();
                    }}
                    onReset={async () => {
                        const fresh = await viewSetting.reset();
                        setVsDraft(fresh as ViewSettingItem[]);
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </PageLayout>
    );
}
