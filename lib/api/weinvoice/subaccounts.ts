/*
 * Sub-accounts (screen 18, P2 — §3.10).
 *
 *  - mock mode (default): in-memory store. No invitation email is sent and no credential is
 *    created: a new account is recorded as "invited"; lock / unlock only flips the status.
 *  - api mode: sub-accounts (`/sub-accounts/*`) are NOT part of the published P1 API
 *    (backend interface-specification). Nothing here calls HTTP: `loadSubAccounts` resolves with an
 *    empty list, the mutations refuse with `WBE_CLIENT_NOT_ON_SERVER`, and the screen shows a "not
 *    available on the server yet" state (`subAccountsAvailable()`).
 */

import type { SubAccount } from "@/lib/api/weinvoice/mockData";
import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { setState } from "@/lib/api/weinvoice/store";
import { sleep } from "@/lib/utils";

/** The 8 permissions of §3.10: xem, tải, đồng bộ, tải lên, tag, kiểm tra, báo cáo, kết nối. */
export const PERMS = ["view", "download", "sync", "upload", "tag", "check", "report", "connect"] as const;
export type Perm = (typeof PERMS)[number];
/** The 3 permission templates of §3.10. */
export const PRESETS: Record<string, Perm[]> = {
    viewer: ["view", "download"],
    accountant: ["view", "download", "sync", "upload", "tag", "check", "report"],
    manager: [...PERMS],
};

/** Sub-accounts exist only in mock mode — `/sub-accounts/*` is not in the published API. */
export const subAccountsAvailable = (): boolean => DATA_SOURCE !== "api";

const notOnServer = () => new WeInvoiceApiError("WBE_CLIENT_NOT_ON_SERVER", "Sub-accounts are not available on the server yet.");

/** API mode: no endpoint → an empty list, no HTTP call. No-op in mock mode. */
export async function loadSubAccounts(): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    setState((s) => {
        s.subaccounts = [];
    });
}

/** Create (status "invited") or update an existing sub-account; email and status are kept on update. */
export async function saveSubAccount(a: Omit<SubAccount, "id" | "createdAt" | "status"> & { id?: string }): Promise<void> {
    const perms = a.perms.filter((p): p is Perm => (PERMS as readonly string[]).includes(p));
    if (DATA_SOURCE === "api") throw notOnServer();
    await sleep(300);
    setState((s) => {
        const list = s.subaccounts ?? [];
        const existing = a.id ? list.find((x) => x.id === a.id) : undefined;
        if (existing) {
            existing.name = a.name;
            existing.taxIds = [...a.taxIds];
            existing.perms = perms;
        } else {
            list.push({ id: `sub-${Date.now()}`, name: a.name, email: a.email, taxIds: [...a.taxIds], perms, status: "invited", createdAt: new Date().toISOString() });
        }
        s.subaccounts = list;
    });
}

export async function setSubStatus(id: string, status: SubAccount["status"]): Promise<void> {
    if (DATA_SOURCE === "api") throw notOnServer();
    await sleep(150);
    setState((s) => {
        const a = (s.subaccounts ?? []).find((x) => x.id === id);
        if (a) a.status = status;
    });
}

/** "Gửi lại lời mời". Mock: nothing is sent. */
export async function resendInvite(id: string): Promise<void> {
    if (DATA_SOURCE === "api") throw notOnServer();
    void id;
}

export async function removeSubAccount(id: string): Promise<void> {
    if (DATA_SOURCE === "api") throw notOnServer();
    await sleep(150);
    setState((s) => {
        s.subaccounts = (s.subaccounts ?? []).filter((x) => x.id !== id);
    });
}
