/**
 * Per-bank engine-job parameter profiles for Banking > Own Account
 * Transfer. Ported verbatim from legacy `trns_0001_007.ts:1916-2115`
 * — the bank-specific quirks the Coocon NXiSAS engine expects for the
 * TRANSFER / TRANSFER_INTERNAL / *_ML variants.
 *
 * <p><b>Do not change these values without an engine-team sign-off.</b>
 * The strings are part of the vendor's wire contract with each bank's
 * IB site; a typo or rename will silently fail the scrape and surface
 * as a generic engine error instead of a typed business code.
 *
 * <p>Coverage: the 5 banks in
 * {@code OwnAccountTransferConstants.ALLOWED_BANK_CDS_DEFAULT}:
 * Shinhan(Vietnam) `11704088`, IBK(Vietnam) `11704003`,
 * Vietcom Bank `11704004`, Vietin Bank `11704001`,
 * Woori(Vietnam) `11704020`. HAENGSUNG (`PRDT_TYPE='H'`) narrows the
 * allow-list to VietinBank only — same profile applies.
 *
 * <p>Bank codes the legacy ts had profiles for but the refactor does
 * not surface (BIDV `11704008`, KEBHana `11704080`) are out of scope
 * — they are NOT in the refactor's allow-list and would never reach
 * this map. They are intentionally omitted.
 */

import type { OwnAccountTransferDraft } from "./types";

/** Engine job kinds. Values match legacy `trns_0001_007.ts` literals. */
export type NxisasJobKind =
    | "TRANSFER"
    | "TRANSFER_ML"
    | "TRANSFER_INTERNAL"
    | "TRANSFER_INTERNAL_ML";

/**
 * Shape the bundle's `_v2nxisas.callNxisas(...)` consumes — one entry
 * in the {@code orgObj} array. The {@code Input} bag carries the
 * per-bank fields each bank's IB site reads at scrape-time.
 *
 * <p>The fields are intentionally loose-typed ({@code string} unions)
 * because the engine accepts strings exclusively; numbers are
 * stringified upstream by the composer.
 */
export type NxisasJobEntry = {
    Job:   NxisasJobKind;
    Input: NxisasJobInput;
};

export type NxisasJobInput = {
    /** Sender (own) account number. Legacy `data.REC.ACCT_NO`. */
    acctNum:        string;
    /** Receiver account number. Legacy `data.REC2.RCPT_ACCTN_NO`. */
    remitAcctNum:   string;
    /** Transfer amount as a string (VND integer). Legacy `data.REC.TRNS_AMT`. */
    remitAmt:       string;
    /** Receiver bank's NAPAS code. Legacy `data.REC2.NAPAS_BANK_CD`. */
    remitBankCode:  string;
    /** Currency. Always `"VND"` under OQ-A scope. */
    currency:       "VND";
    /** Fee bearer: "1" sender pays, "2" recipient pays. Legacy
     *  `data.REC3.TRNS_FEE_VAL`. May be undefined when the bank-
     *  specific tweak deletes it (VIETIN TRANSFER_ML). */
    feePaymentType?: "1" | "2";
    /** yyyymmdd date string. Legacy `moment(new Date()).format("YYYYMMDD")`. */
    remitDate:      string;
    /** Transfer-type discriminator. May be deleted by the VIETIN
     *  TRANSFER_INTERNAL_ML profile (engine resolves from job kind
     *  alone in that case). */
    transType?:     "" | "1" | "2";
    /** Confirm flag the engine reads. Always "Y". */
    transInfoYN:    "Y";
    /** Free-form memo (legacy `_input_bal.memo`). Some banks use this
     *  for the recipient memo; others use `memo2`. See per-bank notes. */
    memo:           string;
    /** Second memo slot (legacy `_input_bal.memo2`). Only set by banks
     *  that have a separate sender / recipient memo (IBK, Woori, etc.). */
    memo2?:         string;
    /** Account password the bank login screen reads. Some banks make
     *  it optional (Shinhan); some require it (IBK, KEBHana, Woori). */
    acctNumPWD?:    string;
    /** Transfer password (separate from acct password). Used by
     *  KEBHana only. */
    transPWD?:      string;
    /** Remit purpose label the bank IB asks for. KEBHana sets a fixed
     *  "Fund transfer" value. */
    remitPurpose?:  string;
    /** Some banks (Shinhan, Woori in some cases) attach branch + name
     *  to the remit. Pinned per-bank below. */
    remitBranchCode?: string;
    remitBranch?:     string;
    /** Recipient name. Shinhan + Woori (some branches) require it. */
    acceptName?:    string;
};

