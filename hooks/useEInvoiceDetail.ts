"use client";

import { fetchEInvoiceDetail } from "@/lib/api/addon";
import { useApiData } from "@/lib/api/useApiData";
import type { EInvoiceDetail } from "@/components/addon/einvoices/detailTypes";

export type UseEInvoiceDetailResult = {
    data: EInvoiceDetail | null;
    loading: boolean;
    error: Error | null;
};

/**
 * Fetch a single e-Invoice document for the "View e-Invoice Details" modal.
 * Thin wrapper over the shared {@link useApiData} hook (reuse per the two-call
 * rule) — it owns the fetch-on-deps effect + stale-while-revalidate state.
 *
 * <p>Runs only while `enabled` (the modal is open) AND a `docId` is present;
 * otherwise the loader resolves to `null` (no network call). Re-fetches when
 * the selected `docId` / `type` changes. Errors surface as the thrown
 * {@link import("@/lib/api/banking").ApiCallError} (an `Error`), carrying the
 * `WBE` code + message.
 */
export function useEInvoiceDetail(
    docId: string | null | undefined,
    type: "SALES" | "EXPENSE",
    enabled: boolean,
): UseEInvoiceDetailResult {
    return useApiData<EInvoiceDetail | null>(
        () =>
            enabled && docId
                ? fetchEInvoiceDetail(docId, type)
                : Promise.resolve(null),
        [docId, type, enabled],
    );
}
