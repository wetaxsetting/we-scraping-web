"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { BankAccountRow } from "./types";

type BankAccountTableProps = {
    rows: BankAccountRow[];
    /**
     * Fired when the user activates the bank-name link in a row's Account
     * cell. The host opens the Edit Bank Account dialog seeded with this
     * row. Optional so the table still renders standalone (preview / story
     * usage) without an edit handler wired up.
     */
    onAccountClick?: (row: BankAccountRow) => void;
    /**
     * Fired when the user clicks the View Permission link in a row.
     * Optional — undefined leaves the link inert.
     */
    onViewPermissionClick?: (row: BankAccountRow) => void;
    /**
     * Fired when the user clicks the Withdrawal Permission link in a row.
     * Optional — undefined leaves the link inert.
     */
    onWithdrawalPermissionClick?: (row: BankAccountRow) => void;
    /**
     * Fired when the user clicks the Audit Logs link in a row.
     * Optional — undefined leaves the link inert.
     */
    onAuditLogsClick?: (row: BankAccountRow) => void;
};

/**
 * Bank Account table — Figma 142:18741.
 *
 * Header + body styling tracks the canonical Settings-popup table pattern
 * shared by ERP Transaction History (`<TransactionHistoryTable>`) and the
 * Operation Status Inquiry main page — sticky `bg-wb-bg-sidebar` thead,
 * `text-wb-13` throughout (per CLAUDE.md §5 table typography), shared
 * `border-wb-table-border` row separators, and the canonical
 * `/assets/table/ico-sort.svg` sort glyph. Pages must not introduce
 * per-feature header chrome (custom hex colours, inline `text-[Npx]`,
 * lucide `ChevronDown` for sort glyphs); the shared rule is "every
 * Settings table reads identical".
 *
 * Bare `<table>` + `table-fixed` + `<colgroup>` so widths are defined
 * once and shared between `<thead>` / `<tbody>`. The min-width
 * (`--w-wb-bank-acct-table-min` = 1620 px) lets the table scroll
 * horizontally inside the panel's scroll container.
 */
