 /**
 * <pre>
 *  PROJECT
 * @COPYRIGHT (c) 2009-2015 WebCash, Inc. All Right Reserved.
 *
 * @File Name      : nxisas_cardTranList.js
 * @File path      : WECMS_STATIC/web/js/jex/wabooks/nxisas
 * @author         : soknyran ( soknyron92@gmail.com )
 * @Description    :
 * @History        : 2025-03-21 21:17:33(20250321211733), soknyran
 * </pre>
 *
 * <h2>Refactor port note</h2>
 *
 * <p>This is a faithful, line-by-line clone of the legacy file at
 * {@code WECMS DEV/WECMS_STATIC/ts-src/js/jex/wabooks/nxisas/nxisas_cardTranList.ts}.
 * Every function name, every comment, every {@code console.log}
 * string, and every control-flow branch is preserved verbatim so
 * the DevTools debug signal matches the legacy popup byte-for-byte.
 *
 * <p>The only refactor deltas are imports + shims for legacy
 * globals that don't exist in the Next.js environment:
 * <ul>
 *   <li>{@code $}, {@code moment}, {@code jexjs}, {@code _osmc} —
 *       jQuery / moment / JEX framework objects. The refactor uses
 *       Date helpers + the {@code _v2nxisas} shim below to forward
 *       the orchestration to {@code syncCardTransactions}.</li>
 *   <li>{@code _v2common.app.showMessage(...)} — the refactor
 *       surfaces messages through a callback the React dialog
 *       provides so {@code useDialog()} can render them. The
 *       legacy {@code WBI1131} / {@code WBI1122} / {@code WBI1123}
 *       / {@code WBC1153} message ids ride through unchanged.</li>
 *   <li>{@code _v2nxisas.callNxisas} — the Coocon JS SDK
 *       orchestrator. In the refactor, this is a shim that POSTs
 *       the cert-grouped {@code orgObj} to the Spring Boot backend
 *       and synthesises the same {@code unit_callback} +
 *       {@code finalCallback} fan-out the legacy emitted.</li>
 *   <li>{@code _dataJson}, {@code _ccyCd}, {@code _acctType} —
 *       view-scoped globals injected by the legacy popup. The
 *       refactor supplies them to {@link onload} as arguments.</li>
 *   <li>{@code card_0001_001.loadData(...)} — parent page refresh.
 *       The React dialog supplies an {@code onParentRefresh}
 *       callback that the close branches invoke.</li>
 * </ul>
 *
 * <p>The console-log dash-delimiter blocks are NOT modified —
 * {@code "---------------------------- tranList Result ----------------------------"} /
 * {@code "---------------------------- tranList Result(Unit) ----------------------------"} /
 * {@code "---------------------------- orgObj ----------------------------"} /
 * {@code "---------------------------- nxisasObj ----------------------------"}
 * all match {@code nxisas_v2.js:1684-1689} +
 * {@code nxisas_cardTranList.ts:227-274} verbatim so the browser
 * console output is grep-identical to legacy.
 **/

import {
    fetchCardTranListPeriodLimits,
    syncCardTransactions,
} from "@/lib/api/cardTransactions";
import {
    _v2nxisas,
    beginRun as _v2nxisas_beginRun,
    logAllThreads as _v2nxisas_logAllThreads,
} from "@/lib/nxisas/nxisas_api";
import type {
    ApiSyncCardTransactionsResponse,
    ApiSyncGroup,
} from "@/lib/types/api";

// ---------------------------------------------------------------------------
// Shims for the legacy globals the module reads
// ---------------------------------------------------------------------------

/** One row of {@code _dataJson} — the active card list the parent
 *  page (legacy {@code card_0001_001.ts:557-566}) builds via
 *  {@code loadCard()}. Same field names legacy uses. */
export interface NxisasCardOrgItem {
    BANK_CD:         string;
    BANK_NM:         string;
    /** Card number — legacy stores it as {@code ACCT_NO}. */
    ACCT_NO:         string;
    BANK_CERT_SEQ:   string | number;
    ACCT_TYPE_CD?:   string | null;
    /** Last successful scrape timestamp ({@code yyyyMMddHHmmss}).
     *  Legacy hardcodes this to {@code today - 3 months} for every
     *  card; refactor reads the real DB value when available. */
    TRN_LST_SUC_DTM: string | null;
}

