"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import FirmBankingRowMenu from "./FirmBankingRowMenu";

type FirmBankingDetailsDialogProps = {
    onClose: () => void;
    /** Fired when the user picks "Edit" from the kebab's More menu.
     *  The host typically closes this dialog and opens the
     *  EditFirmBankingDetailsDialog. */
    onEdit?: () => void;
    /** Fired when the user picks "Delete" from the kebab's More menu.
     *  The host typically closes this dialog and opens the destructive
     *  confirmation dialog (useDialog confirmation + destructive). */
    onDelete?: () => void;
};

/**
 * Firm Banking Details dialog — Figma 5936:24464.
 *
 * Opens when the user clicks a row on the Firm Banking Settings
 * panel's Linked Accounts list. Stacks on top of the Settings
 * modal (stackLevel 2). Static UI: every value matches Figma's
 * spec'd content; the top-right kebab + Close button are wired
 * but the kebab is intentionally a no-op until a per-flow design
 * lands. The shared <Dialog> primitive provides portal / focus /
 * ESC chrome.
 *
 * Layout per Figma 5936:24464:
 *   - Container: `rounded-2xl pt-4 pb-6 px-4 gap-6`. Slightly
 *     different padding from the Add / Edit dialogs because Figma
 *     pulls the title closer to the top.
 *   - Header: title + small kebab pill on the right (default-button
 *     shadow, no bg).
 *   - Details: 6 rows in a 191 px label / flex-1 value column with
 *     `border-b border-wb-ntrl-3` between rows + a heavier
 *     `border-b border-wb-ntrl-4` capping the section so the
 *     audit-logs band reads as a sibling, not a continuation.
 *   - Audit Logs: section header (Audit Logs / "View all events…")
 *     followed by a 3-column sibling-table layout (Date/Time, User,
 *     Activity Details) — fixed header `<table>` above a scrolling
 *     body `<table>` capped at 3 × 64 px = 192 px so the 4th+ row
 *     scrolls inside the body region only (Account Inquiry / Approval
 *     Box pattern from CLAUDE.md §7a). Both tables import the same
 *     <AuditLogColGroup /> so columns stay aligned across the split,
 *     and the body container reserves a stable scrollbar gutter so
 *     overflow doesn't shift the columns. Headers use the WB365
 *     table-header bg (`#fbfbfb`) + `border-y` per Figma. Body rows
 *     are 64 px tall with the date/time stack on column 1.
 *   - Footer: right-aligned outlined Close button.
 */