export default function BankAccountTable({
    rows,
    onAccountClick,
    onViewPermissionClick,
    onWithdrawalPermissionClick,
    onAuditLogsClick,
}: BankAccountTableProps) {
    const { t } = useTranslation();

    return (
        <table
            className="table-fixed border-collapse"
            style={{ minWidth: "var(--w-wb-bank-acct-table-min)" }}
        >
            <colgroup>
                <col className="w-[var(--w-wb-bank-acct-col-account)]" />
                <col className="w-[var(--w-wb-bank-acct-col-nickname)]" />
                <col className="w-[var(--w-wb-bank-acct-col-description)]" />
                <col className="w-[var(--w-wb-bank-acct-col-type)]" />
                <col className="w-[var(--w-wb-bank-acct-col-maturity)]" />
                <col className="w-[var(--w-wb-bank-acct-col-vas-code)]" />
                <col className="w-[var(--w-wb-bank-acct-col-vas-name)]" />
                <col className="w-[var(--w-wb-bank-acct-col-view-perm)]" />
                <col className="w-[var(--w-wb-bank-acct-col-withdraw-perm)]" />
                <col className="w-[var(--w-wb-bank-acct-col-audit)]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <HeaderCell>{t("settings.bank_account.col.account")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.nickname")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.description")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.type")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.maturity")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.vas_code")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.vas_name")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.view_permission")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.withdrawal_permission")}</HeaderCell>
                    <HeaderCell>{t("settings.bank_account.col.audit_logs")}</HeaderCell>
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const descriptionEmpty = row.description === "";
                    const isSaving = row.accountType === "saving";

                    return (
                        <tr
                            key={row.id}
                            className="border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
                        >
                            {/* Account — bank-name link + account number sub-line.
                               The link is a <button> so screen readers announce
                               it as an action (it opens the Edit dialog) and
                               keyboard activation goes through Enter / Space. */}
                            <BodyCell>
                                <button
                                    type="button"
                                    onClick={() => onAccountClick?.(row)}
                                    className="block w-full truncate text-left text-wb-13 font-medium text-brand hover:underline"
                                >
                                    {row.bankName}
                                </button>
                                <span className="block truncate text-wb-13 font-normal text-wb-muted">
                                    {row.accountNumber} ({row.currency})
                                </span>
                            </BodyCell>

                            {/* Account Nickname */}
                            <BodyCell>
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {row.nickname}
                                </span>
                            </BodyCell>

                            {/* Description — "-" placeholder when empty,
                               tooltip on truncate when non-empty. */}
                            <BodyCell>
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 font-medium",
                                        descriptionEmpty ? "text-wb-ink" : "text-wb-ntrl-8",
                                    )}
                                    title={descriptionEmpty ? undefined : row.description}
                                >
                                    {descriptionEmpty ? "-" : row.description}
                                </span>
                            </BodyCell>

                            {/* Account Type */}
                            <BodyCell>
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {t(
                                        isSaving
                                            ? "settings.bank_account.type.saving"
                                            : "settings.bank_account.type.current",
                                    )}
                                </span>
                            </BodyCell>

                            {/* Maturity Date — saving accounts only */}
                            <BodyCell>
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {row.maturityDate || ""}
                                </span>
                            </BodyCell>

                            {/* VAS Code */}
                            <BodyCell>
                                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                    {row.vasCode}
                                </span>
                            </BodyCell>

                            {/* VAS Account Name — two-line stack, both lines
                               brand blue per Figma (code line + bank line). */}
                            <BodyCell>
                                <span className="block truncate text-wb-13 font-medium text-brand">
                                    {row.vasAccountCode}
                                </span>
                                <span className="block truncate text-wb-13 font-medium text-brand">
                                    {row.vasAccountBank}
                                </span>
                            </BodyCell>

                            {/* View Permission — underlined blue link.
                               Rendered as a <button> so it announces as
                               an action (opens a dialog) and works with
                               keyboard activation. */}
                            <BodyCell>
                                <button
                                    type="button"
                                    onClick={() => onViewPermissionClick?.(row)}
                                    className="inline-block max-w-full cursor-pointer truncate border-b border-brand text-wb-13 font-medium text-brand"
                                >
                                    {row.viewPermissionLabel}
                                </button>
                            </BodyCell>

                            {/* Withdrawal Permission — underlined blue link */}
                            <BodyCell>
                                <button
                                    type="button"
                                    onClick={() => onWithdrawalPermissionClick?.(row)}
                                    className="inline-block max-w-full cursor-pointer truncate border-b border-brand text-wb-13 font-medium text-brand"
                                >
                                    {row.withdrawalPermissionLabel}
                                </button>
                            </BodyCell>

                            {/* Audit Logs — actor / action on line 1, date
                               in parens on line 2. Rendered as a <button>
                               so it announces as an action (opens a
                               dialog) and works with keyboard activation. */}
                            <BodyCell>
                                <button
                                    type="button"
                                    onClick={() => onAuditLogsClick?.(row)}
                                    className="inline-block max-w-full cursor-pointer text-left text-wb-13 font-medium text-brand"
                                >
                                    <span className="block truncate">{row.auditLogActor}</span>
                                    <span className="block truncate">({row.auditLogDate})</span>
                                </button>
                            </BodyCell>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/**
 * Canonical Settings-popup table header cell — same styling rules as
 * `<TransactionHistoryTable>` / Operation Status: `bg-wb-bg-sidebar`,
 * `px-3 py-3`, `text-wb-13 font-semibold text-wb-dark`, `whitespace-nowrap`,
 * shared sort glyph at `h-3 w-2 opacity-60`.
 */
function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                {children}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/assets/table/ico-sort.svg"
                    alt=""
                    aria-hidden
                    className="h-3 w-2 shrink-0 opacity-60"
                />
            </span>
        </th>
    );
}

function BodyCell({ children }: { children: React.ReactNode }) {
    return <td className="px-3 py-3 align-middle">{children}</td>;
}