/** Top-level engine payload (one entry per `orgObj`). Mirrors legacy
 *  `_nxisas_dataObj` at `trns_0001_007.ts:2019-2117`. */
export type NxisasOrgObj = {
    bankCd:        string;
    bankNm:        string;
    /** Bank-cert content (cert id / login id). Surfaced from
     *  {@code _v2nxisas.getCertInfo}. Not handled by the refactor
     *  yet — composer hands an empty string until the cert popup
     *  ships in the credentials feature. */
    certInfoCon:   string;
    bankCertSeq:   string;
    /** Cert-group sequence number. Same source as `certInfoCon`. */
    nxisasGbSeqNo: string;
    loginID:       string;
    loginPWD:      string;
    /** Job list (always size 1 for a single transfer). */
    job:           NxisasJobEntry[];
    /** Keep the engine session open after the transfer. Always true
     *  in the legacy code except Woori VN which sets it false. */
    nonLogout:     boolean;
    /** Skip the engine login screen. Default false. Set true by the
     *  Woori VN profile. */
    nonLogin?:     boolean;
};

/** Helper signature each bank profile must implement. Receives the
 *  draft + the engine-resolved fields, returns a single {@link NxisasJobEntry}
 *  ready to drop into {@link NxisasOrgObj.job}. The "internal" flag is
 *  set when the source and target share a BANK_CD (legacy: same-bank
 *  flows use the `*_INTERNAL` job kind). */
export type BankProfileBuilder = (args: {
    draft:    OwnAccountTransferDraft;
    /** True when source and target are at the same bank (SAME_BANK). */
    internal: boolean;
    /** Engine date stamp (yyyymmdd UTC), pre-built by the composer. */
    remitDate: string;
    /** NXiSAS module CLASS for the source bank (legacy
     *  `getModuleInfo(...).CLASS`). Only Vietcom branches on it today
     *  (`"DIGIBIZ"` → non-ML job kind). See {@link vietcom}. */
    bankClass?: string;
}) => NxisasJobEntry;

/* ===================================================================
 *  Per-bank profiles — Path A allow-list only
 * ================================================================= */

/**
 * Shinhan(Vietnam) — `11704088`.
 *
 * <p>Legacy `trns_0001_007.ts:1949-1960`:
 * <ul>
 *   <li>SAME_BANK → `TRANSFER_INTERNAL_ML`</li>
 *   <li>NAPAS → `TRANSFER` (NOT `TRANSFER_ML` — Shinhan special)
 *       with a fixed Thu Thiem branch code + acceptName.</li>
 *   <li>`acctNumPWD` set on both paths (legacy note 38020#5: optional
 *       depending on user account, but always sent — bank tolerates
 *       blank).</li>
 * </ul>
 */
