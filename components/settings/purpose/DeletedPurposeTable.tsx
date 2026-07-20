"use client";

import { RotateCcw } from "lucide-react";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { useTranslation } from "@/lib/i18n";
import type { PurposeGroup } from "@/lib/api/purposeSettings";

/** One soft-deleted purpose row for the Deleted Purpose tab. */
export type DeletedPurposeItem = {
    useUsagCd: string;
    code: string;
    name: string;
    description: string;
    /** Legacy group — "4"/"6"/null; drives the Categories column. */
    group: PurposeGroup | null;
};

type DeletedPurposeTableProps = {
    rows: DeletedPurposeItem[];
    onRestore: (row: DeletedPurposeItem) => void;
    restoringIds: Set<string>;
};

/**
 * Deleted Purpose tab table — Figma / legacy comm_0187_003.
 * Columns: Purpose Code · Purpose/Account · Categories · Description ·
 * Restore. Read-only apart from the per-row Restore action.
 */
export default function DeletedPurposeTable({
    rows,
    onRestore,
    restoringIds,
}: DeletedPurposeTableProps) {
    const { t } = useTranslation();

    const categoryLabel = (group: PurposeGroup | null): string => {
        if (group === "4") return t("settings.purpose.tabs.deposit");
        if (group === "6") return t("settings.purpose.tabs.withdrawal");
        return "-";
    };

    return (
        <table className="table-fixed border-collapse" style={{ width: "100%", minWidth: "980px" }}>
            <colgroup>
                <col className="w-[140px]" />
                <col className="w-[260px]" />
                <col className="w-[160px]" />
                <col className="w-[340px]" />
                <col className="w-[120px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-wb-bg-sidebar">
                <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border">
                    <HeaderCell>{t("settings.purpose.col.code")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.name")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.categories")}</HeaderCell>
                    <HeaderCell>{t("settings.purpose.col.description")}</HeaderCell>
                    <th aria-label={t("settings.purpose.col.actions")} className="bg-wb-bg-sidebar" />
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr
                        key={row.useUsagCd}
                        className="h-12 border-b border-wb-table-border last:border-b-0 bg-white hover:bg-black/[0.02]"
                    >
                        <td className="px-3 align-middle">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.code}
                            </span>
                        </td>
                        <td className="px-3 align-middle">
                            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                                {row.name}
                            </span>
                        </td>
                        <td className="px-3 align-middle">
                            <span className="block truncate text-wb-13 font-medium text-wb-ntrl-6">
                                {categoryLabel(row.group)}
                            </span>
                        </td>
                        <td className="px-3 align-middle">
                            <EllipsisTooltip
                                text={row.description}
                                className="text-wb-13 font-normal text-wb-ntrl-8"
                            />
                        </td>
                        <td className="px-3 align-middle">
                            <div className="flex items-center justify-end">
                                <button
                                    type="button"
                                    onClick={() => onRestore(row)}
                                    disabled={restoringIds.has(row.useUsagCd)}
                                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-wb-13 font-medium text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <RotateCcw className="size-3.5" strokeWidth={1.8} aria-hidden />
                                    {t("settings.purpose.actions.restore")}
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    return (
        <th className="whitespace-nowrap bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold text-wb-dark">
            {children}
        </th>
    );
}
