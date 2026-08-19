"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
    ApiCallError,
    fetchNapasBankInfo,
    fetchOwnAccountSources,
    fetchOwnAccountTargets,
    postOwnAccountTransferScrapingResult,
    type ListSortParams,
} from "@/lib/api/banking";
import type {
    ApiOwnAccountTransferScrapingResultRequest,
    ApiOwnAccountTransferScrapingResultResponse,
} from "@/lib/types/api";
import { utf8ByteLength } from "@/lib/text";

import { getRemarkByteLimits, getRemarkUiPolicy } from "../bank-profiles";
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

    /** Pre-transfer NAPAS bank-code validation. Mirrors legacy
     *  `fnReadNapasBankCode` (`trns_0001_007.ts:2255-2294` →
     *  `trns_0001_001_r003`) which runs **before** the engine scrape.
     *  Resolves `{ok:true}` when the code is in the dictionary, or
     *  `{ok:false, code}` (does not throw) so the composer can block the
     *  scrape and surface the legacy-equivalent message. */
    validateNapas: (napasBankCd: string | null | undefined) => Promise<NapasValidationResult>;

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
    remarkForRecipient?: string;
};

/** Outcome of the pre-transfer NAPAS bank-code validation (legacy
 *  `fnReadNapasBankCode` → `trns_0001_001_r003`). `ok:false` carries
 *  the backend error code so the composer can surface it. */
export type NapasValidationResult =
    | {
          ok: true;
          bankCd: string;
          /**
           * Recipient-bank display names from the NAPAS dictionary
           * (`SHORT_NAME` / `LONG_NAME_EN`), surfaced so the composer can
           * build the legacy Transfer Confirmation label
           * `SHORT_NAME | LONG_NAME_EN (NAPAS_BANK_CD)` — e.g.
           * `SHINHAN BANK | Shinhan Bank Vietnam Limited (970424)`.
           *
           * <p>These ride along free: this lookup already runs on every
           * cross-bank leg (legacy `fnReadNapasBankCode` parity), so no
           * extra request is made. `null` when the dictionary row has no
           * value for that column — the composer degrades gracefully.
           */
          shortName: string | null;
          longNameEn: string | null;
      }
    | { ok: false; code: string };

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
        ({ source, target, amount, acctPassword, remarkForSender, remarkForRecipient }) => {
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
            // NOTE (audit fix 2026-06-01): the legacy popup does NOT
            // hard-block amount > available balance in its `#next_step`
            // handler (legacy business-rules §14 Open-Q #9 — the check
            // is left to the bank/engine response, not the client). The
            // refactor previously added a stricter client block
            // (`amount > source.available` → error). That stricter
            // behaviour is removed here to match legacy: the engine /
            // bank IB site is the authority on insufficient funds, and
            // the scraping-result error path surfaces the bank's
            // rejection. `source.available` can also be stale between
            // balance refreshes, so a client block would wrongly stop a
            // legitimate transfer. Backend/bank response error handling
            // is unchanged.
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
            // Remark byte-length — PER-BANK, PER-DIRECTION (audit fix
            // 2026-06-01). Measured in UTF-8 BYTES, not JS chars, to
            // match the legacy `validateStringByTES` byte count
            // (`trns_0001_007.ts:1542-1544`) and each bank IB site's byte
            // limit — Vietnamese diacritics are 2–3 bytes, so a
            // sub-limit character count can still exceed the byte cap.
            // Limits come from the per-bank table in `bank-profiles.ts`
            // (`getRemarkByteLimits`); direction = within-bank vs NAPAS
            // (`source.bankCd === target.bankCd`). The UI also clamps to
            // these limits live; this is the backstop. The `{max}` arg
            // surfaces the actual cap in the message.
            const internal = source.bankCd === target.bankCd;
            const limits = getRemarkByteLimits(source.bankCd, internal);
            const policy = getRemarkUiPolicy(source.bankCd);
            // Sender row is editable for every bank — always byte-check it.
            if (policy.senderEnabled
                && remarkForSender && utf8ByteLength(remarkForSender) > limits.sender) {
                return {
                    ok: false,
                    field: "remarkForSender",
                    messageKey: "own_account_transfer.composer.error.remark_too_long",
                    messageArgs: { max: String(limits.sender) },
                };
            }
            // Recipient row is byte-checked ONLY when it is editable
            // (Woori / IBK). For module-style banks the recipient row is
            // disabled/read-only, so it can never hold user text and must
            // not be validated (audit fix 2026-06-01 — "validate only
            // editable fields, do not fail disabled recipient").
            if (policy.recipientEnabled
                && remarkForRecipient && utf8ByteLength(remarkForRecipient) > limits.recipient) {
                return {
                    ok: false,
                    field: "remarkForSender",
                    messageKey: "own_account_transfer.composer.error.remark_too_long",
                    messageArgs: { max: String(limits.recipient) },
                };
            }
            return { ok: true };
        },
        [],
    );

    const validateNapas = useCallback<UseOwnAccountTransferState["validateNapas"]>(
        async (napasBankCd) => {
            // Empty NAPAS code on a cross-bank leg is itself a failure —
            // legacy `fnReadNapasBankCode` rejects a blank code with
            // `WBE1143`. Surface the same not-registered code so the
            // composer blocks the scrape.
            if (!napasBankCd || !napasBankCd.trim()) {
                return { ok: false, code: "WBE_OWN_ACCOUNT_TRANSFER_NAPAS_NOT_FOUND" };
            }
            try {
                const row = await fetchNapasBankInfo(napasBankCd);
                // The display names come back on this same row — pass them
                // through instead of discarding them, so the composer can
                // build the legacy confirmation label without a second
                // request. Backend B9 (2026-06-04) mapped these columns on
                // `NapasBankInfo`; they are no longer always null.
                return {
                    ok:         true,
                    bankCd:     row.bank_cd,
                    shortName:  row.short_name,
                    longNameEn: row.long_name_en,
                };
            } catch (e: unknown) {
                const code = e instanceof ApiCallError
                    ? e.code
                    : "WBE_OWN_ACCOUNT_TRANSFER_NAPAS_NOT_FOUND";
                return { ok: false, code };
            }
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
            validateNapas,
            submitScrapingResult,
        }),
        [sources, totals, allowedBankCds, loading, error,
         reload, loadTargets, validateDraft, validateNapas, submitScrapingResult],
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
