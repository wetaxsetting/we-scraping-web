/**
 * Firm Banking History panel — Settings popup submenu (Figma 9198:11718).
 *
 * Static UI types for the inquiry history list. The panel renders one row
 * per service call (펌뱅킹 transactions, Vietnam Business Inquiry, Vietnam
 * GDT Inquiry) with the originating bank/institution code and the result
 * of that call. Backend wiring lands later.
 */

export type FirmBankingResult = "failed" | "in_progress" | "success";

export type FirmBankingServiceType =
    | "firm_banking_transaction"
    | "scraping_transfer"
    | "vietnam_business_inquiry"
    | "vietnam_gdt_inquiry";

export type FirmBankingHistoryRow = {
    id: string;
    /**
     * Raw `tarn_dtm` wire timestamp (`YYYYMMDDHHmmss`). This value is
     * **already in Vietnam local wall-clock for every leg** — the view
     * (`FirmBankingHistoryView`) normalizes each leg to VN: the F leg via
     * `kr_to_vn_time(TRAN_DT || TRAN_TM)` (KR→VN), and the S/G/B legs by
     * converting their UTC-stored `REG_DTM` UTC→VN. The panel therefore
     * formats it at render time via `formatLocalDtmByLanguage` with
     * **no timezone shift** — a shift here would double-count the offset
     * the view already applied.
     */
    tarnDtm: string;
    serviceType: FirmBankingServiceType;
    /** Raw service name from the wire ({@code svc_nm}). For F-leg this
     *  is the {@code TRAN_TP} numeric code ({@code "201"} / etc.); for
     *  S / G / B legs the V60 view emits an English literal. **Display
     *  via {@link #serviceNameKey}** — fall back to this raw value only
     *  when the key is null (unknown code path). */
    serviceName: string;
    /** i18n key under the {@code fb_history.service.*} namespace,
     *  resolved server-side from {@code (svc_type, svc_nm)} via the
     *  Spring {@code FirmBankingServiceNameResolver}. {@code null}
     *  signals "no localised label registered" — render
     *  {@code serviceName} verbatim. The frontend MUST NOT hold its
     *  own service-code map; the legacy {@code SERVICE_NAME_MAP} JS
     *  object is retired in favour of this server-driven key. */
    serviceNameKey: string | null;
    seqNo: string;
    /** Deposit bank or institution code (e.g. SHIN1231928200G1). */
    instCode: string;
    result: FirmBankingResult;
    /** Raw result code from the source leg — used by the detail popover.
     *  F leg: 4-char `RS_CD`; NAPAS: `TRNS_STTS`; NXISAS: `NXISAS_ERR_CODE`;
     *  EXT_TRAN: `RSLT_CD`. Empty / null when the source row has no code yet. */
    rsltCd: string;
    /** Raw result message — F leg sends `RS_CD` again (frontend resolves
     *  via DICTIONARY_VAN); other legs carry free-text. */
    rsltMsg: string;
    /** Per-leg job identifier used by the detail popover —
     *  `TRAN_TP` (F) / `"TRANSFER"` / `BALANCE` / `TRANSACTION` /
     *  `CARD_USING` (S) / `NXISAS_JOB` (G/B). */
    job: string;
    /** Original request payload — only G/B legs populate. JSON string the
     *  detail popover parses for the e-Invoice No. (G) or Tax ID (B). */
    reqData: string | null;
    /** VAN organization code — F leg only; null otherwise. */
    vanOrgCd: string | null;
};