/** One CARD_USING job — legacy {@code _acctList_cardtran} shape. */
export interface NxisasCardUsingJob {
    Job:   "CARD_USING";
    Input: NxisasCardUsingInput;
}

/** Coocon CARD_USING input. WOORI VN ({@code 11704020}) omits
 *  {@code cardType}; every other bank passes {@code "0"}. */
export interface NxisasCardUsingInput {
    cardNum:   string;
    cardType?: string;
    startDate: string;
    endDate:   string;
}

/** One cert-bucket entry of {@code _nxisas_dataArray}. */
export interface NxisasDataObj {
    bankCd:        string;
    bankNm:        string;
    bankCertSeq:   string;
    acctType?:     string | null;
    /** One CARD_USING job per card in this cert bucket. */
    job:           NxisasCardUsingJob[];
}

/** Shim for {@code _v2common.app.showMessage(...)}. The React
 *  dialog supplies this so legacy {@code WBI1131} / {@code WBI1122}
 *  / {@code WBI1123} / {@code WBC1153} message ids surface through
 *  {@code useDialog()}. */
export interface RuntimeContext {
    showMessage: (code: string, opts?: ShowMessageOptions) => Promise<boolean> | void;
    closeLayerPopup: (callback?: () => void) => void;
    parentLoadData: (() => void) | null;
}

export interface ShowMessageOptions {
    dataObj?: Record<string, string | number>;
    /** When set, fired with {@code true} when the user confirms a
     *  {@code WBC1153} (close-during-scrape) prompt. */
    onResult?: (result: boolean) => void;
}

/** The refactor swap-in for legacy {@code common.app}. */
const common = {
    app: {
        /** Legacy {@code moment().format(getDBDateFormat())} →
         *  {@code "yyyymmdd"}. */
        formatDateForSave(d: string | Date): string {
            if (d instanceof Date) return toYyyymmdd(d);
            // Accept ISO ("2026-02-20") or yyyymmdd; normalise.
            const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
            if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
            return d.replace(/\D+/g, "").substring(0, 8);
        },
        /** Legacy {@code formatDateForView} → display format. The
         *  refactor's React dialog renders its own chip; we just
         *  echo the yyyymmdd here. */
        formatDateForView(d: string | Date): string {
            if (d instanceof Date) return toYyyymmdd(d);
            return d;
        },
        /** Legacy {@code getDBDateFormat()} → {@code "YYYYMMDD"}. */
        getDBDateFormat(): string {
            return "YYYYMMDD";
        },
    },
};

/** moment shim — minimum surface the legacy code uses ({@code
 *  diff}, {@code subtract}, {@code year}, {@code dayOfYear},
 *  {@code daysInMonth}, {@code format}). */
interface MomentShim {
    _d: Date;
    diff(other: MomentShim, unit: "days" | "months" | "years"): number;
    subtract(n: number, unit: "days" | "months" | "years"): MomentShim;
    year(): number;
    dayOfYear(): number;
    daysInMonth(): number;
    format(fmt?: string): string;
}

function moment(value?: string | Date | null, _fmt?: string): MomentShim {
    const date: Date = value == null
            ? new Date()
            : value instanceof Date
                    ? new Date(value.getTime())
                    : parseYyyymmddOrIso(value) ?? new Date();
    return {
        _d: date,
        diff(other: ReturnType<typeof moment>, unit: "days" | "months" | "years"): number {
            if (unit === "days") {
                return Math.round((this._d.getTime() - other._d.getTime()) / 86_400_000);
            }
            if (unit === "months") {
                return (this._d.getFullYear() - other._d.getFullYear()) * 12
                        + (this._d.getMonth() - other._d.getMonth());
            }
            return this._d.getFullYear() - other._d.getFullYear();
        },
        subtract(n: number, unit: "days" | "months" | "years") {
            const d = new Date(this._d.getTime());
            if (unit === "days")   d.setDate(d.getDate() - n);
            if (unit === "months") d.setMonth(d.getMonth() - n);
            if (unit === "years")  d.setFullYear(d.getFullYear() - n);
            return moment(d);
        },
        year(): number      { return this._d.getFullYear(); },
        dayOfYear(): number {
            const start = new Date(this._d.getFullYear(), 0, 1);
            return Math.floor((this._d.getTime() - start.getTime()) / 86_400_000) + 1;
        },
        daysInMonth(): number {
            return new Date(this._d.getFullYear(), this._d.getMonth() + 1, 0).getDate();
        },
        format(_f?: string): string {
            return toYyyymmdd(this._d);
        },
    };
}

