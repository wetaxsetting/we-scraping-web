/**
 * Zalo OA panel — Settings popup submenu.
 *
 * Static-UI types for connecting a Zalo Official Account to the signed-in
 * company and recording the Zalo-approved message templates it may send.
 * Backend wiring lands later; these shapes mirror the `wecms-api` entities
 * added in the V254 migration so the mock rows can be swapped for real API
 * data without reshaping the panel:
 *
 *   ZALO_OA_INFM    → {@link ZaloOaRow}
 *   ZALO_TMPL_INFM  → {@link ZaloTemplateRow}
 *   ZALO_SEND_HIS   → {@link ZaloSendHistoryRow}
 *
 * Field names are camelCase here per the three-layer rule — the snake_case
 * wire shape is translated once, in `lib/api/zaloOa.ts`, when that module
 * lands alongside the backend controller.
 */

/**
 * Message-type code, matching the backend `ZaloTemplateType` enum.
 *
 * **Provisional.** The WeCMS message catalogue is not decided yet — which
 * WeCMS events warrant a Zalo message, and who receives them, is an open
 * product question. These two codes carry over the shape of the WeBill365
 * reference implementation so the panel can be built; expect them to be
 * renamed or extended.
 */
export type ZaloTemplateType = "NOTICE" | "RECEIPT";

/** Locales a template can be registered for, matching backend `LangCd`. */
export type ZaloTemplateLang = "VI" | "EN" | "KO" | "KM";

/**
 * One Zalo-approved template bound to an Official Account.
 *
 * Templates cannot be created from WeCMS: each is drafted in the Zalo Business
 * console and manually approved by Zalo, which then issues {@link templateId}.
 * This row only records that id.
 *
 * `(type, lang)` is unique per Official Account — it is part of the primary key
 * on the backend, so the send path resolves a template exactly rather than
 * guessing when several languages are registered.
 */
export type ZaloTemplateRow = {
    type: ZaloTemplateType;
    lang: ZaloTemplateLang;
    /** Template id issued by Zalo on approval — a numeric string, e.g. "358731". */
    templateId: string;
    /**
     * Zalo's per-message charge, as a raw numeric string from the wire.
     * Format at render, never in the type. Null when not recorded.
     */
    unitPrice: string | null;
    /** `false` parks the template without deleting it — the send path skips it. */
    active: boolean;
};

/**
 * One Official Account connected by the current company.
 *
 * At most one row can have `active: true` — the backend enforces this with a
 * partial unique index, so activating one connection stands the others down in
 * the same transaction. The panel should reflect that as a radio-like choice,
 * not independent toggles.
 */
export type ZaloOaRow = {
    /** Zalo Official Account ID. Immutable once connected — it is half the
     *  primary key on the backend. */
    oaId: string;
    /** Display name shown in the list. Not used when sending. */
    oaName: string;
    /** `true` = outbound messages go through this OA. At most one per company. */
    active: boolean;
    /**
     * Whether the OAuth handshake has completed. A row exists from the moment
     * the user submits the OA id — the tokens only arrive after they approve in
     * the Zalo popup, so an unauthorised row is a normal intermediate state and
     * needs its own visual treatment.
     */
    authorized: boolean;
    /** Access-token expiry as a raw 14-char `yyyyMMddHHmmss` wire value, or
     *  null before the first successful token exchange. Format at render. */
    tokenExpiresAtRaw: string | null;
    /** Templates registered against this OA. Empty until an admin records them. */
    templates: ZaloTemplateRow[];
    /** Raw 14-char `REG_DTM` wire value — connection date. */
    registeredAtRaw: string;
};

/** Outcome bucket for a send-history row. */
export type ZaloSendResult = "success" | "failed";

/**
 * One outbound Zalo message attempt, written on both success and failure.
 *
 * WeBill365 populates the equivalent log but never surfaces it, so support has
 * no way to answer "did this recipient get the message?". The columns needed to
 * answer that are first-class here.
 */
export type ZaloSendHistoryRow = {
    id: string;
    /** Recipient phone in E.164 digits, exactly as sent to Zalo. */
    recipient: string;
    templateId: string;
    type: ZaloTemplateType | null;
    lang: ZaloTemplateLang | null;
    result: ZaloSendResult;
    /** Zalo's error code as text ("0" = success), or an HTTP status / local
     *  failure marker. Shown verbatim in the detail view. */
    resultCode: string;
    resultMessage: string;
    /** Raw 14-char `REQ_DTM` wire value. Format at render. */
    sentAtRaw: string;
};
