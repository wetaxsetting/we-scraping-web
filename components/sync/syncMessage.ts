import type { SyncRun } from "@/lib/weinvoice/types";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Sync-run reasons that have a locale entry (`hist.msg.<code>`). Any other `message` is backend / engine
 * text (API mode: `SyncRunItem.message` = engine `err_msg`) and is shown as sent.
 * `queued` / `running` / `cancelled`: markers set by `toSyncRun` (lib/api/weinvoice/sync.ts).
 */
export const KNOWN_SYNC_MSG = new Set(["gdt_login_failed", "gdt_batch_limit", "cancelled", "queued", "running"]);

/** Text of a sync-run message: translated when it is a known code, otherwise as sent. */
export function syncMessageText(message: string | undefined | null, t: T): string | undefined {
    if (!message) return undefined;
    return KNOWN_SYNC_MSG.has(message) ? t(`hist.msg.${message}`) : message;
}

/**
 * Note under the sync dialog's result cards. The engine explains why invoices still lack XML
 * (e.g. "Còn 10 HĐ chưa có XML: 8 HĐ Cục Thuế chưa có XML …") — show that; fall back to the
 * generic partial note only when a partial run carries no message. A successful run without a
 * message shows nothing.
 */
export function syncResultNote(run: Pick<SyncRun, "status" | "message">, t: T): string | undefined {
    return syncMessageText(run.message, t) ?? (run.status === "partial" ? t("sync.partial_note") : undefined);
}
