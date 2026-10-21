/**
 * In-memory types for Banking > Own Account Transfer. Mirror the wire
 * shapes in {@code lib/types/api.ts} but use camelCase semantic field
 * names per the project's three-naming-layer rule (wire = snake_case,
 * in-memory = camelCase). Mappers live in {@code mappers.ts} alongside.
 *
 * <p>Path A scope (2026-05-20). The composer / transfer-execution
 * in-memory types (`OwnAccountTargetRow`, `OwnAccountTransferHistoryRow`,
 * `OwnAccountTransferComposerValidation`, `OwnAccountTransferType`,
 * `OwnAccountTransferDraft`) were dropped together with their wire
 * counterparts when the backend Path A MR deferred /target-accounts,
 * /transfer-history, /scraping-result to the composer/execution MR.
 * They land back here when those endpoints exist.
 */

/** Row in the source-account picker. */
export type OwnAccountSourceRow = {
    bankCd:              string;
    bankNm:              string;
    acctNo:              string;
    acctNickNm:          string;
    acctTypeCd:          string;
    /** VND amount as a number — use {@code formatVnd} when rendering. */
    balance:             number;
    /** Available (REAL_AMT) — defaults to balance when null. */
    available:           number;
    ccyCd:               "VND";
    /** Engine-reported last-inquiry status. {@code "00000000"} = success;
     *  any other value renders the red Failed pill in the status column. */
    lastInquiryStts:     string | null;
    lastInquiryMsg:      string | null;
    /** yyyyMMddHHmmss UTC. */
    lastInquiryAt:       string | null;
    /** yyyyMMddHHmmss UTC. */
    lastBalanceUpdateAt: string | null;
    /** Permission-derived — drives the per-row Transfer button. */
    canTransfer:         boolean;

    /* --- Phase B cert fields (NOT on the wire yet) ---------------
     * Placeholder slots for the bank-cert material the NXiSAS
     * engine needs to log into a bank IB site. Today the
     * `/source-accounts` DTO does not surface them, so they're
     * always undefined; `hasSavedBankCert(row)` returns false and
     * the composer surfaces a Phase B warning instead of letting
     * the engine attempt a bank login with empty credentials.
     *
     * Phase B porting checklist (full version with rationale and
     * Spring endpoint mapping) lives at
     * `lib/nxisas/jexjs-adapter.ts` — search for "PHASE B TODO".
     * The five fields below are item #2 of that checklist. */
    bankCertSeq?:        string | null;
    certInfoCon?:        string | null;
    nxisasGbSeqNo?:      string | null;
    loginID?:            string | null;
    loginPWD?:           string | null;
};

/** Footer totals shipped alongside the source list. */
export type OwnAccountSourceTotals = {
    totalAccounts:  number;
    totalBalance:   number;
    totalAvailable: number;
};

/** Row in the target-account picker (composer). Per OQ-A every row is
 *  `kind=OWN_ACCOUNT`; the field is preserved for forwards
 *  compatibility with external recipients. */
export type OwnAccountTargetRow = {
    kind:         "OWN_ACCOUNT";
    bankCd:       string;
    bankNm:       string;
    acctNo:       string;
    acctNickNm:   string;
    acctTypeCd:   string | null;
    ccyCd:        string | null;
    /** NAPAS routing code for cross-bank own→own; null for SAME_BANK
     *  routing or when not in the NAPAS dictionary. */
    napasBankCd:  string | null;
};

/** Wire discriminator for the engine job + scraping-result intake. */
export type OwnAccountTransferType = "SAME_BANK" | "NAPAS";

/** Composer draft — user-composed values built in Step 1. The engine
 *  vendor / version come from the engine loader at submit time; not
 *  part of the user-editable draft. */
export type OwnAccountTransferDraft = {
    source:         OwnAccountSourceRow;
    target:         OwnAccountTargetRow;
    transferType:   OwnAccountTransferType;
    /** VND integer (no fractional unit). Stored as number for UI math;
     *  serialized as string on the wire to preserve full precision. */
    amount:         number;
    /** Account password the bank IB site demands to authorise the
     *  transfer. The engine takes it through `_input_bal.acctNumPWD`.
     *
     *  Typed on every transfer (Model A, PO-approved 2026-08-26) and
     *  sent on to `POST /scraping-result`, which persists it to
     *  `ACCT_MSTR.ACCT_PWD` **only when the bank accepted the transfer**
     *  — the column live JEX reads for the same account. The refactor
     *  never reads it back. */
    acctPassword:   string;
    /** Transfer password — a second secret only KEB Hana's job carries
     *  (`_input_bal.transPWD`, legacy `trns_0001_007.ts:1971`). Empty
     *  string for every bank in the current allow-list. Persisted to
     *  `ACCT_MSTR.TRNS_PWD` on the same success-only rule. */
    trnsPassword:   string;
    /** "Sender pays" (A) or "Recipient pays" (B). Mirrors legacy
     *  `TRNS_FEE_TYPE` 1 → "A", 2 → "B". */
    feeBearer:      "A" | "B";
    /** Memo shown to the recipient (legacy `RMRK`). */
    remarkForRecipient: string;
    /** Memo shown to the sender / on the bank statement
     *  (legacy `RMRK2` for some banks; falls back to RMRK when empty). */
    remarkForSender:    string;
    /** Client-generated UUID. Re-used verbatim if the engine call
     *  retries so the backend can deduplicate. */
    idempotencyKey: string;
};

/** Validation outcome for the composer's "Next" button. Surfaces a
 *  field-level error key or `ok:true`. Mirrors the legacy `trns_0001_007`
 *  client guards tightened to the refactor's narrower scope. */
export type OwnAccountTransferComposerValidation =
    | { ok: true }
    | {
          ok: false;
          field: "target" | "amount" | "acctPassword" | "trnsPassword" | "remarkForSender";
          messageKey: string;
          messageArgs?: Record<string, string>;
      };