const shinhan: BankProfileBuilder = ({ draft, internal, remitDate }) => {
    const input: NxisasJobInput = {
        acctNum:        draft.source.acctNo,
        remitAcctNum:   draft.target.acctNo,
        remitAmt:       String(draft.amount),
        remitBankCode:  draft.target.napasBankCd ?? "",
        currency:       "VND",
        feePaymentType: draft.feeBearer === "A" ? "1" : "2",
        remitDate,
        transType:      internal ? "1" : "",
        transInfoYN:    "Y",
        memo:           draft.remarkForRecipient,
        acctNumPWD:     draft.acctPassword,
    };
    if (!internal) {
        // NAPAS leg attaches the fixed Thu Thiem branch + recipient name.
        // The branch code is a Shinhan internal routing field.
        input.remitBranchCode = "79616016";
        input.remitBranch     = "Shinhan bank - Thu Thiem Branch";
        input.acceptName      = draft.target.acctNickNm;
    }
    return {
        Job:   internal ? "TRANSFER_INTERNAL_ML" : "TRANSFER",
        Input: input,
    };
};

/**
 * IBK(Vietnam) — `11704003`.
 *
 * <p>Legacy `trns_0001_007.ts:1939-1947`:
 * <ul>
 *   <li>SAME_BANK → `TRANSFER_INTERNAL`</li>
 *   <li>NAPAS → `TRANSFER`</li>
 *   <li>`acctNumPWD` always sent.</li>
 *   <li>Memo split: `memo` carries the sender remark
 *       (`REMARK_FOR_APPL`), `memo2` carries the recipient remark
 *       (`REMARK_FOR_BENF`).</li>
 * </ul>
 */
const ibk: BankProfileBuilder = ({ draft, internal, remitDate }) => {
    return {
        Job: internal ? "TRANSFER_INTERNAL" : "TRANSFER",
        Input: {
            acctNum:        draft.source.acctNo,
            remitAcctNum:   draft.target.acctNo,
            remitAmt:       String(draft.amount),
            remitBankCode:  draft.target.napasBankCd ?? "",
            currency:       "VND",
            feePaymentType: draft.feeBearer === "A" ? "1" : "2",
            remitDate,
            transType:      internal ? "1" : "",
            transInfoYN:    "Y",
            acctNumPWD:     draft.acctPassword,
            memo:           draft.remarkForSender,
            memo2:          draft.remarkForRecipient,
        },
    };
};

/**
 * Vietcom Bank — `11704004`.
 *
 * <p>Legacy `trns_0001_007.ts:1976-1984`:
 * <ul>
 *   <li>Default job: `TRANSFER_ML` / `TRANSFER_INTERNAL_ML`.</li>
 *   <li>DIGIBIZ-class accounts swap to `TRANSFER` / `TRANSFER_INTERNAL`.</li>
 * </ul>
 *
 * <p><b>DIGIBIZ job switch (legacy `trns_0001_007.ts:1976-1984`).</b>
 * Vietcom's default jobs are `TRANSFER_ML` / `TRANSFER_INTERNAL_ML`;
 * when the source account's NXiSAS module `CLASS == "DIGIBIZ"` the
 * legacy code swaps to the non-ML `TRANSFER` / `TRANSFER_INTERNAL`
 * variants. The composer threads the class through `bankClass`
 * (resolved from `BANK_NXISAS_PROFILES` in `jexjs-adapter.ts`, the
 * static stand-in for the deferred runtime `getModuleInfo` call). The
 * static map currently reports Vietcom as `CORPORATE`, so the ML path
 * is taken today — but the branch is now wired, so the moment a
 * DIGIBIZ class is surfaced (static-map flip or restored runtime
 * lookup) the correct non-ML job dispatches without any further change
 * here.
 *
 * <p>Vietcom NAPAS sets `transType` to empty string explicitly (legacy
 * `_v001.ts:2055`).
 */
const vietcom: BankProfileBuilder = ({ draft, internal, remitDate, bankClass }) => {
    const isDigibiz = bankClass === "DIGIBIZ";
    const job: NxisasJobKind = isDigibiz
        ? (internal ? "TRANSFER_INTERNAL" : "TRANSFER")
        : (internal ? "TRANSFER_INTERNAL_ML" : "TRANSFER_ML");
    return {
        Job: job,
        Input: {
            acctNum:        draft.source.acctNo,
            remitAcctNum:   draft.target.acctNo,
            remitAmt:       String(draft.amount),
            remitBankCode:  draft.target.napasBankCd ?? "",
            currency:       "VND",
            feePaymentType: draft.feeBearer === "A" ? "1" : "2",
            remitDate,
            transType:      internal ? "1" : "",
            transInfoYN:    "Y",
            memo:           draft.remarkForRecipient,
        },
    };
};

