"use client";

import { useCallback } from "react";

import type { DialogOptions } from "@/components/shared/dialog";
import {
    deleteVatDeclaration,
    unlockVatDeclaration,
} from "@/lib/api/addon";
import type { TaxFilingRow } from "./types";
import { vatDeclErrorMessage } from "./vatDeclErrors";

/**
 * The status-changing dashboard actions of the VAT declaration list: Unlock and
 * Delete.
 *
 * They share one shape — confirm, call, refresh, report — and differ only in
 * endpoint, copy, and whether the confirm is destructive. Keeping them here
 * rather than inline in the page makes that shape testable without rendering the
 * table, and stops them from drifting apart (Unlock had silently lost the
 * localized §9 message that the Lock path carried).
 *
 * Lock is deliberately absent: the dashboard does not expose it (product
 * decision, 2026-08-04) and the form's own Lock has to save the draft first, so
 * it keeps its own flow — sharing only the error map in `vatDeclErrors`.
 */

type Deps = {
    /** `useDialog().open` */
    open: (options: DialogOptions) => void;
    t: (key: string, vars?: Record<string, string | number>) => string;
    /** Re-fetch the list — the mutation responses are not authoritative here. */
    onRefresh: () => void;
};

export type TaxFilingActions = {
    unlock: (row: TaxFilingRow) => void;
    remove: (row: TaxFilingRow) => void;
};

/** Every action funnels through this so confirm chrome cannot diverge. */
function confirmThen(
    { open, t, onRefresh }: Deps,
    opts: {
        descriptionKey: string;
        period: string;
        successKey: string;
        /** Red Continue — Delete only. */
        destructive?: boolean;
        run: () => Promise<unknown>;
    },
) {
    open({
        type: "confirmation",
        title: t("dialog.confirmation"),
        description: t(opts.descriptionKey, { period: opts.period }),
        confirmText: t("dialog.yes"),
        cancelText: t("dialog.no"),
        ...(opts.destructive ? { destructive: true } : {}),
        onConfirm: async () => {
            try {
                await opts.run();
                onRefresh();
                open({
                    type: "success",
                    title: t("dialog.success"),
                    description: t(opts.successKey),
                });
            } catch (err: unknown) {
                const e = err as { code?: string; message?: string };
                open({
                    type: "error",
                    title: t("dialog.error"),
                    // Shared code→key map: §9 order failures reach here for both
                    // Lock and Unlock, so neither can drift from the other.
                    description: vatDeclErrorMessage(e, t),
                    errorCode: e?.code ?? "WBE9999",
                });
            }
        },
    });
}

export function useTaxFilingActions(deps: Deps): TaxFilingActions {
    const { open, t, onRefresh } = deps;

    const unlock = useCallback(
        (row: TaxFilingRow) =>
            confirmThen(
                { open, t, onRefresh },
                {
                    descriptionKey: "tax_filing.unlock_confirm",
                    period: row.filingPeriod,
                    successKey: "tax_filing.unlock_success",
                    run: () => unlockVatDeclaration(row.declId),
                },
            ),
        [open, t, onRefresh],
    );

    const remove = useCallback(
        (row: TaxFilingRow) =>
            confirmThen(
                { open, t, onRefresh },
                {
                    descriptionKey: "tax_filing.delete_confirm",
                    period: row.filingPeriod,
                    successKey: "tax_filing.delete_success",
                    // Irreversible on a Draft — the only red CTA in this module.
                    destructive: true,
                    run: () => deleteVatDeclaration(row.declId),
                },
            ),
        [open, t, onRefresh],
    );

    return { unlock, remove };
}
