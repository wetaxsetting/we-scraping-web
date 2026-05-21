/**
 * Port of legacy
 * {@code WECMS DEV/WECMS_STATIC/web/nxisas/js/nxisas_api.js} —
 * specifically the {@code _v2nxisas} thread-state surface and the
 * per-thread console blocks emitted by
 * {@code run_afterLoginSuccess} / {@code run_afterLoginFail}
 * (lines 1960-2020 / 2003-2080 of the legacy file).
 *
 * <h2>Why this file exists in the refactor</h2>
 *
 * <p>In legacy, Coocon scraping runs <strong>in the browser</strong>
 * via the Coocon JS SDK ({@code CooconiSASNX}); {@code _v2nxisas}
 * orchestrates threads, tracks per-thread state, and fires the
 * {@code Thread (i)} / {@code tranList Result(Unit)} console blocks
 * as each thread finishes login. The refactor pushes Coocon
 * orchestration server-side, so there's no real per-thread async
 * loop in the browser anymore — but we still emit the same console
 * shape from the response so the debugging signal matches legacy.
 *
 * <h2>What's cloned vs. what's not</h2>
 *
 * <p>Cloned: the {@code _v2nxisas.*} state fields the per-thread
 * log block reads from (ThreadLength, _loginFinishCount,
 * _2ndCertList.length), and the exact dash-delimited
 * {@code ------------------ Thread (i) ------------------} format.
 *
 * <p>Not cloned: anything that drives Coocon (open / execute /
 * run_afterLogin* / makeLoginInput / makeJobInput) — those belong
 * to the backend's {@code NxisasGatewayClient}. The 2nd-cert
 * prompts (OTP / Captcha / QnA mid-scrape) are also not cloned
 * because the refactor surfaces challenges via the Add Card flow's
 * scrape-session loop, not mid-update.
 */

import type { ApiSyncGroup } from "@/lib/types/api";
import type { NxisasDataObj } from "@/lib/nxisas/nxisas_cardTranList";

/**
 * Mirrors the legacy {@code _v2nxisas} singleton's thread-tracking
 * surface (legacy file lines 783-800). State is module-scoped so the
 * per-thread log helpers can read coherent values across the fan-out
 * loop without threading them through every call.
 *
 * <p>Most fields here are write-once-per-update — {@code runUpdate}
 * resets them at the top of each call. We expose them publicly so a
 * future debug console or test harness can inspect them.
 */
export const _v2nxisas = {
    /** Cert-grouped {@code _nxisas_dataArray} for the current run
     *  (legacy line 784). Set by {@link beginRun}; read by
     *  {@link logThread} for the per-thread {@code orgObj} echo. */
    orgObj: [] as NxisasDataObj[],

    /** Number of scraping threads (= one per BANK_CERT_SEQ bucket).
     *  Legacy line 790. */
    ThreadLength: 0,

    /** Threads that have completed LOGIN (success OR failure). Legacy
     *  line 796 — incremented inside {@code run_afterLoginSuccess}
     *  and {@code run_afterLoginFail} after each per-thread response. */
    _loginFinishCount: 0,

    /** Threads requiring 2nd-cert pumping (OTP / Captcha / QnA).
     *  Legacy line 787. The refactor never pumps challenges
     *  mid-update — challenges surface as
     *  {@code WBE_CARD_SYNC_NEEDS_RE_AUTH} per card on the
     *  response, so this stays at 0 for the parity log. */
    _2ndCertList: [] as unknown[],

    /** Total finished-scrape thread count (login + jobs done).
     *  Legacy line 786. The refactor's response is atomic per-cert,
     *  so this advances in lockstep with {@code _loginFinishCount}. */
    _finishedCount: 0,
};

/**
 * Reset the {@link _v2nxisas} state at the start of an Update run.
 * Mirrors the top of legacy {@code _v2nxisas.callNxisas}
 * (nxisas_api.js:1637-1665).
 */
export function beginRun(orgObj: NxisasDataObj[]): void {
    _v2nxisas.orgObj            = orgObj;
    _v2nxisas.ThreadLength      = orgObj.length;
    _v2nxisas._loginFinishCount = 0;
    _v2nxisas._2ndCertList      = [];
    _v2nxisas._finishedCount    = 0;
}

