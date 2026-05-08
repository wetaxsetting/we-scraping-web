"use client";

import { useMemo, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import FilterDropdown from "@/components/shared/FilterDropdown";
import FilterRow from "@/components/shared/FilterRow";
import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import { useTranslation } from "@/lib/i18n";

import TransferDialog from "./TransferDialog";
import TransferOwnAccountsTable from "./TransferOwnAccountsTable";
import TransferOwnAccountsTableFooter from "./TransferOwnAccountsTableFooter";
import type { OwnAccountRow, OwnAccountTotals } from "./types";

/**
 * Transfer — Own Accounts listing page. Figma 96:41949.
 *
 * Shows every account the user owns with Bank / Nickname / Balance /
 * Available / Last Update columns plus a per-row Transfer button. Clicking
 * Transfer opens `<TransferDialog>` with that row preselected as the From
 * account — the transfer form no longer occupies the page body.
 *
 * Bottom layout follows the Approval Box canonical pattern (CLAUDE.md §7a):
 * the table + footer live inside one shared flex scroll container and the
 * footer uses `mt-auto` to stay anchored at the bottom of the viewport even
 * when there are few rows; pagination sits outside that container.
 */
type TransferOwnAccountsPageProps = {
    /** API-fetched rows. Defaults to an empty array — Sprint 1 stabilization
     *  removed the mock seed; API is the single source of truth. */
    rows?: OwnAccountRow[];
    /** API-fetched totals. Zero-valued default while loading. */
    totals?: OwnAccountTotals;
};

const EMPTY_TOTALS: OwnAccountTotals = { count: 0, balance: "0", available: "0" };

export default function TransferOwnAccountsPage({
    rows: rowsProp,
    totals: totalsProp,
}: TransferOwnAccountsPageProps = {}) {
    const { t } = useTranslation();
    const [bankFilter] = useState(t("transfer_own.filter.all_banks"));
    const [selectedAccount, setSelectedAccount] = useState<OwnAccountRow | null>(
        null,
    );

    const rows = useMemo(() => rowsProp ?? [], [rowsProp]);
    const totals = totalsProp ?? EMPTY_TOTALS;

    return (
        <>
            <PageLayout>
                <PageHeader title={t("transfer_own.title")}>
                    <button
                        type="button"
                        aria-label={t("common.open_list")}
                        className="flex cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-list.svg"
                            alt=""
                            aria-hidden
                            className="size-5"
                        />
                    </button>
                </PageHeader>

                <FilterRow>
                    <FilterDropdown
                        value={bankFilter}
                        className="w-[var(--w-wb-filter-bank)]"
                    />
                </FilterRow>

                <DataTableShell
                    footerMode="paginationWithTotals"
                    table={
                        <TransferOwnAccountsTable
                            rows={rows}
                            onTransfer={(row) => setSelectedAccount(row)}
                        />
                    }
                    footer={
                        <TransferOwnAccountsTableFooter
                            totals={totals}
                            className="mt-auto"
                        />
                    }
                    pagination={
                        <Pagination
                            page={1}
                            pageCount={3}
                            pageSize={10}
                            totalLabel={t("common.showing_of", {
                                shown: String(rows.length),
                                total: String(rows.length),
                            })}
                            className="shrink-0"
                        />
                    }
                />
            </PageLayout>

            <TransferDialog
                open={selectedAccount !== null}
                fromAccountId={selectedAccount?.id}
                onClose={() => setSelectedAccount(null)}
            />
        </>
    );
}