/**
 * Vietin Bank — `11704001`.
 *
 * <p>Legacy `trns_0001_007.ts:2001-2014, 2076-2080, 2104-2115`:
 * <ul>
 *   <li>SAME_BANK → `TRANSFER_INTERNAL_ML`, with these post-tweaks:
 *       `feePaymentType` set to "2" + `transType` DELETED +
 *       `remitBankCode` set to empty string.</li>
 *   <li>NAPAS → `TRANSFER_ML`, with `feePaymentType` DELETED entirely
 *       (Vietin engine resolves fee from the bank's IB UI at scrape
 *       time).</li>
 *   <li>Memo: `memo` carries the sender remark; `memo2` deliberately
 *       NOT set (legacy line 2013 comments it out).</li>
 *   <li>`acctNumPWD` deliberately NOT sent (legacy line 2010 comments
 *       it out — Vietin handles authentication inside the engine
 *       login step).</li>
 * </ul>
 */
const vietin: BankProfileBuilder = ({ draft, internal, remitDate }) => {
    const baseInput: NxisasJobInput = {
        acctNum:        draft.source.acctNo,
        remitAcctNum:   draft.target.acctNo,
        remitAmt:       String(draft.amount),
        remitBankCode:  draft.target.napasBankCd ?? "",
        currency:       "VND",
        feePaymentType: draft.feeBearer === "A" ? "1" : "2",
        remitDate,
        transType:      internal ? "1" : "",
        transInfoYN:    "Y",
        memo:           draft.remarkForSender,
    };
    if (internal) {
        // Same-bank Vietin: fixed fee="2", no transType, no remitBankCode.
        baseInput.feePaymentType = "2";
        baseInput.remitBankCode  = "";
        delete baseInput.transType;
        return { Job: "TRANSFER_INTERNAL_ML", Input: baseInput };
    }
    // NAPAS leg: drop fee — engine resolves at scrape time.
    delete baseInput.feePaymentType;
    return { Job: "TRANSFER_ML", Input: baseInput };
};

/**
 * Woori(Vietnam) — `11704020`.
 *
 * <p>Legacy `trns_0001_007.ts:1986-1999, 2063-2073, 2098-2102`:
 * <ul>
 *   <li>SAME_BANK → `TRANSFER_INTERNAL`. When the job is `TRANSFER`
 *       AND `transType=1` (legacy edge case), legacy sets empty
 *       branchCode / branch + acceptName; the refactor only enters
 *       SAME_BANK via the `internal` path so we always set the
 *       internal job kind directly.</li>
 *   <li>NAPAS → `TRANSFER` with `acctNumPWD` set, memo split into
 *       sender/recipient.</li>
 *   <li>`nonLogin: false` set at the org-obj level (legacy line 2099)
 *       — the composer's engine builder applies this.</li>
 * </ul>
 */
const woori: BankProfileBuilder = ({ draft, internal, remitDate }) => {
    return {
        Job: internal ? "TRANSFER_INTERNAL" : "TRANSFER",
        Input: {
            acctNum:        draft.source.acctNo,
            remitAcctNum:   draft.target.acctNo,
            remitAmt:       String(draft.amount),
            remitBankCode:  draft.target.napasBankCd ?? "",
            currency:       "VND",
            feePaymentType: draft.feeBearer === "A" ? "1" : "2",
            remitDate,
            transType:      internal ? "1" : "",
            transInfoYN:    "Y",
            acctNumPWD:     draft.acctPassword,
            memo:           draft.remarkForSender,
            memo2:          draft.remarkForRecipient,
        },
    };
};

