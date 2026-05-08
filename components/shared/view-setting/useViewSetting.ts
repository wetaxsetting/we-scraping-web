"use client";

import { useCallback, useEffect, useState } from "react";

import {
    fetchScreenOptions,
    resetScreenOptions,
    saveScreenOptions,
} from "@/lib/api/screenOption";
import type { ApiScreenOptionItem } from "@/lib/types/api";

/**
 * Shared hook backing every page's View Setting popup. Keys per-page
 * config by `(webSvcId, dymAreaId)`; the backend at
 * `/api/v1/screen-options/{webSvcId}/{dymAreaId}` merges system defaults
 * with the caller's user overrides for that exact area.
 *
 * `webSvcId` follows the semantic-id convention from
 * docs/features/view-setting.md (e.g. `banking-account-inquiry-vnd`).
 * `dymAreaId` defaults to `"default"` for single-area pages — the network
 * call always sends a non-empty area, mirroring the backend contract.
 *
 * The hook intentionally does NOT manage popup open/close state — that
 * stays with the page so the View Setting button can sit next to other
 * page-specific chrome. Pages call `open` / `close` on the popover
 * component themselves and consume `items` + `setItems` for the
 * checkbox / reorder UI.
 *
 * Loading is one-shot on mount; `reload` re-fires when the page wants
 * to refresh after an external mutation. `save` and `reset` POST/DELETE
 * to the backend and refresh the local items in-place. On save failure
 * the previous items are restored so a failed save doesn't leave the
 * UI in an inconsistent optimistic state.
 */
export type UseViewSettingState = {
    /** Current merged list (system defaults overlaid with user overrides). */
    items: ApiScreenOptionItem[];
    /** True until the first load resolves. UI shows a spinner. */
    loading: boolean;
    /** Set when the most recent load / save / reset failed. UI surfaces
     *  via a global system dialog. */
    error: { code: string; message: string } | null;

    /** In-popup setter — let the user toggle / reorder before saving.
     *  Updates are local until `save` is called. */
    setItems: (next: ApiScreenOptionItem[]) => void;

    /** Persist the given items as user overrides; refreshes from the
     *  backend response on success. On failure, items are rolled back to
     *  their pre-save value and the error is re-thrown so the caller can
     *  surface it. */
    save: (next: ApiScreenOptionItem[]) => Promise<void>;
    /** Wipe user overrides; refreshes from system defaults. Resolves
     *  with the refreshed items so callers can sync local draft state
     *  without reading stale `items` from the closure. */
    reset: () => Promise<ApiScreenOptionItem[]>;
    /** Re-load from the API (useful after an external change). */
    reload: () => Promise<void>;
};

export function useViewSetting(
    webSvcId: string,
    dymAreaId: string = "default",
): UseViewSettingState {
    const [items, setItemsState] = useState<ApiScreenOptionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<UseViewSettingState["error"]>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchScreenOptions(webSvcId, dymAreaId);
            setItemsState(sortByDispOrd(res.items));
        } catch (e: unknown) {
            setError(extractError(e));
        } finally {
            setLoading(false);
        }
    }, [webSvcId, dymAreaId]);

    useEffect(() => {
        // Fire once on mount + whenever the (webSvcId, dymAreaId) pair
        // changes. React-strict-mode dev double-invoke is harmless: the
        // second load returns the same data and replaces state idempotently.
        void reload();
    }, [reload]);

    const save = useCallback(
        async (next: ApiScreenOptionItem[]) => {
            // Capture the prior items before optimistically updating so
            // we can roll back on failure. Optimistic update is what
            // makes the table reflect the change immediately when the
            // popup closes; without it the user would see a one-frame
            // flash of the old state before the network round-trip.
            const previous = items;
            setError(null);
            setItemsState(sortByDispOrd(next));
            try {
                const res = await saveScreenOptions(webSvcId, dymAreaId, next);
                setItemsState(sortByDispOrd(res.items));
            } catch (e: unknown) {
                setItemsState(previous);
                setError(extractError(e));
                throw e;
            }
        },
        [webSvcId, dymAreaId, items],
    );

    const reset = useCallback(async (): Promise<ApiScreenOptionItem[]> => {
        setError(null);
        try {
            const res = await resetScreenOptions(webSvcId, dymAreaId);
            const sorted = sortByDispOrd(res.items);
            setItemsState(sorted);
            return sorted;
        } catch (e: unknown) {
            setError(extractError(e));
            throw e;
        }
    }, [webSvcId, dymAreaId]);

    return {
        items,
        loading,
        error,
        setItems: setItemsState,
        save,
        reset,
        reload,
    };
}

function sortByDispOrd(items: ApiScreenOptionItem[]): ApiScreenOptionItem[] {
    return [...items].sort((a, b) => a.disp_ord - b.disp_ord);
}

function extractError(e: unknown): UseViewSettingState["error"] {
    if (e && typeof e === "object" && "code" in e && "message" in e) {
        return {
            code: String((e as { code: unknown }).code ?? "WBE9999"),
            message: String((e as { message: unknown }).message ?? "Unexpected error"),
        };
    }
    return { code: "WBE9999", message: "Unexpected error" };
}

/** Re-export the wire row shape so consumers don't reach into lib/types. */
export type ViewSettingItem = ApiScreenOptionItem;

/**
 * Special FIELD_IDs that are present in the View Setting data (driving
 * column ordering / preservation through Save+Reset) but must never appear
 * in the View Setting popup. CHECKBOX is the row-selection column at
 * DISP_ORD=0; ETC is the optional trailing action column at DISP_ORD=99.
 * Both are admin-controlled — users cannot hide, reorder, or otherwise
 * edit them from the popover.
 */
export const VIEW_SETTING_SPECIAL_FIELD_IDS: ReadonlySet<string> = new Set([
    "CHECKBOX",
    "ETC",
]);

export function isSpecialViewSettingField(fieldId: string): boolean {
    return VIEW_SETTING_SPECIAL_FIELD_IDS.has(fieldId);
}