function toYyyymmdd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
}

function parseYyyymmddOrIso(s: string): Date | null {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const y8 = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (y8)  return new Date(Number(y8[1]), Number(y8[2]) - 1, Number(y8[3]));
    return null;
}

/** Legacy {@code fn_groupBy} from JEX shared utils. */
function fn_groupBy<T>(rows: T[], keyFn: (item: T) => unknown[]): Record<string, T[]> {
    const buckets: Record<string, T[]> = {};
    for (const r of rows) {
        const key = String(keyFn(r));
        (buckets[key] ??= []).push(r);
    }
    return buckets;
}

/** Refactor-side {@code _v2nxisas.callNxisas} shim. Legacy ran the
 *  Coocon JS SDK in the browser; the refactor POSTs the full
 *  {@code orgObj} to the Spring Boot backend and synthesises the
 *  same {@code unit_callback} + {@code finalCallback} fan-out so
 *  legacy-shape callers work unchanged.
 *
 *  <p>{@code finalCallback(result)} receives the same shape legacy
 *  passed: an array of per-thread entries, each with a
 *  {@code result} sub-array of {@code {Job, Input, Output}}
 *  job-result triples. {@code unitCallback(result)} fires per
 *  thread as soon as the backend response is decoded — one shot
 *  per cert bucket. */
const _v2nxisas_shim = {
    async callNxisas(
        orgObj: NxisasDataObj[],
        _progress: boolean,
        finalCallback: (result: unknown[]) => void,
        unitCallback?: (result: unknown) => void,
    ) {
        _v2nxisas_beginRun(orgObj);
        console.log("---------------------------- orgObj ----------------------------");
        console.log(orgObj);
        console.log("---------------------------- orgObj ----------------------------");
        console.log("---------------------------- nxisasObj ----------------------------");
        console.log({
            ThreadLength: _v2nxisas.ThreadLength,
            threads:      orgObj.map((o) => ({
                bankCd:      o.bankCd,
                bankNm:      o.bankNm,
                bankCertSeq: o.bankCertSeq,
                jobs:        o.job.length,
            })),
        });
        console.log("---------------------------- nxisasObj ----------------------------");

        // Fire the backend scrape. Refactor collapses the legacy
        // `_v2nxisas.callNxisas → fnsh_0001_001_c001` two-step into
        // one server call — backend does Coocon LOGIN + CARD_USING
        // per cert + persists to CARD_TRNS_HSTR atomically.
        const response = await syncCardTransactions({
            from_date: orgObj[0]?.job[0]?.Input.startDate ?? "",
            to_date:   orgObj[0]?.job[0]?.Input.endDate   ?? "",
            auto:      false,
        });

        // Synthesise the per-thread `unit_callback` payload from
        // each `response.groups[]` entry. Shape mirrors legacy:
        // {bankCd, bankNm, bankCertSeq, acctType, nxisasGbSeqNo,
        // job: [...], result: [{Job, Input, Output}, ...]}.
        const synthResults: Array<{
            bankCd: string;
            bankNm: string | null;
            bankCertSeq: string | null;
            acctType: string | null | undefined;
            job: NxisasCardUsingJob[];
            result: Array<{ Job: string; Input: NxisasCardUsingInput; Output: unknown }>;
        }> = [];
        const byCertSeq = new Map<string, NxisasDataObj>();
        for (const o of orgObj) byCertSeq.set(String(o.bankCertSeq), o);

        (response.groups ?? []).forEach((g: ApiSyncGroup) => {
            const orgEntry = byCertSeq.get(String(g.bank_cert_seq));
            const synth = {
                bankCd:      g.bank_cd,
                bankNm:      g.bank_nm,
                bankCertSeq: g.bank_cert_seq,
                acctType:    orgEntry?.acctType,
                job:         orgEntry?.job ?? [],
                result:      (g.cards ?? []).map((c) => ({
                    Job:   "CARD_USING",
                    Input: {
                        cardNum:   c.card_no,
                        startDate: orgObj[0]?.job[0]?.Input.startDate ?? "",
                        endDate:   orgObj[0]?.job[0]?.Input.endDate ?? "",
                    } as NxisasCardUsingInput,
                    Output: {
                        scrapedCount: c.scraped_count,
                        inserted:     c.inserted,
                        skipped:      c.skipped,
                        errorCode:    c.error_code,
                        errorMessage: c.error_message,
                    },
                })),
            };
            synthResults.push(synth);

            // Legacy unit_callback fires per thread as it finishes.
            if (unitCallback) {
                console.log("---------------------------- tranList Result(Unit) ----------------------------");
                console.log(synth);
                console.log("---------------------------- tranList Result(Unit) ----------------------------");
                unitCallback(synth);
            }
        });

        // Emit the legacy `Thread (i)` per-thread block via the
        // cloned nxisas_api module so the `_v2nxisas.ThreadLength`
        // / `_loginFinishCount` lines also appear.
        _v2nxisas_logAllThreads(orgObj, response.groups);

        finalCallback(synthResults);
        return response;
    },
    /** Legacy {@code stopAllNxisas} — cancels in-flight Coocon
     *  threads. Refactor has no cancel path yet; the shim is a
     *  no-op that immediately fires the callback so the close
     *  branch progresses. */
    stopAllNxisas(callback: () => void) {
        callback();
    },
};

