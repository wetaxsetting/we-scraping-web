/**
 * Regression coverage for the engine entrypoint selection in
 * {@link useNxisasEngine}.
 *
 * <p>Guards the second half of the defect fixed 2026-08-19: even with
 * `nonLogin:true` on the org-obj, calling the bundle's `callNxisas` a
 * second time re-runs `CooconiSASNX.open(...)` (`nxisas_v2.js:1770`). The
 * vendor's own entrypoint for the 2nd..nth scrape in one session is
 * `callNxisasWithoutOpenProcess` (`nxisas_v2.js:1795-1796`), which legacy
 * selects through `trns_0001.runScraping` (`trns_0001_007.ts:77-83`).
 *
 * <p>`enabled: false` skips the script-injection + probe effect, so these
 * tests exercise the returned runners against a stubbed bundle only — no
 * network, no `NXiSAS.exe`.
 *
 * @see ../../../../docs/bugs/own-account-transfer-engine-session-reuse-2026-08-19.md
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNxisasEngine } from "./use-nxisas-engine";

type BundleStub = {
    loadedNxisas: boolean;
    openNxisas:   ReturnType<typeof vi.fn>;
    callNxisas:   ReturnType<typeof vi.fn>;
    callNxisasWithoutOpenProcess?: ReturnType<typeof vi.fn>;
};

/** Resolve the caller's promise immediately with a canned payload so the
 *  test does not hang on the bundle's callback contract. */
function resolveWith(payload: unknown) {
    return vi.fn((_obj, _progress, cb?: (res: unknown) => void) => cb?.(payload));
}

function installBundle(opts: { withoutOpen: boolean }): BundleStub {
    const stub: BundleStub = {
        loadedNxisas: true,
        openNxisas:   vi.fn(),
        callNxisas:   resolveWith("via-callNxisas"),
    };
    if (opts.withoutOpen) {
        stub.callNxisasWithoutOpenProcess = resolveWith("via-withoutOpenProcess");
    }
    (window as unknown as { _v2nxisas?: BundleStub })._v2nxisas = stub;
    return stub;
}

const ORG_OBJ = [{ bankCd: "11704004", job: [{ Job: "TRANSFER" }] }];

describe("useNxisasEngine — session-reuse entrypoint", () => {
    beforeEach(() => {
        delete (window as unknown as { _v2nxisas?: BundleStub })._v2nxisas;
    });

    it("runScraping uses callNxisas — opens the engine, then LOGIN", async () => {
        const bundle = installBundle({ withoutOpen: true });
        const { result } = renderHook(() => useNxisasEngine({ enabled: false }));

        await expect(result.current.runScraping(ORG_OBJ)).resolves.toBe("via-callNxisas");
        expect(bundle.callNxisas).toHaveBeenCalledTimes(1);
        expect(bundle.callNxisasWithoutOpenProcess).not.toHaveBeenCalled();
    });

    it("runScrapingWithoutOpen uses callNxisasWithoutOpenProcess — no second Open+LOGIN", async () => {
        // THE REGRESSION. Before the fix the hook exposed only one runner,
        // so the transfer that followed Update Balance always re-opened the
        // engine and re-ran LOGIN → Vietcom 80002F31.
        const bundle = installBundle({ withoutOpen: true });
        const { result } = renderHook(() => useNxisasEngine({ enabled: false }));

        await expect(result.current.runScrapingWithoutOpen(ORG_OBJ))
            .resolves.toBe("via-withoutOpenProcess");
        expect(bundle.callNxisasWithoutOpenProcess).toHaveBeenCalledTimes(1);
        expect(bundle.callNxisas).not.toHaveBeenCalled();
    });

    it("falls back to callNxisas on bundle drops without the vendor function", async () => {
        const bundle = installBundle({ withoutOpen: false });
        const { result } = renderHook(() => useNxisasEngine({ enabled: false }));

        await expect(result.current.runScrapingWithoutOpen(ORG_OBJ))
            .resolves.toBe("via-callNxisas");
        expect(bundle.callNxisas).toHaveBeenCalledTimes(1);
    });

    it("passes progress=true and forwards the per-job callback on both runners", async () => {
        const bundle = installBundle({ withoutOpen: true });
        const { result } = renderHook(() => useNxisasEngine({ enabled: false }));
        const onJob = vi.fn();

        await result.current.runScraping(ORG_OBJ, onJob);
        await result.current.runScrapingWithoutOpen(ORG_OBJ, onJob);

        for (const call of [bundle.callNxisas.mock.calls[0],
                            bundle.callNxisasWithoutOpenProcess!.mock.calls[0]]) {
            expect(call[0]).toBe(ORG_OBJ);
            expect(call[1]).toBe(true);          // progress
            expect(typeof call[2]).toBe("function"); // main callback
            expect(call[3]).toBeUndefined();     // unit callback — unused
            expect(typeof call[4]).toBe("function"); // job callback
        }
    });

    it("rejects both runners when the bundle is absent", async () => {
        const { result } = renderHook(() => useNxisasEngine({ enabled: false }));
        await expect(result.current.runScraping(ORG_OBJ)).rejects.toThrow(/not loaded/);
        await expect(result.current.runScrapingWithoutOpen(ORG_OBJ)).rejects.toThrow(/not loaded/);
    });
});
