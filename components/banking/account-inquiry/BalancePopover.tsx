"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import DateField from "@/components/shared/DateField";
import { accountHref } from "@/components/banking/transaction-history/accounts";
import type { AccountInquiryRow } from "@/components/shared/AccountInquiryPage";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { fetchTransactions } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import { formatAmount } from "@/lib/currency";
import { useTranslation } from "@/lib/i18n";
import type { ApiTransactionListResponse } from "@/lib/types/api";

type Props = {
    row: AccountInquiryRow;
    anchorRect: DOMRect;
    date: string;
    onClose: () => void;
    onDateChange: (iso: string) => void;
    summaryCurrency?: string;
    /** Banking scope used to resolve "View Details" → the per-account
     *  Transaction History route. Undefined falls back to the parent
     *  redirect (legacy behaviour). */
    scope?: "VND" | "FCY";
};

/** Convert an ISO `YYYY-MM-DD` date to the `YYYYMMDD` wire format the
 *  transaction endpoint expects as `from` / `to` query params. */
function isoToWire(iso: string): string {
    return iso.replace(/-/g, "");
}

/** Determine transaction type label from the raw API row. The backend
 *  sets `DEPOSIT_AMT` xor `WITHDRAW_AMT` for each row (the other field
 *  is "0" or empty). Deposit takes precedence when both are non-zero. */
function txType(
    depositAmt: string | undefined,
    withdrawAmt: string | undefined,
): "deposit" | "withdrawal" {
    if (depositAmt && depositAmt !== "0") return "deposit";
    if (withdrawAmt && withdrawAmt !== "0") return "withdrawal";
    return "deposit";
}

/**
 * "Click Informations" popup shown when the user clicks a Balance cell
 * (Figma 87:13094). Fetches the last transactions for the clicked account
 * on the selected date, then renders a three-column list (Type / Amount /
 * Reference ID) with a footer total.
 *
 * Rendered via createPortal at document.body so it floats above the sticky
 * table header and avoids overflow-hidden clipping inside DataTableShell.
 * Positioned fixed, anchored below (or above when near the viewport bottom)
 * the clicked cell's DOMRect.
 *
 * Figma 87:13094 chrome: rounded-2xl card with `py-4`, header row (no
 * separator), body rows (gap-2, no separator), footer with single top
 * border. There is no Close (X) button — ESC and outside-click handle it.
 */