/**
 * Emit the per-thread {@code ------------------ Thread (i) ------------------}
 * console block + {@code tranList Result(Unit)} block. Byte-for-byte
 * mirror of the legacy logs at
 * {@code nxisas_api.js:1969-1974, 2014-2019} +
 * {@code nxisas_cardTranList.ts:272-274}.
 *
 * <p>Call once per cert / thread in the order legacy would have
 * fired them (one per Coocon thread, in the order they finished
 * LOGIN). The refactor walks {@code response.groups[]} for this —
 * each {@link ApiSyncGroup} maps to one legacy thread.
 *
 * @param seq          Thread index (0-based), matching legacy
 *                     {@code seq} param.
 * @param group        Backend per-cert breakdown from the
 *                     {@code /sync} response.
 * @param orgEntry     The matching {@code orgObj} entry for this
 *                     cert — used for the {@code tranList Result(Unit)}
 *                     echo which legacy logs in cert-input shape
 *                     ({@code bankCd}, {@code bankNm},
 *                     {@code bankCertSeq}, {@code acctType},
 *                     {@code nxisasGbSeqNo}).
 */
export function logThread(
    seq: number,
    group: ApiSyncGroup,
    orgEntry: NxisasDataObj | undefined,
): void {
    _v2nxisas._loginFinishCount += 1;
    _v2nxisas._finishedCount    += 1;

    // ── Thread (i) block — legacy nxisas_api.js:1969-1974 ──
    console.log("------------------ Thread (" + seq + ") ------------------");
    console.log("_v2nxisas.ThreadLength : "      + _v2nxisas.ThreadLength);
    console.log("_v2nxisas._loginFinishCount : " + _v2nxisas._loginFinishCount);
    console.log("_v2nxisas._2ndCertList.length : " + _v2nxisas._2ndCertList.length);
    console.log("----------------------------------------------------------");

    // ── tranList Result(Unit) block — legacy
    //    nxisas_cardTranList.ts:272-274 / nxisas_api.js:1990-1992
    //    (unit_callback fires per thread with `orgObj[seq]`). The
    //    legacy log shape is the cert-input shape (camelCase keys
    //    bankCd / bankNm / bankCertSeq / acctType / nxisasGbSeqNo);
    //    refactor enriches with backend-resolved login_ok + per-card
    //    outcomes so the block is strictly more informative.
    console.log("---------------------------- tranList Result(Unit) ----------------------------");
    console.log({
        bankCd:        orgEntry?.bankCd        ?? group.bank_cd,
        bankNm:        orgEntry?.bankNm        ?? group.bank_nm,
        bankCertSeq:   orgEntry?.bankCertSeq   ?? group.bank_cert_seq,
        acctType:      orgEntry?.acctType      ?? undefined,
        nxisasGbSeqNo: null,    // legacy logs null when unset (refactor doesn't surface it server-side)
        login_ok:      group.login_ok,
        login_error:   group.login_error_code,
        cards:         group.cards,
    });
    console.log("---------------------------- tranList Result(Unit) ----------------------------");
}

/**
 * Fan-out: emit the per-thread block for every cert in the response,
 * in the same order legacy would have logged them. Used by
 * {@link nxisas_cardTranList.runUpdate} after the {@code /sync}
 * call resolves.
 */
export function logAllThreads(
    orgObj: NxisasDataObj[],
    groups: readonly ApiSyncGroup[] | undefined | null,
): void {
    if (!groups || groups.length === 0) return;
    // Index the orgObj by bank_cert_seq so each group maps to its
    // input entry deterministically. Falls back to the group's own
    // bank fields when no match (e.g. backend returned a cert the
    // frontend didn't pre-build for — shouldn't happen but we don't
    // want the log to crash if it does).
    const byCertSeq = new Map<string, NxisasDataObj>();
    for (const o of orgObj) byCertSeq.set(String(o.bankCertSeq), o);

    groups.forEach((g, i) => {
        const orgEntry = byCertSeq.get(String(g.bank_cert_seq));
        logThread(i, g, orgEntry);
    });
}