/** Bank-code → profile builder. Lookup is by source-account
 *  `BANK_CD`; unknown banks fall through to a generic profile that
 *  produces a `TRANSFER_ML` job with the common fields only. */
export const BANK_PROFILE_BUILDERS: Record<string, BankProfileBuilder> = {
    "11704088": shinhan,
    "11704003": ibk,
    "11704004": vietcom,
    "11704001": vietin,
    "11704020": woori,
};

/** Generic fallback used when the source bank isn't in
 *  {@link BANK_PROFILE_BUILDERS}. Mirrors the most conservative legacy
 *  path: `TRANSFER_ML` / `TRANSFER_INTERNAL_ML` with the common
 *  fields only. The composer's allow-list should prevent this branch
 *  from firing in practice. */
const fallbackProfile: BankProfileBuilder = ({ draft, internal, remitDate }) => {
    return {
        Job: internal ? "TRANSFER_INTERNAL_ML" : "TRANSFER_ML",
        Input: {
            acctNum:        draft.source.acctNo,
            remitAcctNum:   draft.target.acctNo,
            remitAmt:       String(draft.amount),
            remitBankCode:  draft.target.napasBankCd ?? "",
            currency:       "VND",
            feePaymentType: draft.feeBearer === "A" ? "1" : "2",
            remitDate,
            transType:      internal ? "1" : "",
            transInfoYN:    "Y",
            memo:           draft.remarkForRecipient,
        },
    };
};

/**
 * Resolve the bank profile builder for a given source-bank code.
 * Returns the fallback when the bank isn't in the allow-list table.
 */
export function getBankProfileBuilder(sourceBankCd: string): BankProfileBuilder {
    return BANK_PROFILE_BUILDERS[sourceBankCd] ?? fallbackProfile;
}

/**
 * Build the full {@link NxisasOrgObj} payload the engine consumes.
 * Composer calls this just before invoking
 * {@code _v2nxisas.callNxisas([orgObj], ...)}. The cert fields
 * (`certInfoCon`, `loginID`, `loginPWD`, `nxisasGbSeqNo`) come from
 * the engine's own `getCertInfo(bank_cert_seq)` lookup which the
 * composer triggers at submit time; for now they ride as empty
 * strings — the engine raises a sensible error if a credential is
 * required and not provided, so the composer doesn't need to
 * pre-validate.
 */
export function buildNxisasOrgObj(args: {
    draft:    OwnAccountTransferDraft;
    internal: boolean;
    remitDate: string;
    /** Source-bank NXiSAS module CLASS (legacy `getModuleInfo().CLASS`).
     *  Threaded to the per-bank builder; only Vietcom branches on it
     *  (`"DIGIBIZ"` → non-ML job). Resolve from `BANK_NXISAS_PROFILES`
     *  in `jexjs-adapter.ts` at the call site. */
    bankClass?: string;
    /**
     * Optional explicit cert override. Today the source row carries the
     * resolved cert via the backend join (see `mappers.ts`), so the
     * builder reads cert fields off `draft.source` by default and the
     * caller only needs to pass `cert` when forcing a different
     * cert (e.g. for a stacked credentials swap mid-flow). When BOTH
     * are present, `cert` wins per legacy precedence.
     */
    cert?: Partial<Pick<NxisasOrgObj, "certInfoCon" | "loginID" | "loginPWD" | "nxisasGbSeqNo" | "bankCertSeq">>;
}): NxisasOrgObj {
    const builder = getBankProfileBuilder(args.draft.source.bankCd);
    const jobEntry = builder({
        draft:    args.draft,
        internal: args.internal,
        remitDate: args.remitDate,
        bankClass: args.bankClass,
    });
    const src = args.draft.source;
    const obj: NxisasOrgObj = {
        bankCd:        src.bankCd,
        bankNm:        src.bankNm,
        // Cert fields — explicit `cert` override first, then the
        // source-row Phase B fields, then empty string. The engine
        // bundle reads these via `_v2nxisas.getCertInfo(bankCertSeq)`
        // internally if `bankCertSeq` is set; pre-populating them
        // skips that lookup and gives the bundle everything it needs
        // up front (matches legacy `trns_0001_007.ts:2017-2034`).
        certInfoCon:   args.cert?.certInfoCon   ?? src.certInfoCon   ?? "",
        bankCertSeq:   args.cert?.bankCertSeq   ?? src.bankCertSeq   ?? "",
        nxisasGbSeqNo: args.cert?.nxisasGbSeqNo ?? src.nxisasGbSeqNo ?? "",
        loginID:       args.cert?.loginID       ?? src.loginID       ?? "",
        loginPWD:      args.cert?.loginPWD      ?? src.loginPWD      ?? "",
        job:           [jobEntry],
        nonLogout:     true,
    };
    // Woori VN: legacy `trns_0001_007.ts:2099-2102` sets `nonLogin: false`.
    if (src.bankCd === "11704020") {
        obj.nonLogin = false;
    }
    return obj;
}

