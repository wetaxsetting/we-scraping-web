import { describe, expect, it } from "vitest";

import { syncMessageText, syncResultNote } from "@/components/sync/syncMessage";

// Stand-in for useTranslation's t(): returns the key, so assertions show which text was chosen.
const t = (key: string) => `[${key}]`;

const ENGINE_NOTE =
    "Còn 10 HĐ chưa có XML: 8 HĐ Cục Thuế chưa có XML (HĐ mới cấp mã), hệ thống tự tải lại sau; " +
    "2 HĐ không mã gửi theo bảng tổng hợp — Cục Thuế không có XML, chờ XML từ email người bán.";

describe("syncResultNote — note under the sync dialog's result cards", () => {
    // Regression (2026-11-25, MST 0319232069): the dialog showed "38/58 · done" with no reason; the engine
    // now sends the reason in `message` and the dialog must show it.
    it("shows the engine's reason on a successful run that still lacks XML", () => {
        expect(syncResultNote({ status: "success", message: ENGINE_NOTE }, t)).toBe(ENGINE_NOTE);
    });

    it("prefers the engine's reason over the generic partial note", () => {
        expect(syncResultNote({ status: "partial", message: ENGINE_NOTE }, t)).toBe(ENGINE_NOTE);
    });

    it("falls back to the generic partial note when a partial run has no message", () => {
        expect(syncResultNote({ status: "partial", message: undefined }, t)).toBe("[sync.partial_note]");
    });

    it("shows nothing for a clean successful run", () => {
        expect(syncResultNote({ status: "success", message: undefined }, t)).toBeUndefined();
    });

    it("translates known markers instead of showing the raw code", () => {
        expect(syncResultNote({ status: "partial", message: "cancelled" }, t)).toBe("[hist.msg.cancelled]");
    });
});

describe("syncMessageText — shared with the sync-history page", () => {
    it("translates known codes and passes other text through", () => {
        expect(syncMessageText("gdt_batch_limit", t)).toBe("[hist.msg.gdt_batch_limit]");
        expect(syncMessageText(ENGINE_NOTE, t)).toBe(ENGINE_NOTE);
        expect(syncMessageText(undefined, t)).toBeUndefined();
        expect(syncMessageText("", t)).toBeUndefined();
    });
});
