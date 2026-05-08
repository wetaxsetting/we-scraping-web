"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ToggleSwitch from "../ToggleSwitch";
import type { PurposeRow } from "./types";

type PurposeTableProps = {
    rows: PurposeRow[];
    onToggle: (id: string, next: boolean) => void;
};

/**
 * Purpose table. Renders a bare <table> with table-fixed + <colgroup>
 * so column widths are defined once and shared between <thead> and
 * <tbody>. The header is `sticky top-0` so it stays pinned while the
 * body scrolls — the only scrollable element is the parent
 * <div class="overflow-auto"> wrapping this table.
 *
 * The "+ Add Purpose" button is intentionally NOT rendered here — it
 * lives outside the scroll container in <PurposePanel> so it stays
 * fixed above the card bottom.
 */
export default function PurposeTable({ rows, onToggle }: PurposeTableProps) {
    const { t } = useTranslation();
    return (
        <table className="w-full table-fixed border-collapse">
            <colgroup>
                <col className="w-[var(--w-wb-settings-col-code)]" />
                <col className="w-[var(--w-wb-settings-col-account)]" />
                <col />
                <col className="w-[var(--w-wb-settings-col-toggle)]" />
            </colgroup>

            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <HeaderCell>{t("settings.purpose.col.code")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.account")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.description")}</HeaderCell>
                    <th aria-hidden className="bg-wb-bg-sidebar px-3 py-3" />
                </tr>
            </thead>

            <tbody>
                {rows.map((row) => {
                    const codeEmpty = row.code === "";
                    const descriptionEmpty = row.description === "";
                    const dimmed = !row.enabled;
                    return (
                        <tr
                            key={row.id}
                            className={cn(
                                "border-b border-wb-table-border last:border-b-0",
                                dimmed && "text-wb-muted",
                            )}
                        >
                            <td className="px-3 py-3 align-middle">
                                <span
                                    className={cn(
                                        "block truncate text-wb-13",
                                        codeEmpty
                                            ? "font-normal text-wb-ntrl-5"
                                            : dimmed
                                                ? "font-medium text-wb-muted"
                                                : "font-medium text-wb-ink",
                                    )}
                                >
                                    {codeEmpty
                                        ? t("settings.purpose.placeholder.code")
                                        : row.code}
                                </span>
                            </td>

                            <td className="px-3 py-3 align-middle">
                                <span
                                    className={cn(
                                        "block truncate text-wb-13 font-medium",
                                        dimmed ? "text-wb-muted" : "text-wb-ink",
                                    )}
                                >
                                    {row.account}
                                </span>
                            </td>

                            <td className="px-3 py-3 align-middle">
                                <span
                                    className={cn(
                                        "block truncate text-wb-13",
                                        descriptionEmpty
                                            ? "font-normal text-wb-ntrl-5"
                                            : dimmed
                                                ? "font-normal text-wb-muted"
                                                : "font-normal text-wb-ntrl-8",
                                    )}
                                    title={descriptionEmpty ? undefined : row.description}
                                >
                                    {descriptionEmpty
                                        ? t("settings.purpose.placeholder.description")
                                        : row.description}
                                </span>
                            </td>

                            <td className="px-3 py-3 text-right align-middle">
                                <ToggleSwitch
                                    checked={row.enabled}
                                    onChange={(next) => onToggle(row.id, next)}
                                    ariaLabel={t(
                                        row.enabled
                                            ? "settings.purpose.toggle_on"
                                            : "settings.purpose.toggle_off",
                                    )}
                                />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    // text-wb-13 to match the body cells per CLAUDE.md §5 — Settings-popup
    // tables (Bank Account, ERP Transaction History, Firm Banking History,
    // Purpose) all share the 13 px header + body typography. No font-size
    // mixing inside a single table.
    return (
        <th className="bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            {children}
        </th>
    );
}