/* ===================================================================
 *  Per-bank REMARK byte-limits (legacy `loadDataReloadTrnsDetlINFO`
 *  `trns_0001_007.ts:1258-1316`)
 * ================================================================= */

/** Remark byte-limit quad for one bank — sender/recipient limits split
 *  by within-bank vs inter-bank (NAPAS) direction. Counted in UTF-8
 *  bytes (legacy `validateStringByTES`, `:1542-1544`), NOT JS chars —
 *  Vietnamese diacritics are 2–3 bytes so a sub-limit character count
 *  can still exceed the byte cap the bank IB site enforces. */
export type RemarkByteLimits = {
    withinSender:    number;
    withinRecipient: number;
    interSender:     number;
    interRecipient:  number;
};

/** Default limits for banks not in {@link REMARK_BYTE_LIMITS}
 *  (legacy `:1260-1261` — 210/210 both directions). */
const DEFAULT_REMARK_LIMITS: RemarkByteLimits = {
    withinSender: 210, withinRecipient: 210, interSender: 210, interRecipient: 210,
};

/**
 * Per-bank remark byte-limit table — verbatim from the legacy
 * business-rules matrix (`own-account-transfer-legacy-bank-business-rules.md`
 * §6 D, sourced from `trns_0001_007.ts:1258-1316`).
 *
 * <table>
 *   <tr><th>bank</th><th>within S/R</th><th>inter S/R</th></tr>
 *   <tr><td>Vietcom 11704004</td><td>195 / 195</td><td>180 / 180</td></tr>
 *   <tr><td>Shinhan 11704088</td><td>200 / 200</td><td>200 / 200</td></tr>
 *   <tr><td>IBK     11704003</td><td>35 / 200</td><td>35 / 200</td></tr>
 *   <tr><td>Woori   11704020</td><td>100 / 210</td><td>100 / 210</td></tr>
 *   <tr><td>VIETIN  11704001</td><td>210 / 210</td><td>210 / 210</td></tr>
 * </table>
 */
export const REMARK_BYTE_LIMITS: Readonly<Record<string, RemarkByteLimits>> = {
    "11704004": { withinSender: 195, withinRecipient: 195, interSender: 180, interRecipient: 180 }, // Vietcom
    "11704088": { withinSender: 200, withinRecipient: 200, interSender: 200, interRecipient: 200 }, // Shinhan
    "11704003": { withinSender: 35,  withinRecipient: 200, interSender: 35,  interRecipient: 200 }, // IBK
    "11704020": { withinSender: 100, withinRecipient: 210, interSender: 100, interRecipient: 210 }, // Woori
    "11704001": { withinSender: 210, withinRecipient: 210, interSender: 210, interRecipient: 210 }, // VIETIN
};

