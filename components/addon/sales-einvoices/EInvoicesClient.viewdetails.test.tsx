import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EInvoicesClient from "./EInvoicesClient";
import { ADDON_SALES_EINVOICES, ADDON_EXPENSES_EINVOICES } from "@/lib/routes";

/**
 * "View Details" navigation guard (legacy `nxisas_einvhis_dt` list-page
 * redirect). Pins the confirmed behaviour:
 *
 *   • Sales client → router.push(Sales route); Expense → Expense route;
 *   • Sales never navigates to the Expense route (and vice versa) — the
 *     route is derived from the client's own `type`, so state can't cross;
 *   • the Update modal closes on View Details;
 *   • the main list re-fetches (refreshKey bump) via the existing
 *     useApiData flow so the freshly-scraped rows show.
 *
 * The heavy page + modal children and every data hook are stubbed so the
 * assertions target this client's orchestration only. The
 * UpdateEInvoiceModal stub surfaces its `variant` + a View Details button
 * that calls the real `onViewDetails` the client passed in.
 */

const h = vi.hoisted(() => ({
    push: vi.fn(),
    /** refreshKey (last useApiData dep) captured on every render. */
    refreshKeys: [] as unknown[],
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: h.push, prefetch: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({ t: (k: string) => k, locale: "EN" }),
}));

vi.mock("@/lib/api/useApiData", () => ({
    useApiData: (_fetcher: unknown, deps: unknown[]) => {
        h.refreshKeys.push(deps[deps.length - 1]);
        return { data: undefined, loading: false };
    },
}));

vi.mock("@/lib/api/mappers", () => ({
    mapEInvoiceRow: (r: unknown) => r,
    mapEInvoiceTotal: (r: unknown) => r,
}));

vi.mock("@/lib/api/addon", () => ({ fetchEInvoices: vi.fn() }));

vi.mock("@/hooks/useStickyLoading", () => ({
    useStickyLoading: (v: unknown) => v,
}));

vi.mock("@/hooks/useTableSort", () => ({
    useTableSort: () => ({
        sortField: null,
        sortDirection: null,
        sortParams: null,
        toggleSort: vi.fn(),
    }),
}));

vi.mock("@/hooks/useExcelExport", () => ({ useExcelExport: () => vi.fn() }));

vi.mock("@/components/shared/dialog", () => ({
    useDialog: () => ({ open: vi.fn() }),
}));

// Page stub — exposes the "Update" action (opens the modal).
vi.mock("./EInvoicesPage", () => ({
    default: ({ onRefresh }: { onRefresh: () => void }) => (
        <button type="button" onClick={onRefresh}>
            open-update
        </button>
    ),
}));

// Modal stub — surfaces its variant + a View Details button wired to the
// real onViewDetails the client passed down.
vi.mock("./UpdateEInvoiceModal", () => ({
    default: ({
        variant,
        onViewDetails,
    }: {
        variant: string;
        onViewDetails?: () => void;
    }) => (
        <div data-testid="update-modal" data-variant={variant}>
            <button type="button" onClick={() => onViewDetails?.()}>
                view-details
            </button>
        </div>
    ),
}));

beforeEach(() => {
    h.push.mockReset();
    h.refreshKeys = [];
});

async function openModalAndClickViewDetails() {
    fireEvent.click(screen.getByText("open-update"));
    const modal = await screen.findByTestId("update-modal");
    fireEvent.click(screen.getByText("view-details"));
    return modal;
}

describe("EInvoicesClient — View Details navigation", () => {
    it("Sales: navigates to the Sales route, closes the modal, refreshes", async () => {
        render(<EInvoicesClient type="SALES" translationPrefix="sales_einvoices" />);

        const modal = await openModalAndClickViewDetails();
        expect(modal.getAttribute("data-variant")).toBe("SALES");

        expect(h.push).toHaveBeenCalledWith(ADDON_SALES_EINVOICES);
        // Never crosses into the Expense screen.
        expect(h.push).not.toHaveBeenCalledWith(ADDON_EXPENSES_EINVOICES);

        // Modal closes.
        await waitFor(() =>
            expect(screen.queryByTestId("update-modal")).toBeNull(),
        );

        // List re-fetches: refreshKey (last useApiData dep) bumped past 0.
        expect(Math.max(...h.refreshKeys.map(Number))).toBeGreaterThan(0);
    });

    it("Expense: navigates to the Expense route, closes the modal, refreshes", async () => {
        render(<EInvoicesClient type="EXPENSE" translationPrefix="expenses_einvoices" />);

        const modal = await openModalAndClickViewDetails();
        expect(modal.getAttribute("data-variant")).toBe("EXPENSE");

        expect(h.push).toHaveBeenCalledWith(ADDON_EXPENSES_EINVOICES);
        // Never crosses into the Sales screen.
        expect(h.push).not.toHaveBeenCalledWith(ADDON_SALES_EINVOICES);

        await waitFor(() =>
            expect(screen.queryByTestId("update-modal")).toBeNull(),
        );

        expect(Math.max(...h.refreshKeys.map(Number))).toBeGreaterThan(0);
    });
});