export default function BalancePopover({
    row,
    anchorRect,
    date,
    onClose,
    onDateChange,
    summaryCurrency = "VND",
    scope,
}: Props) {
    const { t } = useTranslation();
    const router = useRouter();
    const popoverRef = useRef<HTMLDivElement>(null);

    // Re-fetch when the date changes inside the popup.
    const wireDateFrom = isoToWire(date);
    const { data, loading } = useApiData<ApiTransactionListResponse>(
        () => fetchTransactions(row.id, { from: wireDateFrom, to: wireDateFrom }),
        [row.id, wireDateFrom],
    );
    /* Sticky mirror of `loading` — holds the centered "Loading…" copy
     * for the minimum-visibility window so a fast cached response
     * doesn't flicker the message off the screen before the rows
     * arrive. Date-change refetches read as a single continuous
     * loading window. */
    const stickyLoading = useStickyLoading(loading);

    // Compute fixed position anchored below the clicked cell. If the popup
    // would overflow the viewport bottom, flip it to open upward.
    const POPUP_WIDTH = 450;
    const POPUP_MAX_HEIGHT = 320;
    const OFFSET = 6;

    const [style, setStyle] = useState<React.CSSProperties>({});

    useEffect(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Balance is a right-aligned cell — anchor the popup's RIGHT edge
        // to the cell's right edge so the card extends LEFT toward the
        // viewport centre instead of right toward the scrollbar. Mirrors
        // the live JEX behaviour where the popup hovers below-and-left of
        // the clicked balance value.
        let left = anchorRect.right - POPUP_WIDTH;
        // Keep within the viewport (8px gutters on both sides).
        if (left < 8) left = 8;
        if (left + POPUP_WIDTH > vw - 8) left = vw - POPUP_WIDTH - 8;

        const belowTop = anchorRect.bottom + OFFSET;
        const aboveBottom = anchorRect.top - OFFSET;

        // Open below unless not enough room — then open above. Width is
        // owned by the `w-[450px]` Tailwind class on the outer element so
        // the inline style only carries position values.
        if (belowTop + POPUP_MAX_HEIGHT < vh) {
            setStyle({ top: belowTop, left });
        } else {
            setStyle({
                bottom: vh - aboveBottom,
                left,
            });
        }
    }, [anchorRect]);

    // Close on ESC.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // Close on outside click.
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        // Use setTimeout so the same click that opens the popup doesn't
        // immediately close it via this handler.
        const id = setTimeout(() => {
            document.addEventListener("mousedown", onDocClick);
        }, 0);
        return () => {
            clearTimeout(id);
            document.removeEventListener("mousedown", onDocClick);
        };
    }, [onClose]);

    const ccy = row.currencyCd ?? summaryCurrency;

    const rows = data?.ROWS ?? [];
    const depositTotal = data?.DEPOSIT_TOTAL ?? "0";
    const withdrawTotal = data?.WITHDRAW_TOTAL ?? "0";
    const totalCount = data?.TOTAL_COUNT ?? rows.length;

    // Build the "Total {count} transaction(s)" string with the count
    // highlighted in brand blue. We use a private-use sentinel so the i18n
    // template's {count} placeholder gets split into two text fragments
    // around the colored span — keeps locale strings (en/ko/vi) intact.
    const COUNT_MARKER = "C";
    const totalTpl = t("account_inquiry.popup.total_count", { count: COUNT_MARKER });
    const [totalPre, totalPost] = totalTpl.split(COUNT_MARKER);

    const handleViewDetails = () => {
        // Deep-link to the row's per-account Transaction History. The
        // row's `id` is the backend `acct_seq_no` and the URL slug is
        // the same string — no lookup required. Fall back to the base
        // route when scope is missing (it shouldn't be, in practice).
        const target = scope
            ? accountHref(scope, row.id)
            : "/banking/transaction-history";
        router.push(target);
        onClose();
    };

    const content = (
        <div
            ref={popoverRef}
            style={style}
            // No outer `overflow-hidden`: the body's own `overflow-y-auto`
            // already clips its scrollable content, and dropping the outer
            // clip lets the DateField calendar (`absolute top-full`) escape
            // the popup's bottom edge so it isn't cropped when opened from
            // the header date chip.
            className="fixed z-50 flex w-[450px] flex-col rounded-2xl border border-wb-ntrl-3 bg-white py-4 shadow-wb-popup animate-in fade-in-0 slide-in-from-top-1 duration-150 ease-out"
        >
            {/* Header — Figma 87:13095. No separator, no Close (X). */}
            <div className="flex shrink-0 items-center gap-2 px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="whitespace-nowrap text-wb-14 font-medium leading-7 text-black">
                        {t("account_inquiry.popup.last_transactions")}
                    </span>
                    {/* Single-date picker reuses the shared DateField chip */}
                    <DateField
                        value={date}
                        onChange={(iso) => {
                            if (iso) onDateChange(iso);
                        }}
                    />
                </div>
                {/* View Details — Figma renders this as a white chip with the
                   same shadow as the date input, NOT a brand-blue button. */}
                <button
                    type="button"
                    onClick={handleViewDetails}
                    className="flex h-8 shrink-0 cursor-pointer items-center rounded-md bg-white px-2 text-wb-14 font-medium text-wb-ntrl-10 shadow-wb-btn"
                >
                    {t("account_inquiry.popup.view_details")}
                </button>
            </div>

            {/* Body — Figma 87:13100. Flex column of rows with `gap-2`,
               no per-row borders, no table chrome. `min-h-[40px]` keeps
               the empty / loading states the height of one populated row
               so the card doesn't visually collapse on first paint. */}
            <div className="custom-scrollbar-y flex min-h-0 max-h-[200px] flex-col gap-2 overflow-y-auto px-4 py-4">
                {stickyLoading && (
                    <span className="text-center text-wb-13 font-normal leading-5 text-wb-muted">
                        {t("common.loading")}
                    </span>
                )}
                {!stickyLoading && rows.length === 0 && (
                    <span className="text-center text-wb-13 font-normal leading-5 text-wb-muted">
                        {t("account_inquiry.popup.no_data")}
                    </span>
                )}
                {!stickyLoading &&
                    rows.map((txn, idx) => {
                        const type = txType(txn.DEPOSIT_AMT, txn.WITHDRAW_AMT);
                        const amount =
                            type === "deposit" ? txn.DEPOSIT_AMT : txn.WITHDRAW_AMT;
                        const refId = txn.RMRK ?? "";
                        return (
                            <div
                                key={idx}
                                className="flex w-full items-start gap-5 text-wb-13"
                            >
                                <span className="w-[100px] shrink-0 truncate font-medium text-black">
                                    {type === "deposit"
                                        ? t("account_inquiry.popup.deposit")
                                        : t("account_inquiry.popup.withdrawal")}
                                </span>
                                <span className="w-[130px] shrink-0 text-right font-medium text-black">
                                    {formatAmount(amount, ccy, false)}
                                </span>
                                <span
                                    className="block min-w-0 flex-1 truncate font-normal text-[#1b1b1b]"
                                    title={refId}
                                >
                                    {refId || "—"}
                                </span>
                            </div>
                        );
                    })}
            </div>

            {/* Footer — Figma 87:13117. Soft top divider (#e5e5e5 / wb-ntrl-3),
               not the heavier #d3d3d3 table-row colour. Right-aligned text,
               count highlighted in brand. */}
            <div className="flex shrink-0 items-center border-t border-wb-ntrl-3 px-4 pt-4">
                <p className="flex-1 text-right text-wb-13 font-medium text-black">
                    {totalPre}
                    <span className="text-brand">{String(totalCount)}</span>
                    {totalPost}
                    {" / "}
                    {t("account_inquiry.popup.deposit_label")}{" "}
                    {formatAmount(depositTotal, ccy, false)}
                    {" , "}
                    {t("account_inquiry.popup.withdrawal_label")}{" "}
                    {formatAmount(withdrawTotal, ccy, false)}
                </p>
            </div>
        </div>
    );

    if (typeof document === "undefined") return null;
    return createPortal(content, document.body);
}