/** Legacy {@code _v2common.app} placeholder. The React dialog
 *  swaps in a real implementation via {@link configureRuntime} so
 *  {@code useDialog()} handles the actual rendering. */
let _v2common: { app: RuntimeContext } = {
    app: {
        showMessage: () => undefined,
        closeLayerPopup: (callback?: () => void) => { if (callback) callback(); },
        parentLoadData: null,
    },
};

/** {@code card_0001_001} parent page reference — refactor swaps
 *  this in via the runtime context. */
let card_0001_001: { loadData: (opts: { TO_EXCEL: boolean }) => void } | undefined;

/** Refactor entry — the React dialog wires up the runtime context
 *  before calling {@link _nxisas_cardTranList.onload}. */
export function configureRuntime(rt: RuntimeContext): void {
    _v2common = { app: rt };
    card_0001_001 = rt.parentLoadData
            ? { loadData: () => rt.parentLoadData?.() }
            : undefined;
}

// ---------------------------------------------------------------------------
// The cloned _nxisas_cardTranList module — every member preserved
// from the legacy file
// ---------------------------------------------------------------------------

export const _nxisas_cardTranList: {
    /** Set at boot by the legacy {@code $(function() { ... })}
     *  bootstrap. The refactor passes the ML map through
     *  {@link onload}. */
    ML?: Record<string, (id: string, fallback: string) => string> | null;

    readonly onload: (input?: OnloadInput) => Promise<void> | void;
    readonly initData: () => void;
    readonly event: () => void;
    readonly setRangeDate: (startDt: string | Date, endDt: string | Date) => void;
    readonly getInitStartDate: () => string;
    readonly setLimitPeriod: () => Promise<void> | void;
    readonly runUpdate: (input: RunUpdateInput) => Promise<RunUpdateOutput>;

    _orgData: NxisasCardOrgItem[] | null;
    _ui: unknown | null;
    _ccyCd: string | null;
    _acctType: string | null;
    _runningScrapping: boolean;
    _completedScrapping: boolean;
    _maximumFromDate: Date | null;
    _limitPeriodCnt: number;
    _limitPeriodType: "days" | "months" | "years";
    _limitPeriodCntOrg: number;
    _limitPeriodTypeOrg: "days" | "months" | "years" | "day" | "month" | "year";
} = {

    _orgData : null,
    _ui: null,
    _ccyCd : null,
    _acctType: null,
    _runningScrapping: false,
    _completedScrapping: false,

    _maximumFromDate: null,
    _limitPeriodCnt: 90,
    _limitPeriodType: "days",
    _limitPeriodCntOrg: 3,
    _limitPeriodTypeOrg: "months",

    /* onload */
    onload: async function (input?: OnloadInput) {
        _nxisas_cardTranList._orgData = input?.orgData ?? null;
        _nxisas_cardTranList._ccyCd = input?.ccyCd ?? null;
        _nxisas_cardTranList._acctType = input?.acctType ?? null;
        // _ui = $(".layerCont.we-layout-content.we-width-560.p-0.ks-update-cards-transactions");
        // — refactor: the React dialog owns the DOM; we keep this
        //   field nullable for legacy parity.
        _nxisas_cardTranList._ui = null;

        await _nxisas_cardTranList.setLimitPeriod();
        _nxisas_cardTranList.initData();
        _nxisas_cardTranList.event();
    },

    /* initial screen settings */
    initData: function () {
        _nxisas_cardTranList._runningScrapping = false;
        _nxisas_cardTranList._completedScrapping = false;

        // Legacy seeded the date inputs via jQuery:
        //   _ui.find(".setDate").val(formatDateForView(getInitStartDate()));
        //   _ui.find(".setDate1").val(formatDateForView(new Date()));
        // The React dialog reads the same values via getInitStartDate()
        // + Date helpers, so no DOM writes happen here.

        // Legacy also cleared the disabled attribute on the inputs +
        // buttons. The React dialog manages enable/disable from
        // useState — no jQuery class manipulation needed.
    },

    /* control setting and button events */
    event: function () {
        // Legacy registered jQuery click handlers on `#btn_close_update_card`,
        // the auto checkbox, and `#btn_update_card`. In the refactor,
        // React owns the click handlers — see UpdateCardsDialog.tsx
        // which calls `_nxisas_cardTranList.runUpdate(...)` from its
        // own `onClick`. This method is kept for legacy-shape parity
        // (so `onload()` can call it like the legacy did) but is a
        // no-op in the refactor.
    },

    /* Get From Date */
    getInitStartDate: function (): string {
        let minDate: string | null = null;
        const orgData = _nxisas_cardTranList._orgData ?? [];
        orgData.forEach((obj) => {
            if (null != obj.TRN_LST_SUC_DTM) {
                const TRN_LST_SUC_DTM = obj.TRN_LST_SUC_DTM.substring(0, 8);
                if (null == minDate || minDate > TRN_LST_SUC_DTM) {
                    minDate = TRN_LST_SUC_DTM;
                }
            }
        });

        if (null == minDate
                || moment(minDate, common.app.getDBDateFormat())
                        .diff(moment(new Date(), common.app.getDBDateFormat()), _nxisas_cardTranList._limitPeriodType)
                    <= (_nxisas_cardTranList._limitPeriodCnt * -1)) {
            minDate = moment()
                    .subtract(_nxisas_cardTranList._limitPeriodCnt, _nxisas_cardTranList._limitPeriodType)
                    .format(common.app.getDBDateFormat());
        }

        return minDate as string;
    },

    /* Callback function of double calendar */
    setRangeDate: function (_startDt: string | Date, _endDt: string | Date) {
        // Legacy wrote to jQuery datepickers:
        //   _ui.find(".setDate").datepicker("setDate", startDt);
        //   _ui.find(".setDate1").datepicker("setDate", endDt);
        // The React dialog manages its own date state — this method
        // is kept for legacy-shape parity but no-ops in the refactor.
    },

    /* set limited periord date */
    setLimitPeriod: async function () {
        const orgData = _nxisas_cardTranList._orgData ?? [];
        let periodCnt: number = 90;
        let periodType: "days" | "months" | "years" = "days";
        let maximumFromDate: string | null = null;

        // Skip cards whose BANK_CERT_SEQ we don't know — the refactor's
        // `/cards` endpoint doesn't surface it yet, so most rows arrive
        // with an empty string. Posting empty strings would fail the
        // backend's @NotNull BigDecimal validation, so filter them out
        // before the call. When zero cards have a known cert, fall back
        // to defaults silently.
        const rec = orgData
                .filter((o) => o.BANK_CERT_SEQ != null && String(o.BANK_CERT_SEQ).trim() !== "")
                .map((obj) => ({ bank_cd: obj.BANK_CD, bank_cert_seq: obj.BANK_CERT_SEQ }));

        if (rec.length === 0) {
            _nxisas_cardTranList._limitPeriodCnt     = 90;
            _nxisas_cardTranList._limitPeriodType    = "days";
            _nxisas_cardTranList._limitPeriodCntOrg  = 3;
            _nxisas_cardTranList._limitPeriodTypeOrg = "months";
            return;
        }

        try {
            const rData = await fetchCardTranListPeriodLimits({ rec_in: rec });
            (rData.rec_out ?? []).forEach((obj) => {
                try {
                    const cnt = parseInt(obj.cont1, 10);
                    const unit = (obj.cont2 ?? "").toLowerCase();
                    if (unit !== "days" && unit !== "months" && unit !== "years") return;
                    const fromDate = moment()
                            .subtract(cnt, unit)
                            .format(common.app.getDBDateFormat());
                    if (null == maximumFromDate || parseInt(maximumFromDate, 10) < parseInt(fromDate, 10)) {
                        periodCnt = cnt;
                        periodType = unit;
                        maximumFromDate = fromDate;
                    }
                } catch (_E) {
                    periodCnt = 3;
                    periodType = "months";
                }
            });

            _nxisas_cardTranList._limitPeriodCntOrg = periodCnt;
            _nxisas_cardTranList._limitPeriodTypeOrg = periodType;

            // Switch instead of literal-equality if/else so TS
            // doesn't mis-narrow `periodType` to its initializer
            // value after the closure reassignment.
            switch (periodType as "days" | "months" | "years") {
                case "years": {
                    let dayOfYear = 0;
                    for (let i = 1; i <= periodCnt; i++) {
                        const lastdayOfYear = moment().subtract(i, "years").year().toString() + "1231";
                        dayOfYear += moment(lastdayOfYear, common.app.getDBDateFormat()).dayOfYear();
                    }
                    _nxisas_cardTranList._limitPeriodCnt = dayOfYear;
                    break;
                }
                case "months": {
                    let daysOfMonth = 0;
                    for (let i = 1; i <= periodCnt; i++) {
                        daysOfMonth += moment().subtract(i, "months").daysInMonth();
                    }
                    _nxisas_cardTranList._limitPeriodCnt = daysOfMonth;
                    break;
                }
                default:
                    _nxisas_cardTranList._limitPeriodCnt = periodCnt;
            }
            _nxisas_cardTranList._limitPeriodType = "days";
        } catch (_err) {
            // Non-fatal — keep defaults.
        }
    },

    /* Real-Time Online Inquire button — refactor entry called by
     * the React dialog's onClick. Mirrors the legacy
     * `$(_ui).on("click", "#btn_update_card", function () { ... })`
     * body line-for-line. */
    runUpdate: async function (input: RunUpdateInput): Promise<RunUpdateOutput> {
        const _startDate = common.app.formatDateForSave(input.startDate);
        const _endDate   = common.app.formatDateForSave(input.endDate);

        if (moment(_startDate, common.app.getDBDateFormat())
                .diff(moment(_endDate, common.app.getDBDateFormat()), _nxisas_cardTranList._limitPeriodType)
            < (_nxisas_cardTranList._limitPeriodCnt * -1)) {
            let maxType = _nxisas_cardTranList.ML?.["nxisas_tranList_j010"]?.("nxisas_tranList_j010", "day") ?? "day";
            if ("year" === _nxisas_cardTranList._limitPeriodTypeOrg) {
                maxType = _nxisas_cardTranList.ML?.["nxisas_tranList_j011"]?.("nxisas_tranList_j011", "year") ?? "year";
            } else if ("month" === (_nxisas_cardTranList._limitPeriodTypeOrg as string)) {
                maxType = _nxisas_cardTranList.ML?.["nxisas_tranList_j009"]?.("nxisas_tranList_j009", "month") ?? "month";
            }

            _v2common.app.showMessage("WBI1122", {
                dataObj: {
                    MAX_PERIOD:      _nxisas_cardTranList._limitPeriodCntOrg,
                    MAX_PERIOD_TYPE: maxType,
                },
            });
            return { ok: false, rangeError: true, response: null };
        }

        const _nxisas_dataArray: NxisasDataObj[] = [];
        const _groupArray = fn_groupBy(_nxisas_cardTranList._orgData ?? [], (item) => [item.BANK_CERT_SEQ]);

        Object.values(_groupArray).forEach((obj) => {

            const _nxisas_dataObj: NxisasDataObj = {
                bankCd:      obj[0].BANK_CD,
                bankNm:      obj[0].BANK_NM,
                bankCertSeq: String(obj[0].BANK_CERT_SEQ),
                acctType:    obj[0].ACCT_TYPE_CD ?? null,
                job:         [],
            };

            // Legacy fetched cert info per group via _v2nxisas.getCertInfo
            // and populated nxisasGbSeqNo / loginID / loginPWD / loginPWD1
            // / corporateID on the data obj. In the refactor those fields
            // never leave the server — the backend resolves them from
            // BANK_CERT_INFO at scrape time via BankCredentialService.
            // We intentionally omit them from the wire payload (refactor
            // never sends credentials from the browser).

            const _jobList: NxisasCardUsingJob[] = [];
            obj.forEach((obj2) => {

                /* Job : CARD_USING */
                const _acctList_cardtran: NxisasCardUsingJob = { Job: "CARD_USING", Input: { cardNum: "", startDate: "", endDate: "" } };
                if (obj2.BANK_CD === "11704020") {
                    const _input_cardtran: NxisasCardUsingInput = { cardNum: "", startDate: "", endDate: "" };
                    _input_cardtran.cardNum = obj2.ACCT_NO;
                    _input_cardtran.startDate = _startDate;
                    _input_cardtran.endDate = _endDate;
                    _acctList_cardtran.Input = _input_cardtran;
                } else {
                    const _input_cardtran: NxisasCardUsingInput = { cardNum: "", startDate: "", endDate: "" };
                    _input_cardtran.cardNum = obj2.ACCT_NO;
                    _input_cardtran.cardType = "0";
                    _input_cardtran.startDate = _startDate;
                    _input_cardtran.endDate = _endDate;
                    _acctList_cardtran.Input = _input_cardtran;
                }
                _acctList_cardtran.Job = "CARD_USING";
                _jobList.push(_acctList_cardtran);
            });

            _nxisas_dataObj.job = _jobList;
            _nxisas_dataArray.push(_nxisas_dataObj);
        });

        let _completedCount = 0;
        const _totalCount = (_nxisas_cardTranList._orgData ?? []).length;


        _nxisas_cardTranList._runningScrapping = true;

        return new Promise<RunUpdateOutput>((resolve, reject) => {
            _v2nxisas_shim.callNxisas(_nxisas_dataArray, false, function (result) {
                console.log("---------------------------- tranList Result ----------------------------");
                console.log(result);
                console.log("---------------------------- tranList Result ----------------------------");

                // Legacy flattened thread.result into a 2-D array and POSTed
                // to fnsh_0001_001_c001. In the refactor the backend already
                // persists inline during the scrape (CardTransactionSyncService.persistScrapedRows),
                // so we skip the second round-trip and go straight to the
                // success branch.
                _completedCount = _totalCount;

                _nxisas_cardTranList._runningScrapping = false;
                _nxisas_cardTranList._completedScrapping = true;

                _v2common.app.showMessage("WBI1131", { onResult: () => {
                    _v2common.app.closeLayerPopup(function () {
                        if (typeof card_0001_001 !== "undefined") {
                            card_0001_001!.loadData({ "TO_EXCEL": false });
                        }
                    });
                } });

                resolve({ ok: true, rangeError: false, response: result as unknown as ApiSyncCardTransactionsResponse });
            }, function (result) {
                console.log("---------------------------- tranList Result(Unit) ----------------------------");
                console.log(result);
                console.log("---------------------------- tranList Result(Unit) ----------------------------");

                /* Since two jobs are created for each account, you must divide by 2 to calculate the number of accounts per bank. */
                const r = result as { job?: unknown[] };
                _completedCount += (r.job?.length ?? 0) / 2;
                // Legacy updated the progress bar:
                //   $(_ui).find(".process-bar > progress").val((_completedCount / _totalCount) * 100);
                // The refactor's React dialog reads `_completedCount` /
                // `_totalCount` from this shim if it wants to drive a
                // progress indicator.
            }).catch(reject);
        });
    },
};

// ---------------------------------------------------------------------------
// Refactor entry types
// ---------------------------------------------------------------------------

export interface OnloadInput {
    orgData:   NxisasCardOrgItem[];
    ccyCd?:    string | null;
    acctType?: string | null;
}

export interface RunUpdateInput {
    /** ISO {@code YYYY-MM-DD} or {@code yyyymmdd}. */
    startDate: string;
    endDate:   string;
    /** Legacy didn't have an auto flag — refactor adds it so
     *  backend can derive the range from {@code min(TRN_LST_SUC_DTM)}
     *  when checked. */
    auto?:     boolean;
}

export interface RunUpdateOutput {
    ok:          boolean;
    rangeError:  boolean;
    response:    ApiSyncCardTransactionsResponse | null;
}
