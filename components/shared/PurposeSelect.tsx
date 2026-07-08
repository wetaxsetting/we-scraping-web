"use client";

import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";

import SearchSelect, { type SearchSelectOption } from "./SearchSelect";

/**
 * One option in the Purpose picker. Sourced from
 * `/api/v1/settings/purpose-settings` (Transaction History) or
 * `/api/v1/payment/card-transactions/purpose-options` (Card Transactions).
 *
 * <p>The type lives with this shared adapter (re-exported by Banking's
 * `transaction-history/types.ts`) because the picker is consumed by both
 * Transaction History and Card Transactions.
 */
export type PurposeOption = {
    /** Backend system PK (`USE_USAG_CD`). */
    useUsagCd: string;
    /** User-visible short code (`HAND_USE_USAG_CD` — e.g. "40").
     *  For Card Transactions this equals {@link useUsagCd}. */
    code: string;
    /** Display name (`USE_USAG_NM` — e.g. "Loan Repaid"). */
    name: string;
};

type PurposeSelectProps = {
    value: PurposeOption | null;
    options: PurposeOption[];
    recentUseUsagCds: string[];
    onChange: (next: PurposeOption) => void;
    onClear?: () => void;
    alwaysEditable?: boolean;
    matchTriggerWidth?: boolean;
    readOnly?: boolean;
};

/** Display label — "code name" (e.g. "40 Loan Repaid"). */
const labelOf = (o: PurposeOption) => `${o.code} ${o.name}`.trim();

/**
 * Purpose picker — a thin adapter over the shared {@link SearchSelect}.
 * Maps {@link PurposeOption} → `{ id, label }`, supplies the "Purpose"
 * section title + RECENT list, and maps the picked generic option back to
 * the domain option for `onChange`.
 */
export default function PurposeSelect({
    value,
    options,
    recentUseUsagCds,
    onChange,
    onClear,
    alwaysEditable = false,
    matchTriggerWidth = false,
    readOnly = false,
}: PurposeSelectProps) {
    const { t } = useTranslation();

    const byId = useMemo(() => {
        const m = new Map<string, PurposeOption>();
        for (const o of options) m.set(o.useUsagCd, o);
        return m;
    }, [options]);

    const items: SearchSelectOption[] = useMemo(
        () => options.map((o) => ({ id: o.useUsagCd, label: labelOf(o) })),
        [options],
    );

    return (
        <SearchSelect
            value={value ? { id: value.useUsagCd, label: labelOf(value) } : null}
            options={items}
            recentIds={recentUseUsagCds}
            sectionTitle={t("txn_history.col.purpose")}
            recentTitle={t("txn_history.purpose.recent")}
            ariaLabel={t("txn_history.col.select_purpose")}
            clearAriaLabel={t("txn_history.purpose.clear")}
            onChange={(sel) => {
                const opt = byId.get(sel.id);
                if (opt) onChange(opt);
            }}
            onClear={onClear}
            alwaysEditable={alwaysEditable}
            matchTriggerWidth={matchTriggerWidth}
            readOnly={readOnly}
        />
    );
}