/**
 * Resolve the sender + recipient remark byte-limits for a source bank
 * and a direction. {@code internal === true} → within-bank (sender
 * bank === recipient bank); {@code false} → inter-bank (NAPAS).
 */
export function getRemarkByteLimits(
    sourceBankCd: string,
    internal: boolean,
): { sender: number; recipient: number } {
    const q = REMARK_BYTE_LIMITS[sourceBankCd] ?? DEFAULT_REMARK_LIMITS;
    return internal
        ? { sender: q.withinSender, recipient: q.withinRecipient }
        : { sender: q.interSender,  recipient: q.interRecipient };
}

/* ===================================================================
 *  Per-bank FEE-radio policy (legacy `:593-601`, `:1474-1532` +
 *  business-rules §6 C / §8 UI matrix)
 * ================================================================= */

/**
 * Fee-radio policy for one bank.
 *
 * <ul>
 *   <li>{@code mode: "editable"} — user picks Sender/Recipient (Vietcom,
 *       Shinhan, VIETIN — §8 "usable" columns).</li>
 *   <li>{@code mode: "forced"} — radios disabled, value pinned to
 *       {@code forcedBearer}. IBK forces "Sender pays" label but the
 *       legacy key is `N`/val `2` (= recipient-pays value, our `"B"`,
 *       `:593-601`); Woori disables both options (no/no in §8) and
 *       defaults to Sender (`"A"`).</li>
 *   <li>{@code useFeeYn} — legacy `trns_detl_use_fee_yn`: only Vietcom
 *       keeps `"Y"` (fee meaningfully used); the rest are `"N"`.
 *       VIETIN's ML-payload `feePaymentType` delete is still handled in
 *       the {@link vietin} builder.</li>
 * </ul>
 */
export type FeePolicy = {
    mode:         "editable" | "forced";
    forcedBearer?: "A" | "B";
    useFeeYn:     "Y" | "N";
};

const DEFAULT_FEE_POLICY: FeePolicy = { mode: "editable", useFeeYn: "N" };

export const FEE_POLICIES: Readonly<Record<string, FeePolicy>> = {
    "11704004": { mode: "editable", useFeeYn: "Y" },                       // Vietcom — active fee
    "11704088": { mode: "editable", useFeeYn: "N" },                       // Shinhan — radios usable, feeYN=N
    "11704001": { mode: "editable", useFeeYn: "N" },                       // VIETIN — radios usable, ML deletes fee
    "11704003": { mode: "forced", forcedBearer: "B", useFeeYn: "N" },      // IBK — forced key N/val 2
    "11704020": { mode: "forced", forcedBearer: "A", useFeeYn: "N" },      // Woori — both disabled, default Sender
};

export function getFeePolicy(sourceBankCd: string): FeePolicy {
    return FEE_POLICIES[sourceBankCd] ?? DEFAULT_FEE_POLICY;
}

/* ===================================================================
 *  Per-bank REMARK UI policy (legacy `module`/`module2-4` —
 *  business-rules §6 C "Remarks", legacy `trns_0001_007.ts:486-491,
 *  558-576`)
 * ================================================================= */

