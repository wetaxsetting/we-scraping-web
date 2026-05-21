/**
 * Canonical per-row result-status mapper for Payment Result detail pages.
 *
 * Mirrors the legacy mapping shared by every Payment Result Detail page
 * — see `pymn_0002_002.ts:347-356`, `pymn_0004_002.ts:339-352`,
 * `pymn_0006_002.ts:383-399`, and `pymn_0010_002.ts:342-355`. All four
 * legacy TS files apply the SAME predicate over `PROC_STAT` + `RS_CD`:
 *
 *   PROC_STAT = "0" AND RS_CD = "0000"                        → Success
 *   PROC_STAT IN ("9", "1", "6")                              → In Progress
 *   PROC_STAT = "3" OR (PROC_STAT = "0" AND RS_CD != "0000")  → Failed
 *   PROC_STAT = ""                                            → Failed (legacy)
 *
 * Legacy's empty-PROC_STAT → Failed branch is valid because the legacy
 * Result list query filters `sps.trnf_yn = 'Y'` (see
 * `pymn_0006_002_r001_act.jsp:41-42`) — every visible batch has been
 * dispatched, so a missing PROC_STAT genuinely means a failed dispatch.
 *
 * Two refactor-specific divergences from that strict legacy form:
 *
 * 1. **Pre-dispatched batches.** Our list query does NOT filter on
 *    `trnf_yn`, so users can open a batch that's still in DRAFT. Their
 *    rows render "pending" (refactor extension — legacy doesn't reach
 *    this branch).
 * 2. **Phase B null-result data.** The backend ships `proc_stat = null`
 *    for every row until `TB_PAY_TARGET` / `TB_PAY_FILE_DATA` are joined.
 *    A literal port would mark every dispatched batch "Failed" — wrong
 *    until Phase B lands. We treat null `proc_stat` + null `rs_cd` on a
 *    dispatched batch as "pending" (results not yet loaded) instead.
 *    Once dispatch tables wire in, real null values become rare and the
 *    legacy "empty → Failed" semantic re-emerges via the empty-string
 *    branch.
 *
 * The server-resolved `proc_stat_key` is also honoured when present
 * (semantic suffix like `.success` / `.fail` / `.in_progress` / `.cancel`)
 * so the eventual Phase B i18n key path overrides this code-based logic.
 */

export type ResultStatusOutcome = "success" | "failed" | "pending" | "cancelled";

export type ResultLineForDerivation = {
    proc_stat:     string | null;
    proc_stat_key: string | null;
    rslt_dttm:     string | null;
    rs_cd:         string | null;
};

export function deriveResultStatus(
    line: ResultLineForDerivation,
    masterDispatched: boolean,
): ResultStatusOutcome {
    // Phase B forward-compat: when the backend ships a semantic i18n
    // key, prefer it over the raw code mapping below. The key carries
    // suffixes like `.success` / `.fail` / `.in_progress` / `.cancel`
    // — see `wecms-api` CLAUDE.md §"Domain enums".
    const key = (line.proc_stat_key ?? "").toLowerCase();
    if (key) {
        if (key.includes("success") || key.includes("complete")) return "success";
        if (key.includes("cancel")) return "cancelled";
        if (key.includes("pending") || key.includes("progress") || key.includes("wait"))
            return "pending";
        if (key.includes("fail") || key.includes("error") || key.includes("reject"))
            return "failed";
    }

    // Refactor extension #1: pre-dispatched batch → all rows pending.
    if (!masterDispatched) return "pending";

    const procStat = line.proc_stat ?? "";
    const rsCd     = line.rs_cd     ?? "";

    // Refactor extension #2: Phase B null-result data on a dispatched
    // batch reads as pending rather than Failed.
    if (procStat === "" && rsCd === "") return "pending";

    // Legacy mapping mirrored verbatim — see jsdoc table above.
    if (procStat === "0" && rsCd === "0000") return "success";
    if (procStat === "9" || procStat === "1" || procStat === "6") return "pending";
    if (procStat === "3") return "failed";
    if (procStat === "0" && rsCd !== "0000") return "failed";
    if (procStat === "") return "failed";
    return "failed";
}
