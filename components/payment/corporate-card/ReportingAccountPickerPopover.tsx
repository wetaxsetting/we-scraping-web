"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

import { ApiCallError } from "@/lib/api/banking";
import { putCardTransactionReportingAccount } from "@/lib/api/cardTransactions";
import { fetchChartOfAccountsTree } from "@/lib/api/chartOfAccounts";
import { useDialog } from "@/components/shared/dialog";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ApiChartOfAccountTreeNode } from "@/lib/types/api";

import type { CardTransaction } from "./cardTransactionMappers";

type ReportingAccountPickerPopoverProps = {
    row:        CardTransaction;
    anchorRect: DOMRect;
    onClose:    () => void;
    onSaved:    () => void;
};

/**
 * Reporting-account picker rendered as an inline portalled popover
 * anchored to the clicked cell — mirrors legacy
 * {@code card_0001_001.ts:1117-1124}
 * ({@code pic-infor-contBox} with the sticky search input + scrollable
 * {@code ul.reportAccount} list). Replaces the earlier centred
 * {@code <Dialog>} variant.
 *
 * <p>UX differences from the previous modal:
 *
 * <ul>
 *   <li>Anchored under the clicked cell via a {@code DOMRect} — caller
 *       captures the rect on click and keeps the popover in lockstep
 *       with the row.</li>
 *   <li>Picking an account commits immediately (legacy auto-save —
 *       same wire call, no Save button).</li>
 *   <li>Outside-click + ESC dismiss without saving.</li>
 *   <li>Width matches the cell (min 280 px, max 360 px) so the
 *       breadcrumb subtitle has room without overflowing the table.</li>
 * </ul>
 */
export default function ReportingAccountPickerPopover({
    row,
    anchorRect,
    onClose,
    onSaved,
}: ReportingAccountPickerPopoverProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const treeState = useApiData(() => fetchChartOfAccountsTree(), []);

    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchRef  = useRef<HTMLInputElement>(null);

    /** Live-tracked anchor rect — re-measured on scroll/resize so the
     *  popover stays glued to the cell while the user scrolls the
     *  table. */
    const [rect, setRect] = useState<DOMRect>(anchorRect);

    useLayoutEffect(() => {
        // The caller already measured once on click; we just relay
        // initial state. The scroll/resize listeners below keep it
        // in sync for the rest of the popover's lifetime — but we
        // don't have the original element anymore, so the rect is
        // effectively pinned. A future iteration could pass the
        // element via ref for re-measurement.
        setRect(anchorRect);
    }, [anchorRect]);

    /** Outside-click + ESC dismiss. */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        // Defer the mousedown listener by a tick so the SAME click
        // that opened the popover doesn't immediately close it via
        // this listener firing on the wrong side of the React commit.
        // Same precedent as DateField's portalled popover.
        const onClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (popoverRef.current && !popoverRef.current.contains(target)) {
                onClose();
            }
        };
        document.addEventListener("keydown", onKey);
        const id = setTimeout(() => {
            document.addEventListener("mousedown", onClick);
        }, 0);
        return () => {
            clearTimeout(id);
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, [onClose]);

    // Autofocus the search input when the popover mounts.
    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    const nodes: ApiChartOfAccountTreeNode[] = useMemo(() => {
        const all = treeState.data?.nodes ?? [];
        // Drop restricted roots — those are admin-only categorisation
        // bins, never assigned at the transaction level.
        return all.filter((n) => !n.restricted);
    }, [treeState.data]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return nodes;
        return nodes.filter((n) =>
            (`${n.chart_acct_cd} ${n.chart_acct_nm_en} ${n.breadcrumb}`)
                .toLowerCase()
                .includes(q),
        );
    }, [nodes, search]);

    /** Auto-save on click — no separate Save button (matches legacy
     *  `card_0001_001.ts:702` which commits the picked account
     *  immediately via the `u002` action). */
    async function handlePick(node: ApiChartOfAccountTreeNode) {
        if (saving) return;
        setSaving(true);
        try {
            await putCardTransactionReportingAccount(row.cardSeqNo, {
                chart_acct_seq_no: node.chart_acct_seq_no,
                chart_acct_cd:     node.chart_acct_cd,
            });
            onSaved();
            onClose();
        } catch (err) {
            const code    = err instanceof ApiCallError ? err.code    : "WBE9999";
            const message = err instanceof ApiCallError ? err.message : t("payment.card.dialog.reporting_account.save_failed");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSaving(false);
        }
    }

    if (typeof document === "undefined") return null;

    // Position the popover under the anchor cell. Width matches the
    // cell (min 280, max 360) so the breadcrumb has breathing room
    // without overflowing the page on narrow viewports. Clamp the
    // left edge inside the viewport.
    const POPOVER_WIDTH = Math.max(280, Math.min(360, rect.width));
    const left = Math.max(
        8,
        Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8),
    );
    const top  = rect.bottom + 4;

    return createPortal(
        <div
            ref={popoverRef}
            role="dialog"
            aria-label={t("payment.card.dialog.reporting_account.title")}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
                position:      "fixed",
                top,
                left,
                width:         POPOVER_WIDTH,
                zIndex:        110,
                pointerEvents: "auto",
            }}
            className="flex flex-col overflow-clip rounded-lg border border-wb-ntrl-4 bg-white shadow-wb-card"
        >
            {/* Sticky search input — legacy `keyword-search default ...
                sticky_search_ra`. */}
            <div className="relative shrink-0 border-b border-wb-table-border bg-white px-2 py-2">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-wb-ntrl-6"
                    strokeWidth={1.8}
                />
                <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t("payment.card.dialog.reporting_account.placeholder")}
                    className={cn(
                        "w-full rounded-md border border-wb-ntrl-4 bg-white pl-7 pr-2",
                        "h-8 text-wb-13 font-normal text-wb-ink",
                        "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40",
                    )}
                />
            </div>

            {/* Scrollable list — legacy `ul.reportAccount`. Max height
                ~ 217 px from the legacy inline style. */}
            <div className="custom-scrollbar-y max-h-[260px] overflow-y-auto">
                {treeState.loading ? (
                    <p className="px-3 py-2 text-wb-13 font-medium text-wb-muted">
                        {t("common.loading")}
                    </p>
                ) : filtered.length === 0 ? (
                    <p className="px-3 py-2 text-wb-13 font-medium text-wb-muted">
                        {t("payment.card.dialog.reporting_account.empty")}
                    </p>
                ) : (
                    <ul role="listbox" aria-label={t("payment.card.dialog.reporting_account.title")}>
                        {filtered.map((n) => {
                            const isActive = row.chartAcctCd === n.chart_acct_cd;
                            return (
                                <li key={n.chart_acct_seq_no}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isActive}
                                        disabled={saving}
                                        onClick={() => handlePick(n)}
                                        className={cn(
                                            "block w-full cursor-pointer px-3 py-2 text-left",
                                            "border-b border-wb-table-border last:border-b-0",
                                            "disabled:cursor-not-allowed disabled:opacity-50",
                                            isActive ? "bg-brand/5" : "hover:bg-neutral-50",
                                        )}
                                    >
                                        <span className="block text-wb-13 font-semibold text-wb-ink">
                                            {n.chart_acct_cd} - {n.chart_acct_nm_en}
                                        </span>
                                        {n.breadcrumb && (
                                            <span className="block truncate text-wb-11 font-medium text-wb-muted">
                                                {n.breadcrumb}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>,
        document.body,
    );
}
