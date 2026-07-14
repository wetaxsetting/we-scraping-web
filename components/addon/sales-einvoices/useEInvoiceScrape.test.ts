import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useEInvoiceScrape } from "./useEInvoiceScrape";

/**
 * D1 — explicit GDT LOGOUT + reliable session cleanup, and D2 — no-detail
 * path when the list is empty. These pin the driver's session lifecycle:
 * after phase-1 LOGIN succeeds the session is held open (nonLogout:true)
 * through phase 2, so `run()` MUST issue exactly one best-effort LOGOUT in
 * its `finally` on every post-LOGIN exit — success, no-data, and
 * detail-persistence failure — while skipping it entirely on a login
 * failure (no session). A logout failure must never mask the result.
 *
 * The engine hook and the persistence API are mocked; the real
 * einvoiceScrape builders/parsers run so the driver's control flow is
 * exercised end-to-end from realistic engine payloads.
 */

const h = vi.hoisted(() => ({
    runScraping: vi.fn(),
    runLogout: vi.fn(),
    scrapeEInvoices: vi.fn(),
    scrapeEInvoiceDetails: vi.fn(),
}));

vi.mock("@/components/banking/own-account-transfer/hooks/use-nxisas-engine", () => ({
    useNxisasEngine: () => ({
        status: "ready",
        vendor: null,
        version: null,
        retry: vi.fn(),
        runScraping: h.runScraping,
        runLogout: h.runLogout,
    }),
}));

vi.mock("@/lib/api/addon", () => ({
    scrapeEInvoices: h.scrapeEInvoices,
    scrapeEInvoiceDetails: h.scrapeEInvoiceDetails,
}));

const CERT = { seqNo: 7, loginId: "gdt-login", password: "gdt-secret" };
const PARAMS = { cert: CERT, type: "SALES" as const, fromDt: "20260701", toDt: "20260714" };

/** Engine `[{ result: [...] }]` envelope. */
function raw(...jobs: Array<Record<string, unknown>>) {
    return [{ result: jobs }];
}
function listJob(errorCode: string, invoices: Array<Record<string, unknown>> = []) {
    return {
        Job: "INVOICE_LIST",
        Input: {},
        Output: {
            ErrorCode: errorCode,
            ErrorMessage: "",
            Result: invoices.length ? JSON.stringify({ invoiceList: invoices }) : "",
        },
    };
}
function detailJob() {
    return {
        Job: "INVOICE_DETAIL",
        Input: {},
        Output: {
            ErrorCode: "00000000",
            ErrorMessage: "",
            Result: JSON.stringify({ invoiceDetail: [{}] }),
        },
    };
}
const INV = { numericSymbol: "1", invoiceSymbol: "C25TAB", invoiceNo: "7", totalAmt: "1000" };

function okSave() {
    return { saved_count: 1, updated_count: 0, skipped_count: 0, mod_dtm: "20260714000000" };
}

beforeEach(() => {
    h.runScraping.mockReset();
    h.runLogout.mockReset().mockResolvedValue(undefined);
    h.scrapeEInvoices.mockReset().mockResolvedValue(okSave());
    h.scrapeEInvoiceDetails.mockReset().mockResolvedValue({ detail_saved: 1, mod_dtm: "20260714000000" });
});

