"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    ApiCallError,
    fetchOwnAccountSources,
    fetchOwnAccountTargets,
    postOwnAccountTransferScrapingResult,
    type ListSortParams,
} from "@/lib/api/banking";
import type {
    ApiOwnAccountTransferScrapingResultRequest,
    ApiOwnAccountTransferScrapingResultResponse,
} from "@/lib/types/api";

import {
    toOwnAccountSourceRow,
    toOwnAccountSourceTotals,
    toOwnAccountTargets,
} from "../mappers";
import type {
    OwnAccountSourceRow,
    OwnAccountSourceTotals,
    OwnAccountTargetRow,
    OwnAccountTransferComposerValidation,
} from "../types";

/**
 * Drives the read side of Banking > Own Account Transfer. Owns:
 *   - bank-filter input (single-select; null = "all allowed banks")
 *   - paged source list (loads from `GET /source-accounts`)
 *   - retained `allowed_bank_cds` for the bank popover
 *
 * Path A scope (2026-05-20). The composer / transfer-execution surface
 * (`loadTargets`, `validateDraft`, `submitScrapingResult`) was removed
 * when the backend deferred /target-accounts and /scraping-result to
 * the composer/execution MR. The engine driver itself stays in
 * {@link useNxisasEngine} for the composer MR to reuse; this hook now
 * only orchestrates the read endpoint.
 */

/**
 * Per-bank password-required matrix. Mirrors legacy
 * `trns_0001_007.ts:1029-1094` (`snd_acct_callback` assigns
 * `isPwdRequired` per `BANK_CD` then propagates to `data-next` on
 * the password field).
 *
 *   Required → `acctNumPWD` is consumed by the engine login flow;
 *              the user must type it.
 *   Optional → engine tolerates blank (the bank IB login uses other
 *              credentials — saved cert / OTP / etc.).
 *
 * Exported so the composer can also reflect the matrix in the UI
 * (asterisk + placeholder vary; today we keep the visible field for
 * every bank, only the Step-1 blocker differs).
 */
export const OAT_BANK_PASSWORD_REQUIRED: ReadonlyArray<string> = [
    "11704088", // Shinhan VN
    "11704020", // Woori VN
    "11704080", // KEBHana (out of Path-A allow-list today; future-proof)
];

/** Whether the source-bank requires `acctNumPWD` at Step-1. */
export function isPasswordRequiredFor(bankCd: string | null | undefined): boolean {
    return !!bankCd && OAT_BANK_PASSWORD_REQUIRED.includes(bankCd);
}

export type UseOwnAccountTransferOptions = {
    /** Optional bank_cd filter — null / undefined = all allowed banks
     *  (server coerces unsupported values per OQ-3). */
    bankCd?: string | null;
    /** Optional common-sort params from `useTableSort().sortParams`.
     *  `null` = default order (legacy BANK_CD ASC, ACCT_NO ASC).
     *  Re-fetch fires whenever `sortField` / `sortDirection` change so
     *  the table reflects the cycle (default → ASC → DESC → default). */
    sort?: ListSortParams | null;
};

export type UseOwnAccountTransferState = {
    sources:        OwnAccountSourceRow[];
    totals:         OwnAccountSourceTotals;
    allowedBankCds: string[];
    loading:        boolean;
    error:          { code: string; message: string } | null;

    /** Refresh the source list — call after a successful balance
     *  refresh OR a successful transfer so the picker reflects the
     *  new value. */
    reload: () => Promise<void>;

    /** Lazily load the candidate target accounts for a given source.
     *  Returns the list; subsequent calls for the same source key
     *  return the cached list (the cache is cleared whenever the
     *  bank filter changes). */
    loadTargets: (source: OwnAccountSourceRow) => Promise<OwnAccountTargetRow[]>;

    /** Validate a composer draft (Step 1) before invoking the engine.
     *  Mirrors the client-side guards in legacy `trns_0001_007.ts`,
     *  tightened to the refactor's narrower OQ-A scope (no FCY, no
     *  external target). */
    validateDraft: (draft: ComposerValidationInput) => OwnAccountTransferComposerValidation;

    /** POST a completed engine result to Spring. Resolves with the
     *  recorded row's response on success (including idempotent
     *  replay); throws {@link ApiCallError} on rejection. The
     *  composer wraps this in a try/catch that surfaces the error
     *  code in the system dialog. */
    submitScrapingResult: (
        req: ApiOwnAccountTransferScrapingResultRequest,
    ) => Promise<ApiOwnAccountTransferScrapingResultResponse>;
};

/** Subset of {@link OwnAccountTransferDraft} the validator inspects.
 *  Kept narrower than the full draft so the composer can call the
 *  validator while the user is still typing (without having committed
 *  the password / remarks). */
export type ComposerValidationInput = {
    source: OwnAccountSourceRow;
    target: OwnAccountTargetRow | null;
    amount: number;
    acctPassword?: string;
    remarkForSender?: string;
};

const EMPTY_TOTALS: OwnAccountSourceTotals = {
    totalAccounts:  0,
    totalBalance:   0,
    totalAvailable: 0,
};

