"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Pencil } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import ToggleSwitch from "@/components/settings/ToggleSwitch";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { ApiCallError } from "@/lib/api/banking";
import {
    deleteManagementCard,
    fetchManagementCards,
    patchCardActive,
    patchCardInfo,
} from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import AddCardFlowDialog from "./AddCardFlowDialog";
import {
    mapCardManagementCard,
    type CardManagementCard,
} from "./cardTransactionMappers";

type CardManagementDialogProps = {
    open:    boolean;
    onClose: () => void;
};

/**
 * Card Management Setting modal — legacy {@code card_0001_003}.
 *
 * <p>Reads / mutates {@code CARD_MSTR}: list (sort), toggle ACTV_YN,
 * inline-rename Card Holder / Card Nickname, delete (with the
 * legacy {@code WBE1153} in-use guard). The "+ Add Card" button is
 * rendered disabled — the legacy add flow opens an NXISAS scrape
 * popup which is not in scope for the refactor (will land with the
 * NXISAS coexistence port).
 *
 * <p>Sort cycle: {@code default → ASC → DESC → default} via the shared
 * {@link useTableSort} hook + {@link TableHeaderCell}. Whitelist FIELD_IDs
 * mirror the backend `CardMstrSortField` enum.
 *
 * <p>Drag-to-reorder is intentionally not implemented — the legacy
 * jQuery-UI sortable in {@code card_0001_003.ts:63-87} only animates,
 * never persists `PRN_SEQ`. Same visual handle would be misleading;
 * we drop it.
 */
