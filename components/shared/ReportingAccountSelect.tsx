"use client";

import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";

import SearchSelect, { type SearchSelectOption } from "./SearchSelect";

/**
 * One option in the Reporting Account picker. Sourced from
 * `/api/v1/settings/chart-of-accounts` — restricted root rows are
 * surfaced as selectable options too because legacy `fnsh_0200_001`
 * exposes the full tree, not just the leaves.
 *
 * <p>The type lives with this shared adapter (re-exported by Banking's
 * `transaction-history/types.ts`) because the picker is consumed by both
 * Transaction History and Card Transactions.
 */
export type ReportingAccountOption = {
    /** Backend surrogate. */
    chartAcctSeqNo: string;
    /** `CHART_ACCT_CD`. */
    code: string;
    /** Localised account name (defaults to `chart_acct_nm_en`). */
    name: string;
    /** Pre-computed parent trail (`"REVENUE > OTHERS"`); `null` for roots.
     *  Rendered as the muted second line under each dropdown option
     *  (legacy `fnsh_0002_001` reporting-account picker parity). */
    breadcrumb: string | null;
};

type ReportingAccountSelectProps = {
    value: ReportingAccountOption | null;
    options: ReportingAccountOption[];
    onChange: (next: ReportingAccountOption) => void;
    /** Optional × clear — Transaction History supplies it (dedicated clear
     *  endpoint); Card Transactions omits it (no backend clear → value is
     *  changed by re-picking). */
    onClear?: () => void;
    /** When true, render the dropdown chip permanently (Organizer Settings
     *  rows are always in edit mode). */
    alwaysEditable?: boolean;
    matchTriggerWidth?: boolean;
};

/** Display label — "code - name" (e.g. "ACC-01 - REVENUE"). */
const labelOf = (o: ReportingAccountOption) => `${o.code} - ${o.name}`;

/**
 * Reporting Account picker — a thin adapter over the shared
 * {@link SearchSelect}. Maps {@link ReportingAccountOption} →
 * `{ id, label, sublabel }` — label is "code - name", sublabel is the
 * chart-of-accounts parent trail rendered as a muted second line
 * (legacy `fnsh_0002_001` parity). Supplies the "Reporting Account"
 * section title. No RECENT section — the legacy chart-of-accounts picker
 * (`comm_0223_001_r003`) returns the full tree with no recently-used
 * list, verified 2026-07-24.
 */
export default function ReportingAccountSelect({
    value,
    options,
    onChange,
    onClear,
    alwaysEditable = false,
    matchTriggerWidth = false,
}: ReportingAccountSelectProps) {
    const { t } = useTranslation();

    const byId = useMemo(() => {
        const m = new Map<string, ReportingAccountOption>();
        for (const o of options) m.set(o.chartAcctSeqNo, o);
        return m;
    }, [options]);

    const items: SearchSelectOption[] = useMemo(
        () =>
            options.map((o) => ({
                id: o.chartAcctSeqNo,
                label: labelOf(o),
                // Muted parent-trail second line (e.g. "EXPENSES > PAYMENT"),
                // matching the legacy fnsh_0002_001 reporting-account picker.
                sublabel: o.breadcrumb ?? undefined,
            })),
        [options],
    );

    return (
        <SearchSelect
            value={value ? { id: value.chartAcctSeqNo, label: labelOf(value) } : null}
            options={items}
            sectionTitle={t("txn_history.col.reporting_account")}
            ariaLabel={t("txn_history.col.select_account")}
            clearAriaLabel={t("txn_history.reporting_account.clear")}
            placeholder={t("txn_history.col.select_account")}
            searchPlaceholder={t("txn_history.reporting_account.search_placeholder")}
            onChange={(sel) => {
                const opt = byId.get(sel.id);
                if (opt) onChange(opt);
            }}
            onClear={onClear}
            alwaysEditable={alwaysEditable}
            matchTriggerWidth={matchTriggerWidth}
        />
    );
}
