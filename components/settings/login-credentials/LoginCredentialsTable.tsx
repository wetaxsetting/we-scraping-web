"use client";

import { MoreVertical } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import LoginIdPwPopover from "./LoginIdPwPopover";
import type { LoginCredentialRow } from "./types";

type LoginCredentialsTableProps = {
    rows: LoginCredentialRow[];
    /** Row id whose popover is open, or `null`. Single-popover-at-a-time. */
    openRowId: string | null;
    onOpenPopover: (rowId: string) => void;
    onClosePopover: () => void;
    /**
     * Fired when the user activates the institution link (left column).
     * Optional so the table renders standalone without an edit handler
     * wired up.
     */
    onInstitutionClick?: (row: LoginCredentialRow) => void;
    /** Fired when the user clicks an audit-log link. */
    onAuditLogsClick?: (row: LoginCredentialRow) => void;
    /** Row id whose action-menu (Figma 2236:30291) is open, or `null`.
     *  Drives `aria-expanded` on the kebab — the menu itself is
     *  rendered by the panel via portal, so it's never clipped by
     *  the table's `overflow-auto` scroll wrapper. */
    openMenuRowId?: string | null;
    /** Fired when the user clicks the kebab. The host receives both
     *  the row id and the kebab's bounding rect so the menu can
     *  anchor its `position: fixed` styling to the trigger; passing
     *  the rect at click time avoids re-measuring on every render. */
    onRowMenuToggle?: (rowId: string, rect: DOMRect) => void;
};

/**
 * Login Credentials table — Figma 999:21715.
 *
 * Bare `<table>` + `table-fixed` + `<colgroup>` so widths are defined once
 * and shared between thead / tbody. Header + body styling tracks the
 * canonical Settings-popup pattern shared by Bank Account + Firm Banking
 * History — sticky `bg-wb-bg-sidebar` thead, `text-wb-13` throughout (per
 * CLAUDE.md §5 table typography), shared `border-wb-table-border` row
 * separators.
 */
export default function LoginCredentialsTable({
    rows,
    openRowId,
    onOpenPopover,
    onClosePopover,
    onInstitutionClick,
    onAuditLogsClick,
    openMenuRowId,
    onRowMenuToggle,
}: LoginCredentialsTableProps) {
    const { t } = useTranslation();

    return (
        <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: "var(--w-wb-login-creds-table-min)" }}
        >
            <colgroup>
                <col className="w-[var(--w-wb-login-creds-col-institution)]" />
                <col className="w-[var(--w-wb-login-creds-col-type)]" />
                <col className="w-[var(--w-wb-login-creds-col-login)]" />
                <col />
                <col className="w-[var(--w-wb-login-creds-col-action)]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <HeaderCell>
                        {t("settings.login_credentials.col.institution")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.login_credentials.col.type")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.login_credentials.col.login_id_pw")}
                    </HeaderCell>
                    <HeaderCell>
                        {t("settings.login_credentials.col.audit_logs")}
                    </HeaderCell>
                    <HeaderCell aria-hidden />
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const primary = row.accounts[0];
                    const extraCount = row.accounts.length - 1;
                    const popoverOpen = openRowId === row.id;

                    return (
                        <tr
                            key={row.id}
                            className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                        >
                            {/* Institution — blue link, opens future Edit dialog. */}
                            <td className="px-3 py-3 align-middle">
                                <button
                                    type="button"
                                    onClick={() => onInstitutionClick?.(row)}
                                    className="cursor-pointer text-left text-wb-13 font-medium text-brand hover:underline"
                                >
                                    {row.institution}
                                </button>
                            </td>

                            {/* Type — plain text, translated label. */}
                            <td className="whitespace-nowrap px-3 py-3 align-middle text-wb-13 font-medium text-wb-ink">
                                {t(`settings.login_credentials.type.${row.type}`)}
                            </td>

                            {/* Login ID/PW — primary id + optional `+N` badge.
                               The whole inline group is the click target so the
                               popover opens whether the user hits the id or the
                               badge. `relative` anchors the popover. */}
                            <td className="px-3 py-3 align-middle">
                                <div className="relative inline-block">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            popoverOpen
                                                ? onClosePopover()
                                                : onOpenPopover(row.id)
                                        }
                                        aria-expanded={popoverOpen}
                                        aria-haspopup="dialog"
                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-left"
                                    >
                                        <span className="text-wb-13 font-medium text-wb-ink">
                                            {primary.loginId}
                                        </span>
                                        {extraCount > 0 && (
                                            <span className="inline-flex items-center rounded bg-wb-bg-sidebar px-1.5 py-0.5 text-wb-11 font-medium text-wb-ntrl-6">
                                                +{extraCount}
                                            </span>
                                        )}
                                    </button>
                                    {popoverOpen && (
                                        <LoginIdPwPopover
                                            accounts={row.accounts}
                                            onClose={onClosePopover}
                                        />
                                    )}
                                </div>
                            </td>

                            {/* Audit Logs — blue link showing only the
                               most-recent change date. Actor is omitted
                               from the cell (per user feedback
                               2026-05-15) since the dialog itself
                               surfaces the full actor + action history
                               on click. */}
                            <td className="px-3 py-3 align-middle">
                                <button
                                    type="button"
                                    onClick={() => onAuditLogsClick?.(row)}
                                    className="cursor-pointer truncate text-left text-wb-13 font-medium text-brand hover:underline"
                                >
                                    {row.auditLogDate}
                                </button>
                            </td>

                            {/* Action — kebab menu trigger. Clicking
                               emits the row id + the kebab's bounding
                               rect; the panel anchors the Figma
                               2236:30291 row-action menu (Edit /
                               Delete) via portal + position: fixed so
                               it can't be clipped by the table's
                               `overflow-auto` scroll wrapper. The
                               trigger renders as a bordered white
                               square (Figma 183:25994 — `shadow-wb-btn`
                               1px outline + soft drop shadow) so the
                               action affordance is visible at rest,
                               not only on hover. */}
                            <td className="px-3 py-3 align-middle">
                                <div className="flex justify-center">
                                    <button
                                        type="button"
                                        aria-label={t(
                                            "settings.login_credentials.row_actions",
                                            { institution: row.institution },
                                        )}
                                        aria-haspopup="menu"
                                        aria-expanded={openMenuRowId === row.id}
                                        onClick={(e) =>
                                            onRowMenuToggle?.(
                                                row.id,
                                                e.currentTarget.getBoundingClientRect(),
                                            )
                                        }
                                        className="flex size-6 cursor-pointer items-center justify-center rounded-md bg-white text-wb-ntrl-6 shadow-wb-btn hover:bg-wb-bg-sidebar"
                                    >
                                        <MoreVertical className="size-3.5" strokeWidth={2} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function HeaderCell({
    children,
    "aria-hidden": ariaHidden,
}: {
    children?: React.ReactNode;
    "aria-hidden"?: boolean;
}) {
    return (
        <th
            aria-hidden={ariaHidden}
            className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark"
        >
            {children}
        </th>
    );
}
