import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ request: vi.fn(), post: vi.fn(), source: { DATA_SOURCE: "api" as "api" | "mock" } }));

vi.mock("@/lib/axios", async (io) => {
    const real = await io<typeof import("@/lib/axios")>();
    return { ...real, api: { ...real.api, request: h.request, post: h.post } };
});
vi.mock("@/lib/api/weinvoice/source", () => h.source);
// Polling helpers and mock delays sleep — make them instant.
vi.mock("@/lib/utils", async (io) => ({ ...(await io<typeof import("@/lib/utils")>()), sleep: () => Promise.resolve() }));

import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { getState, resetState, setState } from "@/lib/api/weinvoice/store";
import { loadSubAccounts, removeSubAccount, resendInvite, saveSubAccount, setSubStatus, subAccountsAvailable } from "@/lib/api/weinvoice/subaccounts";

const UI = { id: "s1", name: "Kế toán A", email: "a@example.vn", taxIds: ["0101234567"], perms: ["view", "download"], status: "invited" as const, createdAt: "2026-11-01T00:00:00Z" };

beforeEach(() => {
    h.source.DATA_SOURCE = "api";
    h.request.mockReset();
    h.post.mockReset();
    resetState();
});

/** `/sub-accounts/*` is not in the published API: api mode never calls HTTP for it. */
describe("sub-accounts — api mode (not on the server)", () => {
    it("loadSubAccounts resolves with an empty list and sends no request", async () => {
        setState((s) => {
            s.subaccounts = [UI];
        });
        await loadSubAccounts();
        expect(getState().subaccounts).toEqual([]);
        expect(subAccountsAvailable()).toBe(false);
        expect(h.request).not.toHaveBeenCalled();
    });

    it("every mutation refuses with WBE_CLIENT_NOT_ON_SERVER, changes nothing, sends nothing", async () => {
        setState((s) => {
            s.subaccounts = [UI];
        });
        for (const op of [
            () => saveSubAccount({ name: "X", email: "x@example.vn", taxIds: ["0101234567"], perms: ["view"] }),
            () => setSubStatus("s1", "locked"),
            () => resendInvite("s1"),
            () => removeSubAccount("s1"),
        ]) {
            const err = await op().catch((e) => e);
            expect(err).toBeInstanceOf(WeInvoiceApiError);
            expect(err).toMatchObject({ code: "WBE_CLIENT_NOT_ON_SERVER" });
        }
        expect(getState().subaccounts).toEqual([UI]);
        expect(h.request).not.toHaveBeenCalled();
        expect(h.post).not.toHaveBeenCalled();
    });
});

describe("sub-accounts — mock mode", () => {
    it("makes no HTTP call", async () => {
        h.source.DATA_SOURCE = "mock";
        resetState();
        const n = getState().subaccounts?.length ?? 0;
        await loadSubAccounts();
        await saveSubAccount({ name: "X", email: "x@example.vn", taxIds: ["0109876543"], perms: ["view"] });
        const added = getState().subaccounts!.at(-1)!;
        expect(added).toMatchObject({ name: "X", status: "invited" });
        await resendInvite(added.id);
        await setSubStatus(added.id, "locked");
        await removeSubAccount(added.id);
        expect(getState().subaccounts?.length ?? 0).toBe(n);
        expect(subAccountsAvailable()).toBe(true);
        expect(h.request).not.toHaveBeenCalled();
    });
});