describe("useEInvoiceScrape — GDT session lifecycle (D1)", () => {
    it("logs out once after a successful two-phase scrape", async () => {
        h.runScraping
            .mockResolvedValueOnce(raw(listJob("00000000", [INV]))) // phase-1 list
            .mockResolvedValueOnce(raw(detailJob())); // phase-2 detail

        const { result } = renderHook(() => useEInvoiceScrape(true));
        await act(async () => {
            await result.current.run(PARAMS);
        });

        expect(h.scrapeEInvoices).toHaveBeenCalledTimes(1);
        expect(h.scrapeEInvoiceDetails).toHaveBeenCalledTimes(1);
        expect(h.runLogout).toHaveBeenCalledTimes(1);
        expect(h.runLogout).toHaveBeenCalledWith("VIETNAM_GDT");
    });

    it("logs out after a no-data (42110000) inquiry and skips the detail phase", async () => {
        h.runScraping.mockResolvedValueOnce(raw(listJob("42110000"))); // empty

        const { result } = renderHook(() => useEInvoiceScrape(true));
        let res: Awaited<ReturnType<typeof result.current.run>> | undefined;
        await act(async () => {
            res = await result.current.run(PARAMS);
        });

        // Phase-1 save still runs (records the call); no detail scrape/save.
        expect(h.scrapeEInvoices).toHaveBeenCalledTimes(1);
        expect(h.runScraping).toHaveBeenCalledTimes(1); // no phase-2 call
        expect(h.scrapeEInvoiceDetails).not.toHaveBeenCalled();
        expect(h.runLogout).toHaveBeenCalledTimes(1);
        expect(res?.outcome.noData).toBe(true);
    });

    it("logs out even when detail persistence fails, and propagates the error", async () => {
        h.runScraping
            .mockResolvedValueOnce(raw(listJob("00000000", [INV])))
            .mockResolvedValueOnce(raw(detailJob()));
        h.scrapeEInvoiceDetails.mockRejectedValue(new Error("persist boom"));

        const { result } = renderHook(() => useEInvoiceScrape(true));
        let caught: unknown;
        await act(async () => {
            try {
                await result.current.run(PARAMS);
            } catch (e) {
                caught = e;
            }
        });

        expect(caught).toBeInstanceOf(Error);
        expect((caught as Error).message).toBe("persist boom");
        expect(h.runLogout).toHaveBeenCalledTimes(1);
    });

    it("does NOT log out on a login failure (no session was opened)", async () => {
        h.runScraping.mockResolvedValueOnce(
            raw({
                Job: "LOGIN",
                Input: {},
                Output: { ErrorCode: "WBE1009", ErrorMessage: "bad", Result: "" },
            }),
        );

        const { result } = renderHook(() => useEInvoiceScrape(true));
        await act(async () => {
            await result.current.run(PARAMS);
        });

        expect(h.scrapeEInvoices).not.toHaveBeenCalled();
        expect(h.runLogout).not.toHaveBeenCalled();
    });

    it("a logout failure never masks the inquiry result", async () => {
        h.runScraping
            .mockResolvedValueOnce(raw(listJob("00000000", [INV])))
            .mockResolvedValueOnce(raw(detailJob()));
        h.runLogout.mockRejectedValue(new Error("logout boom"));

        const { result } = renderHook(() => useEInvoiceScrape(true));
        let res: Awaited<ReturnType<typeof result.current.run>> | undefined;
        let caught: unknown;
        await act(async () => {
            try {
                res = await result.current.run(PARAMS);
            } catch (e) {
                caught = e;
            }
        });

        expect(caught).toBeUndefined(); // result not masked by logout failure
        expect(res?.saved).not.toBeNull();
        expect(h.runLogout).toHaveBeenCalledTimes(1);
    });
});

/**
 * Progress milestones (finalized 2026-07-14 —
 * `update-einvoice-progressbar-final.md`). The hook drives `onProgress`
 * through the legacy milestones and MUST NOT emit the removed refactor-only
 * 15% credential-fetch step. Dynamic per-detail-job progress
 * (legacy `50 + n/N*50`) is intentionally NOT emitted — `runScraping` does
 * not surface per-job callbacks, so the detail phase jumps 50 → 100
 * (documented limitation).
 */
