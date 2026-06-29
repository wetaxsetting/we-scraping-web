"use client";

import { useCallback, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import {
    ApiCallError,
    haengsungPaymentRefresh,
    type HaengsungPaymentType,
} from "@/lib/api/payment";
import { useTranslation } from "@/lib/i18n";

/**
 * Shared handler for the HAENGSUNG (`PRDT_TYPE='H'`) Oracle payment Refresh
 * button on the four Scheduled-Payment list pages (Vendor / Expense / Payroll
 * / Overseas). Mirrors legacy `pymn_000{1,3,5,7}_*_c002` — the single shared
 * helper, not one copy per module (two-call rule, CLAUDE.md §1).
 *
 * The Refresh button on those pages used to only re-fetch the existing list
 * (`refreshList` bumping a refresh key). This hook makes the click first call
 * the backend import (`POST /api/v1/payments/haengsung/refresh`), then reload
 * the list on success. Internal Transfer never adopts this — it keeps Excel
 * Upload for every product type.
 *
 * @param paymentType   the module's wire payment type (VENDOR/EXPENSE/PAYROLL/OVERSEAS).
 * @param getPeriodDate resolves the current filter window to the wire
 *                      `period_date` (`YYYYMMDD` or `YYYYMMDD-YYYYMMDD`) at
 *                      click time, so the import covers exactly what the user
 *                      is viewing.
 * @param onSuccess     called after a successful import to reload the list.
 */
export function useHaengsungRefresh(opts: {
    paymentType: HaengsungPaymentType;
    getPeriodDate: () => string;
    onSuccess: () => void;
}): { refreshing: boolean; runRefresh: () => Promise<void> } {
    const { paymentType, getPeriodDate, onSuccess } = opts;
    const dialog = useDialog();
    const { t } = useTranslation();
    const [refreshing, setRefreshing] = useState(false);

    const runRefresh = useCallback(async () => {
        if (refreshing) return; // guard against duplicate clicks while in flight
        setRefreshing(true);
        try {
            const result = await haengsungPaymentRefresh({
                payment_type: paymentType,
                period_date: getPeriodDate(),
            });
            // Reload the list so the freshly-imported drafts appear.
            onSuccess();
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("payment.haengsung.refresh.success", {
                    imported: String(result.imported),
                    transactions: String(result.details_imported),
                }),
            });
        } catch (err) {
            // 401 is handled centrally by the axios interceptor; everything
            // else surfaces an error dialog. Map the known business codes to
            // localized copy; fall back to a generic message otherwise.
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: refreshErrorMessage(t, code),
                errorCode: code,
            });
        } finally {
            setRefreshing(false);
        }
    }, [refreshing, paymentType, getPeriodDate, onSuccess, dialog, t]);

    return { refreshing, runRefresh };
}

/** Map a backend error code to a localized HAENGSUNG-refresh message. */
function refreshErrorMessage(
    t: (key: string, vars?: Record<string, string | number>) => string,
    code: string,
): string {
    switch (code) {
        case "WBE_HS_REFRESH_DISABLED":
            return t("payment.haengsung.refresh.error_disabled");
        case "WBE_HS_REFRESH_NOT_HAENGSUNG":
            return t("payment.haengsung.refresh.error_not_haengsung");
        case "WBE_HS_REFRESH_NO_TAX_ID":
            return t("payment.haengsung.refresh.error_no_tax_id");
        default:
            return t("payment.haengsung.refresh.error_generic");
    }
}