export default function CardManagementDialog({
    open,
    onClose,
}: CardManagementDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();
    const sort = useTableSort();

    /** Bumped after every successful mutation so {@link useApiData}
     *  re-fires and the table reflects the new state. */
    const [refreshKey, setRefreshKey] = useState(0);
    const refreshList = useCallback(() => setRefreshKey((k) => k + 1), []);
    /** Whether the Add Card popup chain (Bank → Login → Cards) is open. */
    const [addCardOpen, setAddCardOpen] = useState(false);

    // Reset the sort + refresh state every time the dialog is closed
    // so the next open starts fresh — same key-reset pattern used by
    // the inline-edit dialogs.
    useEffect(() => {
        if (!open) {
            sort.setSort({ sortField: null, sortDirection: null });
            setRefreshKey(0);
            setEditing(null);
            setDraft({ cardHldrNm: "", cardNickNm: "" });
            setAddCardOpen(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const state = useApiData(
        () =>
            open
                ? fetchManagementCards({
                      sortField:     sort.sortParams?.sortField,
                      sortDirection: sort.sortParams?.sortDirection,
                      size:          100,
                  }).then((api) => ({
                      totalCount: api.total_count,
                      rows:       api.rows.map((r) =>
                          mapCardManagementCard(r, locale),
                      ),
                  }))
                : Promise.resolve({ totalCount: 0, rows: [] as CardManagementCard[] }),
        [open, sort.sortField, sort.sortDirection, refreshKey, locale],
    );

    // Stable identity across renders so the commitEdit / handleToggleActive
    // callbacks below don't re-create on every render (eslint
    // react-hooks/exhaustive-deps would otherwise warn).
    const rows: CardManagementCard[] = useMemo(
        () => state.data?.rows ?? [],
        [state.data?.rows],
    );

    // Surface fetch errors as a single error dialog per change. The
    // page-level pattern from CardTransactionsPage works here too.
    useEffect(() => {
        if (!state.error || state.loading) return;
        const err = state.error;
        const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
        const message = err instanceof ApiCallError ? err.message : t("payment.card.management.fetch_failed");
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: message,
            errorCode: code,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.error, state.loading]);

    /* ------------------------------------------------------------------
     *  Inline-edit state (Card Holder + Card Nickname)
     * ---------------------------------------------------------------- */

    type EditTarget = {
        bankCd: string;
        cardNo: string;
        field:  "cardHldrNm" | "cardNickNm";
    } | null;

    const [editing, setEditing] = useState<EditTarget>(null);
    const [draft, setDraft]     = useState<{ cardHldrNm: string; cardNickNm: string }>({
        cardHldrNm: "",
        cardNickNm: "",
    });

    const startEdit = useCallback((row: CardManagementCard, field: "cardHldrNm" | "cardNickNm") => {
        setDraft({ cardHldrNm: row.cardHldrNm, cardNickNm: row.cardNickNm ?? "" });
        setEditing({ bankCd: row.bankCd, cardNo: row.cardNo, field });
    }, []);

    const cancelEdit = useCallback(() => setEditing(null), []);

    const commitEdit = useCallback(async () => {
        if (!editing) return;
        const original = rows.find(
            (r) => r.bankCd === editing.bankCd && r.cardNo === editing.cardNo,
        );
        if (!original) {
            setEditing(null);
            return;
        }

        const nextHldr = draft.cardHldrNm.trim();
        const nextNick = draft.cardNickNm.trim();

        // Bail when nothing changed.
        const sameHldr = nextHldr === original.cardHldrNm.trim();
        const sameNick = nextNick === (original.cardNickNm ?? "").trim();
        if (sameHldr && sameNick) {
            setEditing(null);
            return;
        }
        if (nextHldr.length === 0) {
            // Legacy parity — card_hldr_nm is required at the backend
            // (WBE_VALIDATION). Refuse the empty case before round-trip.
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("payment.card.management.dialog.hldr_required"),
                errorCode: "WBE_VALIDATION",
            });
            return;
        }

        try {
            await patchCardInfo(editing.bankCd, editing.cardNo, {
                card_hldr_nm: nextHldr,
                card_nick_nm: nextNick.length === 0 ? null : nextNick,
            });
            setEditing(null);
            refreshList();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("payment.card.management.dialog.save_failed");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        }
    }, [editing, draft, rows, dialog, refreshList, t]);

    /* ------------------------------------------------------------------
     *  Toggle active
     * ---------------------------------------------------------------- */

    const handleToggleActive = useCallback(
        async (row: CardManagementCard) => {
            const next = row.active ? "N" : "Y";
            try {
                await patchCardActive(row.bankCd, row.cardNo, { actv_yn: next });
                refreshList();
            } catch (err) {
                const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
                const message = err instanceof ApiCallError ? err.message : t("payment.card.management.toggle_failed");
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode: code,
                });
            }
        },
        [dialog, refreshList, t],
    );

    /* ------------------------------------------------------------------
     *  Delete card (with WBE1153 in-use guard)
     * ---------------------------------------------------------------- */

    const handleDelete = useCallback(
        (row: CardManagementCard) => {
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t("payment.card.management.delete_confirm", {
                    cardNo: row.cardNo,
                }),
                confirmText: t("dialog.continue"),
                cancelText:  t("dialog.cancel"),
                destructive: true,
                onConfirm: async () => {
                    try {
                        await deleteManagementCard(row.bankCd, row.cardNo);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t("payment.card.management.delete_success"),
                        });
                        refreshList();
                    } catch (err) {
                        const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
                        const message = err instanceof ApiCallError ? err.message : t("payment.card.management.delete_failed");
                        dialog.open({
                            type: "error",
                            title: t("dialog.error"),
                            description: message,
                            errorCode: code,
                        });
                    }
                },
            });
        },
        [dialog, refreshList, t],
    );

    /* ------------------------------------------------------------------
     *  Render
     * ---------------------------------------------------------------- */

    const colCount = useMemo(() => 6, []);

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent
                className="max-w-[1080px]"
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <DialogTitle>
                        {t("payment.card.management.title")}
                    </DialogTitle>
                </DialogHeader>
                <DialogBody className="px-0 py-0">
                    <div className="custom-scrollbar-y max-h-[60vh] overflow-y-auto px-6 pb-4">
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col className="w-[180px]" />
                                <col className="w-[180px]" />
                                <col className="w-[220px]" />
                                <col className="w-[180px]" />
                                <col className="w-[170px]" />
                                <col className="w-[88px]" />
                            </colgroup>
                            <TableHeader className="sticky top-0 z-10 bg-white">
                                <TableRow className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                                    <TableHeaderCell
                                        textSizeClass="text-wb-13"
                                        sortable
                                        sortFieldId="BANK_CD"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                    >
                                        {t("payment.card.management.col.card_company")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        textSizeClass="text-wb-13"
                                        sortable
                                        sortFieldId="CARD_NO"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                    >
                                        {t("payment.card.management.col.card_number")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        textSizeClass="text-wb-13"
                                        sortable
                                        sortFieldId="CARD_HLDR_NM"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                    >
                                        {t("payment.card.management.col.card_holder")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        textSizeClass="text-wb-13"
                                        sortable
                                        sortFieldId="CARD_NICK_NM"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                    >
                                        {t("payment.card.management.col.card_nickname")}
                                    </TableHeaderCell>
                                    <TableHeaderCell
                                        textSizeClass="text-wb-13"
                                        sortable
                                        sortFieldId="MOD_DTM"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                    >
                                        {t("payment.card.management.col.last_update")}
                                    </TableHeaderCell>
                                    <TableCell className="px-2 py-2.5" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {state.loading && rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={colCount}
                                            className="px-3 py-6 text-center text-wb-13 font-medium text-wb-muted"
                                        >
                                            {t("common.loading")}
                                        </TableCell>
                                    </TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={colCount}
                                            className="px-3 py-6 text-center text-wb-13 font-medium text-wb-muted"
                                        >
                                            {t("payment.card.management.empty")}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row) => {
                                        const isEditingHldr = editing?.bankCd === row.bankCd && editing?.cardNo === row.cardNo && editing?.field === "cardHldrNm";
                                        const isEditingNick = editing?.bankCd === row.bankCd && editing?.cardNo === row.cardNo && editing?.field === "cardNickNm";
                                        return (
                                            <TableRow
                                                key={`${row.bankCd}::${row.cardNo}`}
                                                className="h-[var(--h-wb-table-row)] border-b border-wb-table-border last:border-b-0"
                                            >
                                                {/* Card Company */}
                                                <TableCell className="px-3 py-2.5">
                                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                        {row.bankNm || row.bankCd}
                                                    </span>
                                                </TableCell>
                                                {/* Card Number */}
                                                <TableCell className="px-3 py-2.5">
                                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                        {row.cardNo}
                                                    </span>
                                                </TableCell>
                                                {/* Card Holder — inline edit */}
                                                <TableCell className="group px-3 py-2.5">
                                                    {isEditingHldr ? (
                                                        <InlineEditInput
                                                            value={draft.cardHldrNm}
                                                            onChange={(v) =>
                                                                setDraft((d) => ({ ...d, cardHldrNm: v }))
                                                            }
                                                            onCommit={commitEdit}
                                                            onCancel={cancelEdit}
                                                            ariaLabel={t("payment.card.management.col.card_holder")}
                                                            maxLength={50}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className="truncate text-wb-13 font-medium text-wb-ink"
                                                                title={row.cardHldrNm}
                                                            >
                                                                {row.cardHldrNm}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                aria-label={t("payment.card.management.edit_holder")}
                                                                onClick={() => startEdit(row, "cardHldrNm")}
                                                                className="invisible inline-flex shrink-0 cursor-pointer rounded p-0.5 text-wb-ntrl-6 hover:text-brand group-hover:visible"
                                                            >
                                                                <Pencil className="size-4" strokeWidth={1.7} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                {/* Card Nickname — inline edit */}
                                                <TableCell className="group px-3 py-2.5">
                                                    {isEditingNick ? (
                                                        <InlineEditInput
                                                            value={draft.cardNickNm}
                                                            onChange={(v) =>
                                                                setDraft((d) => ({ ...d, cardNickNm: v }))
                                                            }
                                                            onCommit={commitEdit}
                                                            onCancel={cancelEdit}
                                                            ariaLabel={t("payment.card.management.col.card_nickname")}
                                                            maxLength={50}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className="truncate text-wb-13 font-medium text-wb-ink"
                                                                title={row.cardNickNm ?? ""}
                                                            >
                                                                {row.cardNickNm ?? ""}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                aria-label={t("payment.card.management.edit_nickname")}
                                                                onClick={() => startEdit(row, "cardNickNm")}
                                                                className="invisible inline-flex shrink-0 cursor-pointer rounded p-0.5 text-wb-ntrl-6 hover:text-brand group-hover:visible"
                                                            >
                                                                <Pencil className="size-4" strokeWidth={1.7} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                {/* Last update */}
                                                <TableCell className="px-3 py-2.5">
                                                    <span className="block truncate text-wb-13 font-medium text-wb-muted">
                                                        {row.lastUpdate}
                                                    </span>
                                                </TableCell>
                                                {/* Toggle + delete */}
                                                <TableCell className="px-3 py-2.5">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <ToggleSwitch
                                                            checked={row.active}
                                                            onChange={() => handleToggleActive(row)}
                                                            ariaLabel={
                                                                row.active
                                                                    ? t("payment.card.management.deactivate")
                                                                    : t("payment.card.management.activate")
                                                            }
                                                            tone="brand"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(row)}
                                                            aria-label={t("payment.card.management.delete")}
                                                            className={cn(
                                                                "inline-flex size-6 cursor-pointer items-center justify-center rounded-full",
                                                                "border border-wb-status-rejected-text text-wb-status-rejected-text hover:bg-wb-status-rejected-bg",
                                                            )}
                                                        >
                                                            <Minus className="size-3.5" strokeWidth={2} />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </table>
                    </div>

                    <div className="border-t border-wb-table-border px-6 py-3">
                        <button
                            type="button"
                            onClick={() => setAddCardOpen(true)}
                            className="inline-flex h-[var(--h-wb-filter-btn)] cursor-pointer items-center gap-1.5 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-neutral-50"
                        >
                            <span className="text-wb-16 leading-none">+</span>
                            {t("payment.card.management.add_card")}
                        </button>
                    </div>
                </DialogBody>
            </DialogContent>

            {/* Add Card flow — Bank → Login → (challenges) → Cards.
                Mounted on-demand so the Coocon bank list fetch doesn't
                fire until the user actually wants to register cards. */}
            {addCardOpen && (
                <AddCardFlowDialog
                    onClose={() => setAddCardOpen(false)}
                    onSuccess={refreshList}
                />
            )}
        </Dialog>
    );
}

/* ------------------------------------------------------------------------
 *  Inline-edit input
 * ----------------------------------------------------------------------*/

type InlineEditInputProps = {
    value:      string;
    onChange:   (next: string) => void;
    onCommit:   () => void;
    onCancel:   () => void;
    ariaLabel:  string;
    maxLength:  number;
};

function InlineEditInput({
    value,
    onChange,
    onCommit,
    onCancel,
    ariaLabel,
    maxLength,
}: InlineEditInputProps) {
    return (
        <input
            type="text"
            autoFocus
            aria-label={ariaLabel}
            value={value}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    onCommit();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
            }}
            onBlur={onCommit}
            className={cn(
                "block w-full rounded-md border border-wb-ntrl-4 bg-white px-2 py-1 text-wb-13 font-medium text-wb-ink",
                "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40",
            )}
        />
    );
}
