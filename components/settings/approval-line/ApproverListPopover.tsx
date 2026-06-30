"use client";

import { useEffect, useRef } from "react";

import UserAvatar from "@/components/shared/UserAvatar";
import { avatarColorFor } from "@/lib/avatar";
import { useTranslation } from "@/lib/i18n";

import type { ApproverRow } from "./approver";

type ApproverListPopoverProps = {
    /** Approvers to render, in approval order — same shape the table
     *  cell receives from {@code row.approvers}. The popover does NOT
     *  re-sort; the chain is already server-ordered by
     *  {@code apprvr_disp_ord ASC}. */
    approvers: ApproverRow[];
    /** Fires when ESC or an outside-click dismisses the popover.
     *  The host panel owns "which row is open" so this just sets the
     *  open id back to null. */
    onClose:   () => void;
};

/**
 * Approver-list hover card — Figma 12346:33966.
 *
 * <p>Shown when the user clicks the count chip + chevron in the
 * Approval Line list's "Approver name" column. Visual design ports
 * the Figma "Hover Card" component verbatim — same card chrome,
 * row layout, order-number / avatar / name typography — and strips
 * the status + date columns from the Figma reference (those belong
 * to the Approval Box runtime flow, not the line-configuration
 * screen).
 *
 * <h2>Card chrome</h2>
 * <ul>
 *   <li>{@code rounded-[8px]} corners (Figma frame radius).</li>
 *   <li>Three-layer shadow ({@code 0/0/0/1} hairline +
 *       {@code 0/2/4} soft + {@code 0/4/8} ambient) all at
 *       {@code rgba(0,0,0,0.08)} per Figma's
 *       {@code shadow-[...]} stack.</li>
 *   <li>{@code w-[260px]} — wider than the chip + chevron trigger,
 *       narrow enough that two stacked rows in the same column
 *       don't visually overlap.</li>
 * </ul>
 *
 * <h2>Row layout</h2>
 *
 * Each approver renders {@code <order> <avatar> <name>} with
 * {@code px-3 py-2 gap-1} per Figma 12346:33967:
 * <ul>
 *   <li><b>Order</b> — 14px / 500 / {@code text-wb-ntrl-9}
 *       (#262626), {@code px-1.5 rounded-md leading-6}. Matches the
 *       Figma "Payment Badge" layout (no visible background, just
 *       horizontal padding for hit-target consistency).</li>
 *   <li><b>Avatar</b> — 28px rounded-full with a soft inner ring
 *       (Figma {@code shadow-[0_1.4_2.8/0_0_0_1.4]}). Falls back to
 *       a neutral lucide {@code User} glyph on a soft circle when
 *       the approver has no stored image.</li>
 *   <li><b>Name</b> — 13px / 500 / {@code text-wb-ntrl-10}
 *       (#171717), {@code leading-5} single-line.</li>
 * </ul>
 *
 * <h2>Rendering / dismiss</h2>
 *
 * Rendered <b>inline</b> as an absolute-positioned sibling of the
 * trigger button, inside the cell's {@code relative} wrapper. No
 * portal, no viewport-coord math — same reasoning as
 * {@code AddApproverPopover}: the Settings modal is a Radix Dialog
 * whose {@code DialogContent} has a CSS transform (containing
 * block) plus {@code overflow-hidden}, and a portal escape to
 * {@code document.body} would land outside Radix's focus scope /
 * inert boundary.
 *
 * <p>Outside-click detection skips clicks on the popover itself
 * AND on the cell wrapper (the trigger button lives there). Clicks
 * on a DIFFERENT row's trigger DO close this popover — the parent
 * panel's single {@code openApproversRowId} state then opens the
 * new row's popover in the same render batch.
 */
export default function ApproverListPopover({
    approvers,
    onClose,
}: ApproverListPopoverProps) {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        }
        function handleMouseDown(e: MouseEvent) {
            const target = e.target as Node | null;
            if (!target) return;
            if (ref.current?.contains(target)) return;
            const anchor = ref.current?.parentElement;
            if (anchor?.contains(target)) return;
            onClose();
        }
        document.addEventListener("keydown", handleKey, true);
        const id = window.setTimeout(() => {
            document.addEventListener("mousedown", handleMouseDown);
        }, 0);
        return () => {
            window.clearTimeout(id);
            document.removeEventListener("keydown", handleKey, true);
            document.removeEventListener("mousedown", handleMouseDown);
        };
    }, [onClose]);

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={t("settings.approval_line.col.approver")}
            // Anchored under the cell's flex wrapper. `z-30` keeps
            // the popover above adjacent table rows + the row-action
            // buttons; it stays below the system-feedback surface
            // (z-100) and the dialog overlay chain.
            //
            // Card chrome: Figma frame 12346:33966 — 8px corners,
            // three-layer 8% shadow stack, 260px width.
            className="absolute left-0 top-full z-30 mt-1 flex w-[260px] flex-col overflow-hidden rounded-lg bg-white shadow-[0px_0px_0px_1px_rgba(0,0,0,0.08),_0px_2px_4px_0px_rgba(0,0,0,0.08),_0px_4px_8px_0px_rgba(0,0,0,0.08)]"
        >
            {approvers.map((approver, index) => (
                <div
                    key={approver.id}
                    // Row chrome — Figma 12346:33967: 12px/8px
                    // padding, 4px gap between order / avatar+name.
                    className="flex items-center gap-1 px-3 py-2"
                >
                    {/* Order number — Figma "Payment Badge". 14/500
                       text, px-1.5 hit-target, no visible background. */}
                    <span className="inline-flex h-full shrink-0 items-center rounded-md px-1.5 text-wb-14 font-medium leading-6 text-wb-ntrl-9">
                        {index + 1}
                    </span>
                    {/* Avatar + name group — Figma 12346:33969.
                       gap-2 (8px) between avatar and the name
                       column. flex-1 so the name truncates instead
                       of overflowing the card. */}
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                        {/* Shared User Management avatar — the approver's
                           uploaded photo when present, otherwise the
                           identity-stable pastel initials disc, exactly
                           like Settings > Users. 28px to keep the popover
                           row rhythm; the soft inner ring matches Figma
                           12346:33970. */}
                        <UserAvatar
                            name={approver.name}
                            userId={approver.id}
                            imageUrl={approver.userImgUrl}
                            color={avatarColorFor(approver.id)}
                            className="size-7 text-wb-11 shadow-[0px_1.4px_2.8px_0px_rgba(0,0,0,0.12),_0px_0px_0px_1.4px_rgba(0,0,0,0.08)]"
                        />
                        <span className="block flex-1 truncate text-wb-13 font-medium leading-5 text-wb-ntrl-10">
                            {approver.name}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

