"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Minus, Plus, X } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import ToggleSwitch from "@/components/settings/ToggleSwitch";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    TableBody,
    TableCell,
    TableHead,
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
    cardModDtmNow,
    mapCardManagementCard,
    type CardManagementCard,
} from "./cardTransactionMappers";
import InlineEditButton from "./InlineEditButton";
import InlineEditInput from "./InlineEditInput";

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
 * <p>The Figma {@code ico_move} drag handle (leftmost column) is
 * rendered as a decorative affordance for visual parity — it is NOT
 * wired to reorder rows. The legacy jQuery-UI sortable in
 * {@code card_0001_003.ts:63-87} only animates and never persists
 * `PRN_SEQ`, so there is no behaviour to reproduce; the handle exists
 * purely to match the Figma frame (516:18404).
 */
export default function CardManagementDialog({
    open,
    onClose,
}: CardManagementDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();
    const sort = useTableSort();

    /** Bumped after a successful delete / edit / add so {@link useApiData}
     *  re-fires and the table reflects the new state. The Use toggle
     *  deliberately does NOT bump this — it patches the row in local
     *  state so the open modal's row order stays put (see
     *  {@code handleToggleActive}). */
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

    // Local ordered copy of the fetched rows — the single render source
    // for the table. Re-seeded whenever a real fetch resolves (open,
    // sort change, refreshKey bump after delete / edit / add), but
    // patchable in place so the Use toggle can flip ONE row's state
    // without a refetch. A refetch after toggle would come back in the
    // backend's default ORDER BY (which reads ACTV_YN / MOD_DTM — both
    // changed by the toggle) and visibly reorder the open modal.
    const [rows, setRows] = useState<CardManagementCard[]>([]);
    useEffect(() => {
        if (state.data?.rows) setRows(state.data.rows);
    }, [state.data?.rows]);

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
                // Patch the toggled row in place — deliberately NO
                // refreshList() here. Refetching would re-apply the
                // backend's default ORDER BY (which the toggle itself
                // perturbs via ACTV_YN / MOD_DTM) and make rows jump
                // around inside the open modal. The server state and
                // this local flip are identical, so the next real fetch
                // (reopen / sort / delete / edit / add) reconciles
                // everything anyway. The backend also bumps MOD_DTM on
                // this PATCH, so mirror that locally (cardModDtmNow) —
                // the "Last update" cell reflects the new update time
                // ("just now", VN-local) without a refetch.
                const stamp = cardModDtmNow(locale);
                setRows((prev) =>
                    prev.map((r) =>
                        r.bankCd === row.bankCd && r.cardNo === row.cardNo
                            ? {
                                  ...r,
                                  active: next === "Y",
                                  modDtmRaw: stamp.modDtmRaw,
                                  lastUpdate: stamp.lastUpdate,
                              }
                            : r,
                    ),
                );
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
        [dialog, t, locale],
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

    // drag + company + number + holder + nickname + last-update + use + delete
    const colCount = useMemo(() => 8, []);

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent
                className="max-w-[1077px] rounded-2xl"
                hideClose
                aria-describedby={undefined}
                // The delete confirmation renders through useDialog() /
                // SystemDialog in a separate body portal (z-[100]) — i.e.
                // OUTSIDE this Radix content subtree. With outside-click
                // dismissal enabled, clicking Cancel / Continue / X /
                // backdrop on that confirmation counts as a pointer-down
                // outside this modal and would close the parent too. Disable
                // outside-click dismissal so the Card Management modal stays
                // open while the nested confirmation opens/closes; X + Esc
                // remain the close affordances. (ESC is already gated by the
                // shared modalStack so only the top-most modal responds.)
                closeOnOutsideClick={false}
            >
                {/* Header — 16/600 title, Esc chip + close. The header's own
                    border-b was removed: sitting ~20px above the table's top
                    border, it sandwiched the body's top padding into an empty
                    bordered strip below the title. The framed table (border-y)
                    below is the divider now. */}
                <div className="flex items-center justify-between px-5 py-4">
                    <DialogTitle className="text-wb-16 font-semibold text-wb-ink">
                        {t("payment.card.management.title")}
                    </DialogTitle>
                    <div className="flex items-center gap-1">
                        <span className="rounded bg-wb-ntrl-3 px-1 py-px text-wb-13 font-medium text-wb-ink opacity-40">
                            Esc
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                        >
                            <X className="size-5" strokeWidth={2} />
                        </button>
                    </div>
                </div>

                {/* Body — Figma 516:18422 (p-20). gap-6 gives the Add Card
                    row extra breathing room above it. */}
                <div className="flex flex-col gap-6 p-5">
                    {/* Data table — bordered top+bottom (Figma 516:18422).
                        The empty strip that used to sit above the column
                        headers was NOT this frame — it was the modal header's
                        separate border-b (removed above) sandwiching the body
                        top padding. Height fits the content (max-h caps +
                        scrolls only when the list is long) so few rows don't
                        leave a tall empty region. */}
                    <div className="custom-scrollbar-y max-h-[376px] overflow-y-auto border-y border-wb-border-sidebar">
                        <table className="w-full table-fixed border-collapse">
                            <colgroup>
                                <col className="w-[38px]" />
                                <col className="w-[140px]" />
                                <col className="w-[168px]" />
                                <col className="w-[176px]" />
                                <col />
                                <col className="w-[132px]" />
                                <col className="w-[60px]" />
                                <col className="w-[40px]" />
                            </colgroup>
                            <TableHeader className="sticky top-0 z-10">
                                <TableRow className="h-10 border-b border-wb-border-sidebar hover:bg-transparent">
                                    {/* Drag handle — empty header. */}
                                    <TableHead className="bg-wb-bg-card" />
                                    <TableHeaderCell
                                        textSizeClass="text-wb-13"
                                        className="bg-wb-bg-card"
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
                                        className="bg-wb-bg-card"
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
                                        className="bg-wb-bg-card"
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
                                        className="bg-wb-bg-card"
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
                                        className="bg-wb-bg-card"
                                        sortable
                                        sortFieldId="MOD_DTM"
                                        activeSortField={sort.sortField}
                                        activeSortDirection={sort.sortDirection}
                                        onSort={sort.toggleSort}
                                    >
                                        {t("payment.card.management.col.last_update")}
                                    </TableHeaderCell>
                                    {/* Use — backend CardMstrSortField has no ACTV
                                        member, so the column stays non-sortable
                                        (no inert glyph) per CLAUDE.md §13a. */}
                                    <TableHeaderCell
                                        textSizeClass="text-wb-13"
                                        className="bg-wb-bg-card"
                                        sortable={false}
                                    >
                                        {t("payment.card.management.col.use")}
                                    </TableHeaderCell>
                                    {/* Delete — empty header. */}
                                    <TableHead className="bg-wb-bg-card" />
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
                                    rows.map((row, index) => {
                                        const isEditingHldr = editing?.bankCd === row.bankCd && editing?.cardNo === row.cardNo && editing?.field === "cardHldrNm";
                                        const isEditingNick = editing?.bankCd === row.bankCd && editing?.cardNo === row.cardNo && editing?.field === "cardNickNm";
                                        return (
                                            <TableRow
                                                key={`${row.bankCd}::${row.cardNo}`}
                                                className={cn(
                                                    "h-11 border-b border-wb-border-sidebar",
                                                    // Zebra striping — 2nd/4th/… rows shaded
                                                    // (#f3f3f3 ≈ wb-bg-sidebar), per Figma.
                                                    index % 2 === 1 && "bg-wb-bg-sidebar",
                                                )}
                                            >
                                                {/* Drag handle — decorative, light + small (see docstring). */}
                                                <TableCell className="px-2">
                                                    <span className="flex items-center text-wb-ntrl-4">
                                                        <GripVertical className="size-3.5" aria-hidden />
                                                    </span>
                                                </TableCell>
                                                {/* Card Company — plain text (Figma shows no logo) */}
                                                <TableCell className="px-2.5">
                                                    <EllipsisTooltip
                                                        text={row.bankNm || row.bankCd}
                                                        className="text-wb-13 font-medium text-wb-ink"
                                                    />
                                                </TableCell>
                                                {/* Card Number */}
                                                <TableCell className="px-2.5">
                                                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                                        {row.cardNo}
                                                    </span>
                                                </TableCell>
                                                {/* Card Holder — inline edit */}
                                                <TableCell className="group px-2.5">
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
                                                        <div className="flex min-w-0 items-center gap-2.5">
                                                            <EllipsisTooltip
                                                                text={row.cardHldrNm}
                                                                className="min-w-0 flex-1 text-wb-13 font-medium text-wb-ink"
                                                            />
                                                            <InlineEditButton
                                                                ariaLabel={t("payment.card.management.edit_holder")}
                                                                onClick={() => startEdit(row, "cardHldrNm")}
                                                                className="invisible group-hover:visible"
                                                            />
                                                        </div>
                                                    )}
                                                </TableCell>
                                                {/* Card Nickname — inline edit */}
                                                <TableCell className="group px-2.5">
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
                                                        <div className="flex min-w-0 items-center gap-2.5">
                                                            <EllipsisTooltip
                                                                text={row.cardNickNm ?? ""}
                                                                className="min-w-0 flex-1 text-wb-13 font-medium text-wb-ink"
                                                            />
                                                            <InlineEditButton
                                                                ariaLabel={t("payment.card.management.edit_nickname")}
                                                                onClick={() => startEdit(row, "cardNickNm")}
                                                                className="invisible group-hover:visible"
                                                            />
                                                        </div>
                                                    )}
                                                </TableCell>
                                                {/* Last update — single line, never truncated */}
                                                <TableCell className="px-2.5">
                                                    <span className="block whitespace-nowrap text-wb-13 font-medium leading-4 text-wb-ink">
                                                        {row.lastUpdate}
                                                    </span>
                                                </TableCell>
                                                {/* Use — toggle */}
                                                <TableCell className="px-2.5">
                                                    <span className="flex items-center">
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
                                                    </span>
                                                </TableCell>
                                                {/* Delete */}
                                                <TableCell className="px-2.5">
                                                    <span className="flex items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(row)}
                                                            aria-label={t("payment.card.management.delete")}
                                                            className={cn(
                                                                "inline-flex size-[18px] cursor-pointer items-center justify-center rounded-full",
                                                                "border border-wb-status-rejected-text text-wb-status-rejected-text hover:bg-wb-status-rejected-bg",
                                                            )}
                                                        >
                                                            <Minus className="size-3" strokeWidth={2.5} />
                                                        </button>
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </table>
                    </div>

                    {/* Add Card — Figma 516:18442 (white pill, shadow, plus icon).
                        Indented slightly off the left edge per the polish pass. */}
                    <div className="flex items-center pl-1">
                        <button
                            type="button"
                            onClick={() => setAddCardOpen(true)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-white p-2 text-wb-14 font-medium tracking-wb-tight text-wb-ink shadow-wb-btn hover:bg-black/5"
                        >
                            <Plus className="size-4" strokeWidth={2} />
                            {t("payment.card.management.add_card")}
                        </button>
                    </div>
                </div>
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