export default function FirmBankingDetailsDialog({
    onClose,
    onEdit,
    onDelete,
}: FirmBankingDetailsDialogProps) {
    const { t } = useTranslation();

    /** Open kebab-menu state. Stores the trigger's bounding rect so
     *  the portal-rendered <FirmBankingRowMenu> can pin itself with
     *  `position: fixed`. */
    const [menuRect, setMenuRect] = useState<DOMRect | null>(null);

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                hideClose
                className="max-w-[640px] rounded-2xl p-0"
            >
                {/* No outer overflow — only the audit-log scroll
                   container below scrolls. The Close button sits in
                   a sibling row outside that container so it stays
                   pinned at the bottom of the modal regardless of
                   how many audit rows the table has. */}
                <div className="flex w-full flex-col gap-6 px-4 pb-6 pt-4">
                    {/* Header — title + kebab. The kebab is purely
                       static for now per the spec; wiring lands when a
                       per-row flow needs it. */}
                    <div className="flex w-full items-center justify-between">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                                {t(
                                    "settings.firm_banking_settings.firm_banking_details.title",
                                )}
                            </h2>
                        </DialogTitle>
                        <button
                            type="button"
                            aria-label={t(
                                "settings.firm_banking_settings.firm_banking_details.more_actions",
                            )}
                            aria-expanded={Boolean(menuRect)}
                            aria-haspopup="menu"
                            onClick={(e) => {
                                // Toggle: if the menu is already open
                                // and the user clicks the kebab again,
                                // close it. The row-menu's own
                                // outside-click handler already fires
                                // first on mousedown and closes the
                                // menu, so by the time React's onClick
                                // runs `menuRect` is already null. The
                                // toggle below covers the case where
                                // the outside-click closer is bypassed
                                // (e.g. by Radix DismissableLayer
                                // intercepting the mousedown event)
                                // and provides a deterministic close
                                // path even under those conditions.
                                const rect =
                                    e.currentTarget.getBoundingClientRect();
                                setMenuRect((prev) => (prev ? null : rect));
                            }}
                            className="flex size-6 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ink shadow-wb-btn hover:bg-black/5"
                        >
                            <MoreVertical className="size-3.5" strokeWidth={2} />
                        </button>
                    </div>

                    {/* Details — 6 rows, label / value layout. The
                       outer `border-b border-wb-ntrl-4` is the heavier
                       divider that caps the block before Audit Logs. */}
                    <div className="flex w-full flex-col border-b border-wb-ntrl-4">
                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.bank_name",
                            )}
                        >
                            <ShinhanIcon className="size-4 shrink-0" />
                            <span className="text-wb-14 font-medium text-wb-ink">
                                SHINHAN VN
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.partner_id",
                            )}
                        >
                            <span className="text-wb-14 font-medium text-wb-ink">
                                DNFEQWERDFA112013
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.van_code",
                            )}
                        >
                            <span className="text-wb-14 font-medium text-wb-ink">
                                GV00000000002
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.withdrawal_account",
                            )}
                        >
                            <span className="text-wb-14 font-medium text-wb-ink">
                                0001-00000569-14
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.edit_firm_banking_details.firm_banking_status",
                            )}
                        >
                            <span className="text-wb-14 font-medium text-wb-status-approved-text">
                                {t(
                                    "settings.firm_banking_settings.status.active",
                                )}
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.firm_banking_details.last_updated",
                            )}
                            isLast
                        >
                            <span className="text-wb-14 font-medium text-wb-ink">
                                20-08-2024 , Hong Gil Dong
                            </span>
                        </Row>
                    </div>

                    {/* Audit Logs section — header + 3-column table. */}
                    <div className="flex w-full flex-col">
                        <div className="flex w-full flex-col gap-0.5 pb-4">
                            <h3 className="text-wb-13 font-semibold leading-none text-wb-dark">
                                {t(
                                    "settings.firm_banking_settings.firm_banking_details.audit_logs.title",
                                )}
                            </h3>
                            <p className="text-wb-13 font-medium leading-none text-wb-ntrl-6">
                                {t(
                                    "settings.firm_banking_settings.firm_banking_details.audit_logs.description",
                                )}
                            </p>
                        </div>

                        {/* Sibling-table pattern (Account Inquiry / Approval
                           Box / Audit Logs Dialog): a fixed header
                           <table> stays above the scroll, and the body
                           <table> sits inside a `max-h` overflow
                           container so ONLY rows scroll past 3
                           entries. Both tables import the same
                           <AuditLogColGroup /> + `table-fixed` so
                           columns stay aligned across the split. The
                           body container reserves a stable scrollbar
                           gutter so a 4-row body doesn't shift the
                           columns 6 px to the left when the scrollbar
                           appears. */}
                        <table className="w-full table-fixed border-collapse">
                            <AuditLogColGroup />
                            <thead>
                                <tr>
                                    <HeaderCell>
                                        {t(
                                            "settings.firm_banking_settings.firm_banking_details.audit_logs.col.datetime",
                                        )}
                                    </HeaderCell>
                                    <HeaderCell>
                                        {t(
                                            "settings.firm_banking_settings.firm_banking_details.audit_logs.col.user",
                                        )}
                                    </HeaderCell>
                                    <HeaderCell>
                                        {t(
                                            "settings.firm_banking_settings.firm_banking_details.audit_logs.col.details",
                                        )}
                                    </HeaderCell>
                                </tr>
                            </thead>
                        </table>

                        <div
                            className="custom-scrollbar-y max-h-[192px] overflow-y-auto"
                            style={{ scrollbarGutter: "stable" }}
                        >
                            <table className="w-full table-fixed border-collapse">
                                <AuditLogColGroup />
                                <tbody>
                                    {AUDIT_LOG_ROWS.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="border-b border-wb-table-border"
                                        >
                                            <td className="h-16 py-3 pr-4 align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-wb-14 font-medium leading-[18px] text-wb-ink">
                                                        {row.date}
                                                    </span>
                                                    <span className="text-wb-14 font-medium leading-[18px] text-wb-ntrl-6">
                                                        {row.time}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="h-16 py-3 pr-4 align-top">
                                                <span className="text-wb-14 font-medium leading-[18px] text-wb-ink">
                                                    {row.user}
                                                </span>
                                            </td>
                                            <td className="h-16 py-3 pr-4 align-top">
                                                <span className="text-wb-14 font-medium leading-[18px] text-wb-ink">
                                                    {t(row.activityKey)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer — right-aligned outlined Close button. */}
                    <div className="flex w-full items-center justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.close")}
                        </button>
                    </div>
                </div>

                {/* Kebab "More" menu — reuses the same component the
                   Linked Accounts list row uses, so the chrome stays
                   identical (Figma 5936:24741: Edit + Delete). The
                   menu portals to document.body and dismisses on
                   ESC + outside-click; clicking either action also
                   fires the corresponding callback through to the
                   host. */}
                {menuRect && (
                    <FirmBankingRowMenu
                        anchorRect={menuRect}
                        bankLabel={t(
                            "settings.firm_banking_settings.firm_banking_details.title",
                        )}
                        onEdit={() => onEdit?.()}
                        onDelete={() => onDelete?.()}
                        onClose={() => setMenuRect(null)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Static audit-log rows — match Figma 5936:24586 exactly. The first
 * three rows are "Update firmbanking details", the last row is
 * "Register new firmbanking" (the original event). Activity strings
 * resolve through `t(...)` in the table body.
 */
const AUDIT_LOG_ROWS: ReadonlyArray<{
    id: string;
    date: string;
    time: string;
    user: string;
    activityKey: string;
}> = [
    {
        id: "fbd-log-1",
        date: "09-29-2024",
        time: "15:13:24",
        user: "김세명",
        activityKey:
            "settings.firm_banking_settings.firm_banking_details.audit_logs.activity.update",
    },
    {
        id: "fbd-log-2",
        date: "09-27-2024",
        time: "15:13:24",
        user: "김세명",
        activityKey:
            "settings.firm_banking_settings.firm_banking_details.audit_logs.activity.update",
    },
    {
        id: "fbd-log-3",
        date: "09-03-2024",
        time: "15:13:24",
        user: "김세명",
        activityKey:
            "settings.firm_banking_settings.firm_banking_details.audit_logs.activity.update",
    },
    {
        id: "fbd-log-4",
        date: "09-01-2024",
        time: "15:13:24",
        user: "김세명",
        activityKey:
            "settings.firm_banking_settings.firm_banking_details.audit_logs.activity.register",
    },
];

function Row({
    label,
    children,
    isLast,
}: {
    label: string;
    children: React.ReactNode;
    /** Suppress the row's own bottom border on the final entry — the
     *  parent draws a heavier `border-b` to cap the section so a
     *  duplicate hairline is avoided. */
    isLast?: boolean;
}) {
    return (
        <div
            className={cn(
                "flex min-h-[36px] items-center",
                !isLast && "border-b border-wb-ntrl-3",
            )}
        >
            <div className="flex w-[191px] shrink-0 items-center py-2">
                <span className="text-wb-14 font-medium text-wb-ntrl-8 opacity-70">
                    {label}
                </span>
            </div>
            <div className="flex flex-1 items-center gap-2.5 py-2">
                {children}
            </div>
        </div>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="border-y border-wb-border-sidebar bg-wb-bg-card py-3 pr-4 text-left align-middle text-wb-13 font-medium leading-none text-wb-ink">
            {children}
        </th>
    );
}

/**
 * Shared <colgroup> imported by both the fixed header table and the
 * scrolling body table so columns line up across the split. Mirrors
 * the ApprovalTableColumns / TransferOwnAccountsTableColumns pattern
 * used by the main-page tables (CLAUDE.md §7a).
 */
function AuditLogColGroup() {
    return (
        <colgroup>
            <col className="w-[121px]" />
            <col className="w-[128px]" />
            <col />
        </colgroup>
    );
}

/**
 * Compact Shinhan brand mark — 16 px circle scaled from the 36 px
 * mark used in <BankLogo>. Inlined here so the value cell keeps its
 * own size without extending <BankLogo>'s public surface; the artwork
 * (navy disc + teal swoosh + lighter mid-blue accent) stays in sync
 * with the linked-account list.
 */
function ShinhanIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 36 36"
            className={cn("block overflow-hidden rounded-full", className)}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <defs>
                <clipPath id="firm-banking-details-shinhan-clip">
                    <circle cx="18" cy="18" r="18" />
                </clipPath>
            </defs>
            <g clipPath="url(#firm-banking-details-shinhan-clip)">
                <rect width="36" height="36" fill="#0E3A6B" />
                <path
                    d="M-2 24 Q18 4 38 24 L38 32 Q18 14 -2 32 Z"
                    fill="#00A5C5"
                />
                <path
                    d="M-2 20 Q18 6 38 20 L38 14 Q18 0 -2 14 Z"
                    fill="#5DADE2"
                    opacity="0.55"
                />
            </g>
        </svg>
    );
}