describe("useEInvoiceScrape — progress milestones", () => {
    async function collectProgress(): Promise<number[]> {
        const pcts: number[] = [];
        const { result } = renderHook(() => useEInvoiceScrape(true));
        await act(async () => {
            await result.current.run({ ...PARAMS, onProgress: (p) => pcts.push(p) });
        });
        return pcts;
    }

    it("emits 25 → 35 → 50 → 100 across the two-phase scrape (items 7/8)", async () => {
        h.runScraping
            .mockResolvedValueOnce(raw(listJob("00000000", [INV]))) // phase-1 list
            .mockResolvedValueOnce(raw(detailJob())); // phase-2 detail
        expect(await collectProgress()).toEqual([25, 35, 50, 100]);
    });

    it("NEVER emits the removed 15% milestone; first milestone is 25% (item 6)", async () => {
        h.runScraping
            .mockResolvedValueOnce(raw(listJob("00000000", [INV])))
            .mockResolvedValueOnce(raw(detailJob()));
        const pcts = await collectProgress();
        expect(pcts).not.toContain(15);
        expect(pcts[0]).toBe(25);
    });

    it("skips the 50% detail step when the list is empty (25 → 35 → 100)", async () => {
        h.runScraping.mockResolvedValueOnce(raw(listJob("42110000"))); // no-data
        expect(await collectProgress()).toEqual([25, 35, 100]);
    });

    it("login failure emits 25 → 100 and performs no save", async () => {
        h.runScraping.mockResolvedValueOnce(
            raw({
                Job: "LOGIN",
                Input: {},
                Output: { ErrorCode: "WBE1009", ErrorMessage: "bad", Result: "" },
            }),
        );
        expect(await collectProgress()).toEqual([25, 100]);
        expect(h.scrapeEInvoices).not.toHaveBeenCalled();
    });
});

/**
 * D3 — Expense BUSSINESS_REGISTRATION_DETAIL seller enrichment (#40477,
 * legacy runDetailScrapping3). When a scraped invoice has a blank seller name
 * the Expense flow runs a third engine call (registration lookup, session
 * reused) and merges company / representative / PIC into the posted rows.
 * Sales (runDetailScrapping4) does NOT.
 */
describe("useEInvoiceScrape — Expense registration enrichment (D3)", () => {
    // Phase-1 invoice with a seller tax code but NO seller name.
    const INV_BLANK_SELLER = {
        numericSymbol: "1", invoiceSymbol: "C25TAB", invoiceNo: "7",
        totalAmt: "1000", sellerTaxCode: "0100000001",
    };
    function regJob(taxCode: string, companyName: string, chairman: string, accountant: string) {
        return {
            Job: "BUSSINESS_REGISTRATION_DETAIL",
            Input: {},
            Output: {
                ErrorCode: "00000000",
                ErrorMessage: "",
                Result: JSON.stringify({
                    registrationDetail: [{ taxCode, companyName, chairman, accountant }],
                }),
            },
        };
    }

    it("Expense runs the registration lookup for a blank-seller row and merges it into the posted details", async () => {
        h.runScraping
            .mockResolvedValueOnce(raw(listJob("00000000", [INV_BLANK_SELLER]))) // phase-1
            .mockResolvedValueOnce(raw(detailJob()))                              // phase-2 (blank seller)
            .mockResolvedValueOnce(raw(regJob("0100000001", "Full Co", "Chair", "Acct"))); // phase-2b

        const { result } = renderHook(() => useEInvoiceScrape(true));
        await act(async () => {
            await result.current.run({ ...PARAMS, type: "EXPENSE" });
        });

        // 3 engine calls: list + detail + registration.
        expect(h.runScraping).toHaveBeenCalledTimes(3);
        const body = h.scrapeEInvoiceDetails.mock.calls[0][0];
        expect(body.details[0].trco_name).toBe("Full Co");
        expect(body.details[0].seller_rppr_enm).toBe("Chair");
        expect(body.details[0].seller_pic_name).toBe("Acct");
    });

    it("Sales does NOT run the registration lookup (only list + detail)", async () => {
        h.runScraping
            .mockResolvedValueOnce(raw(listJob("00000000", [INV_BLANK_SELLER])))
            .mockResolvedValueOnce(raw(detailJob()));

        const { result } = renderHook(() => useEInvoiceScrape(true));
        await act(async () => {
            await result.current.run({ ...PARAMS, type: "SALES" });
        });

        expect(h.runScraping).toHaveBeenCalledTimes(2); // no registration call
    });
});
