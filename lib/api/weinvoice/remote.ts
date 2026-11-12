/**
 * API-mode hydration: fills the (initially empty) store from the backend after login, so every
 * screen — which reads the store synchronously — shows backend data only. No-op in mock mode.
 *
 * Working MST: `working_company_mst` from `GET /api/v1/weinvoice/me` (the user's / tenant's default),
 * else the logged-in company's `tax_id` when it is a connection, else the first connection, else the
 * /me `tax_id`. Mailboxes are loaded by their own screens (`loadMailboxes`, `GET /mailboxes`);
 * sub-accounts are not part of the published P1 API — not loaded.
 * Each loader is independent: one failing endpoint does not blank the others; the first failure is
 * exposed through `useHydration()` so the shell can show it.
 */
import { useSyncExternalStore } from "react";

import { CURRENT_YEAR } from "@/components/invoices/period";
import { loadInvoices } from "@/lib/api/weinvoice/invoices";
import { loadEmails } from "@/lib/api/weinvoice/mailbox";
import { rememberServerLang } from "@/lib/api/weinvoice/me";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState } from "@/lib/api/weinvoice/store";
import { loadCompanies, loadSyncHistory, setActiveTaxId } from "@/lib/api/weinvoice/sync";
import { loadTags } from "@/lib/api/weinvoice/tags";
import { toApiError, wiGet, type WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { session } from "@/lib/weinvoice/auth";

export type Hydration = { status: "idle" | "loading" | "ready" | "error"; errors: { endpoint: string; error: WeInvoiceApiError }[] };

let hydration: Hydration = { status: "idle", errors: [] };
/** MST whose scoped data is in the store — avoids reloading what hydrate() just loaded. */
let loadedTaxId = "";
const listeners = new Set<() => void>();
const setHydration = (h: Hydration) => {
    hydration = h;
    listeners.forEach((l) => l());
};

export function useHydration(): Hydration {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => hydration,
        () => hydration,
    );
}

async function settle(tasks: [string, () => Promise<void>][]): Promise<Hydration["errors"]> {
    const res = await Promise.allSettled(tasks.map(([, run]) => run()));
    return res.flatMap((r, i) => (r.status === "rejected" ? [{ endpoint: tasks[i][0], error: toApiError(r.reason) }] : []));
}

/** Load everything the shell + screens need. Call after a successful /me. */
export async function hydrate(year = CURRENT_YEAR): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    setHydration({ status: "loading", errors: [] });
    let working = "";
    const errors = await settle([
        ["GET /companies", loadCompanies],
        [
            "GET /me",
            async () => {
                const me = await wiGet<{ workingCompanyMst?: string | null; langCd?: string | null }>("/me");
                working = me.workingCompanyMst ?? "";
                rememberServerLang(me.langCd);
            },
        ],
    ]);

    const meTax = session.get()?.taxId ?? "";
    const conns = getState().connections;
    const taxId = working || (conns.some((c) => c.taxId === meTax) ? meTax : conns[0]?.taxId ?? meTax);
    loadedTaxId = taxId;
    if (taxId) setActiveTaxId(taxId);

    errors.push(
        ...(await settle([
            ["GET /invoices", () => loadInvoices(taxId, year)],
            ["GET /email/messages", () => loadEmails(taxId)],
            ["GET /tags", loadTags],
            ["GET /sync-runs", loadSyncHistory],
        ])),
    );
    setHydration({ status: errors.length ? "error" : "ready", errors });
}

/** Working MST changed (header switcher): reload the MST-scoped data. */
export async function reloadForTaxId(taxId: string, year = CURRENT_YEAR): Promise<void> {
    if (DATA_SOURCE !== "api" || !taxId || taxId === loadedTaxId) return;
    loadedTaxId = taxId;
    setHydration({ status: "loading", errors: [] });
    const errors = await settle([
        ["GET /invoices", () => loadInvoices(taxId, year)],
        ["GET /email/messages", () => loadEmails(taxId)],
    ]);
    setHydration({ status: errors.length ? "error" : "ready", errors });
}

/**
 * After a sync run (API mode): the engine wrote new invoices / XML and updated the period coverage —
 * reload that MST's invoices so lists, KPIs and the "incomplete period" banner reflect it.
 * Errors surface through `useHydration()` like any other load.
 */
export async function refreshAfterSync(taxId: string, year = CURRENT_YEAR): Promise<void> {
    if (DATA_SOURCE !== "api" || !taxId) return;
    const errors = await settle([["GET /invoices", () => loadInvoices(taxId, year)]]);
    if (errors.length) setHydration({ status: "error", errors });
}
