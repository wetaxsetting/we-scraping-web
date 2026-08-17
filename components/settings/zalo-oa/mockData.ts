/**
 * Static mock data for the Zalo OA settings panel.
 *
 * Frontend-owned per the workspace static-UI rule — the panel renders from
 * these rows until `lib/api/zaloOa.ts` and the backend controller land. Values
 * are shaped to exercise the states the panel has to handle, not to look tidy:
 *
 *   - one active, fully authorised OA with all four templates registered
 *   - one connected-but-not-yet-authorised OA (user closed the Zalo popup)
 *   - one inactive OA with templates registered for Vietnamese only
 *
 * The OA ids are fictional. Real ids are 18–19 digit numeric strings issued by
 * Zalo; nothing here should be pasted into a real console.
 */

import type { ZaloOaRow, ZaloSendHistoryRow } from "./types";

export const MOCK_ZALO_OA_ROWS: ZaloOaRow[] = [
    {
        oaId: "4180152938471000001",
        oaName: "WeCMS Vietnam",
        active: true,
        authorized: true,
        tokenExpiresAtRaw: "20260818093000",
        registeredAtRaw: "20260602141205",
        templates: [
            { type: "NOTICE", lang: "VI", templateId: "358731", unitPrice: "400", active: true },
            { type: "NOTICE", lang: "EN", templateId: "358742", unitPrice: "400", active: true },
            { type: "RECEIPT", lang: "VI", templateId: "350312", unitPrice: "300", active: true },
            { type: "RECEIPT", lang: "EN", templateId: "350318", unitPrice: "300", active: true },
        ],
    },
    {
        oaId: "4180152938471000002",
        oaName: "WeCMS Sandbox",
        active: false,
        authorized: false,
        tokenExpiresAtRaw: null,
        registeredAtRaw: "20260715102233",
        templates: [],
    },
    {
        oaId: "4180152938471000003",
        oaName: "Webcash VN — Kế toán",
        active: false,
        authorized: true,
        tokenExpiresAtRaw: "20260817235959",
        registeredAtRaw: "20260410085000",
        templates: [
            { type: "NOTICE", lang: "VI", templateId: "341880", unitPrice: "400", active: true },
            { type: "RECEIPT", lang: "VI", templateId: "341902", unitPrice: null, active: false },
        ],
    },
];

export const MOCK_ZALO_SEND_HISTORY: ZaloSendHistoryRow[] = [
    {
        id: "1",
        recipient: "84912345678",
        templateId: "358731",
        type: "NOTICE",
        lang: "VI",
        result: "success",
        resultCode: "0",
        resultMessage: "Success",
        sentAtRaw: "20260817091502",
    },
    {
        id: "2",
        recipient: "84987654321",
        templateId: "350312",
        type: "RECEIPT",
        lang: "VI",
        result: "success",
        resultCode: "0",
        resultMessage: "Success",
        sentAtRaw: "20260817090110",
    },
    {
        // The most common real failure: Zalo will not deliver a template
        // message to a number that has never interacted with the OA.
        id: "3",
        recipient: "84900111222",
        templateId: "358731",
        type: "NOTICE",
        lang: "VI",
        result: "failed",
        resultCode: "-118",
        resultMessage: "User is not allowed to receive message from this OA",
        sentAtRaw: "20260816164430",
    },
    {
        // Daily template quota — worth showing because the retry story differs.
        id: "4",
        recipient: "84933444555",
        templateId: "350312",
        type: "RECEIPT",
        lang: "EN",
        result: "failed",
        resultCode: "-124",
        resultMessage: "Exceed quota of template message per day",
        sentAtRaw: "20260816161207",
    },
];