/**
 * Per-bank remark-row policy. The legacy screen ALWAYS renders BOTH
 * rows — "Remarks (for sender)" and "Remarks (for recipient)" — for
 * every bank; the difference is only whether the recipient row is
 * editable.
 *
 * <ul>
 *   <li>Legacy `module` / `module4` banks (Vietcom, Shinhan, VIETIN):
 *       the recipient row is rendered but <b>disabled / read-only</b>
 *       (gray). The single remark the engine receives is the sender
 *       row's value (the editable, fee-tied field in the default
 *       "Sender pays" state — `trns_0001_007.ts:558-567`).</li>
 *   <li>Legacy `module2` / `module3` banks (IBK, Woori): BOTH rows are
 *       editable, independent applicant/beneficiary remarks
 *       (`.remark_for_appl` / `.remark_for_benf`).</li>
 * </ul>
 *
 * <p><b>Why not hide the recipient row:</b> the legacy JSP keeps the
 * recipient textarea in the DOM (disabled), so the refactor must too —
 * an earlier refactor that hid it for "single" banks diverged from the
 * legacy screenshots. This policy restores the legacy shape.
 *
 * <p><b>Byte limits are NOT in this policy</b> — they are direction-
 * aware (within-bank vs NAPAS) and live in {@link REMARK_BYTE_LIMITS} /
 * {@link getRemarkByteLimits}, the single source of truth.
 *
 * <p><b>`senderDefaultCompanyName` / `recipientDefaultCompanyName`:</b>
 * legacy `:568-572` auto-fills an empty remark with the company name
 * for Vietcom + Shinhan ONLY. The IBK appl/benf company-name default is
 * commented out in legacy (Redmine #42095), so IBK + Woori are `false`.
 * The "If not entered, the company name will be displayed." placeholder
 * is shown on every <i>enabled</i> field regardless (it is UI copy, not
 * the auto-fill switch).
 */
export type RemarkUiPolicy = {
    /** Always true — the sender row is rendered for every bank. */
    senderVisible:    true;
    senderEnabled:    boolean;
    senderRequired:   boolean;
    /** Always true — the recipient row is rendered for every bank
     *  (disabled for module/module4 banks, never hidden). */
    recipientVisible: true;
    recipientEnabled: boolean;
    recipientRequired: boolean;
    senderDefaultCompanyName:    boolean;
    recipientDefaultCompanyName: boolean;
};

/** Default = module-style single remark (sender editable + required,
 *  recipient disabled), matching the legacy `default` branch. */
const DEFAULT_REMARK_UI_POLICY: RemarkUiPolicy = {
    senderVisible: true, senderEnabled: true, senderRequired: true,
    recipientVisible: true, recipientEnabled: false, recipientRequired: false,
    senderDefaultCompanyName: false, recipientDefaultCompanyName: false,
};

export const REMARK_UI_POLICIES: Readonly<Record<string, RemarkUiPolicy>> = {
    // Vietcom — sender required + company-name default; recipient disabled.
    "11704004": {
        senderVisible: true, senderEnabled: true, senderRequired: true,
        recipientVisible: true, recipientEnabled: false, recipientRequired: false,
        senderDefaultCompanyName: true, recipientDefaultCompanyName: false,
    },
    // Shinhan — sender required + company-name default; recipient disabled.
    "11704088": {
        senderVisible: true, senderEnabled: true, senderRequired: true,
        recipientVisible: true, recipientEnabled: false, recipientRequired: false,
        senderDefaultCompanyName: true, recipientDefaultCompanyName: false,
    },
    // VIETIN — sender required; recipient disabled; NO company-name
    // default (legacy `:568-572` covers only Vietcom + Shinhan).
    "11704001": {
        senderVisible: true, senderEnabled: true, senderRequired: true,
        recipientVisible: true, recipientEnabled: false, recipientRequired: false,
        senderDefaultCompanyName: false, recipientDefaultCompanyName: false,
    },
    // Woori — both editable, neither required, no company-name default.
    "11704020": {
        senderVisible: true, senderEnabled: true, senderRequired: false,
        recipientVisible: true, recipientEnabled: true, recipientRequired: false,
        senderDefaultCompanyName: false, recipientDefaultCompanyName: false,
    },
    // IBK — both editable, neither required, no company-name default
    // (legacy IBK appl/benf default is commented out, Redmine #42095).
    "11704003": {
        senderVisible: true, senderEnabled: true, senderRequired: false,
        recipientVisible: true, recipientEnabled: true, recipientRequired: false,
        senderDefaultCompanyName: false, recipientDefaultCompanyName: false,
    },
};

export function getRemarkUiPolicy(sourceBankCd: string): RemarkUiPolicy {
    return REMARK_UI_POLICIES[sourceBankCd] ?? DEFAULT_REMARK_UI_POLICY;
}