export function useOwnAccountTransfer(
    options: UseOwnAccountTransferOptions = {},
): UseOwnAccountTransferState {
    const { bankCd, sort } = options;
    // Stable-string projection of the sort so the `reload` callback's
    // dep list doesn't churn on object identity changes (`useTableSort`
    // returns a fresh memo each tick).
    const sortKey = sort?.sortField && sort?.sortDirection
        ? `${sort.sortField}:${sort.sortDirection}`
        : "";

    const [sources,        setSources]        = useState<OwnAccountSourceRow[]>([]);
    const [totals,         setTotals]         = useState<OwnAccountSourceTotals>(EMPTY_TOTALS);
    const [allowedBankCds, setAllowedBankCds] = useState<string[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [error,          setError]          = useState<{ code: string; message: string } | null>(null);

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Per-source target cache. Keyed by `${bankCd}:${acctNo}`. Cleared
    // whenever the bank filter changes (the target list depends on the
    // same allow-list; a filter swap could change the eligible set).
    const targetCacheRef = useRef<Map<string, OwnAccountTargetRow[]>>(new Map());

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchOwnAccountSources(bankCd ?? null, sort ?? null);
            if (!mountedRef.current) return;
            setSources(res.list.map(toOwnAccountSourceRow));
            setTotals(toOwnAccountSourceTotals(res));
            setAllowedBankCds(res.allowed_bank_cds);
            // Bank filter MAY change the target eligibility set; clear
            // the per-source target cache so the composer re-fetches
            // on next open. Sort changes do NOT invalidate the cache
            // (target list isn't ordering-sensitive).
            targetCacheRef.current.clear();
        } catch (e: unknown) {
            if (!mountedRef.current) return;
            setError(toErrorRecord(e));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
        // `sortKey` is the stable projection of `sort` so identity changes
        // from `useTableSort()`'s memo don't fire a redundant reload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bankCd, sortKey]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const loadTargets = useCallback(
        async (source: OwnAccountSourceRow): Promise<OwnAccountTargetRow[]> => {
            const cacheKey = `${source.bankCd}:${source.acctNo}`;
            const cached   = targetCacheRef.current.get(cacheKey);
            if (cached) return cached;
            const res = await fetchOwnAccountTargets({
                sourceBankCd: source.bankCd,
                sourceAcctNo: source.acctNo,
            });
            const mapped = toOwnAccountTargets(res);
            targetCacheRef.current.set(cacheKey, mapped);
            return mapped;
        },
        [],
    );

    const validateDraft = useCallback<UseOwnAccountTransferState["validateDraft"]>(
        ({ source, target, amount, acctPassword, remarkForSender }) => {
            // Target chosen?
            if (!target) {
                return {
                    ok: false,
                    field: "target",
                    messageKey: "own_account_transfer.composer.error.target_required",
                };
            }
            // Self-transfer guard (defensive — the target list already
            // filters the source row, but the composer may have stale
            // state across re-opens).
            if (source.bankCd === target.bankCd && source.acctNo === target.acctNo) {
                return {
                    ok: false,
                    field: "target",
                    messageKey: "own_account_transfer.composer.error.same_account",
                };
            }
            // Amount required + positive integer.
            if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
                return {
                    ok: false,
                    field: "amount",
                    messageKey: "own_account_transfer.composer.error.amount_required",
                };
            }
            // Available-balance guard. Mirrors legacy
            // `trns_0001_007.ts` available-balance check; the engine
            // will also reject, but failing fast keeps the user out of
            // the engine modal.
            if (amount > source.available) {
                return {
                    ok: false,
                    field: "amount",
                    messageKey: "own_account_transfer.composer.error.amount_too_large",
                };
            }
            // Account password — per-bank requirement matrix.
            // Mirrors legacy `trns_0001_007.ts:1029-1094` (resolved
            // inside `snd_acct_callback` and assigned to `isPwdRequired`):
            //   • Shinhan (11704088) → REQUIRED
            //   • Woori   (11704020) → REQUIRED
            //   • KEBHana (11704080) → REQUIRED
            //   • Vietin  (11704001) → optional (engine tolerates blank)
            //   • Vietcom (11704004) → optional
            //   • IBK     (11704003) → optional
            // The form keeps the field visible for every bank (legacy
            // parity) — the difference is only whether Step-1 blocks
            // on it.
            if (isPasswordRequiredFor(source.bankCd)) {
                if (!acctPassword || acctPassword.trim().length === 0) {
                    return {
                        ok: false,
                        field: "acctPassword",
                        messageKey: "own_account_transfer.composer.error.password_required",
                    };
                }
            }
            // Sender remark length (max 210 — legacy
            // `trns_0001_007_view.jsp:189-194`).
            if (remarkForSender && remarkForSender.length > 210) {
                return {
                    ok: false,
                    field: "remarkForSender",
                    messageKey: "own_account_transfer.composer.error.remark_too_long",
                };
            }
            return { ok: true };
        },
        [],
    );

    const submitScrapingResult = useCallback<UseOwnAccountTransferState["submitScrapingResult"]>(
        (req) => postOwnAccountTransferScrapingResult(req),
        [],
    );

    return useMemo(
        () => ({
            sources,
            totals,
            allowedBankCds,
            loading,
            error,
            reload,
            loadTargets,
            validateDraft,
            submitScrapingResult,
        }),
        [sources, totals, allowedBankCds, loading, error,
         reload, loadTargets, validateDraft, submitScrapingResult],
    );
}

function toErrorRecord(e: unknown): { code: string; message: string } {
    if (e instanceof ApiCallError) {
        return { code: e.code, message: e.message };
    }
    if (e instanceof Error) {
        return { code: "NETWORK", message: e.message };
    }
    return { code: "UNKNOWN", message: String(e) };
}
