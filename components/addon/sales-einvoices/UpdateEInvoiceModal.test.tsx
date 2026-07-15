import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import UpdateEInvoiceModal from "./UpdateEInvoiceModal";

/**
 * Regression guard for the GDT e-Invoice Real-Time Online Inquiry
 * password-flow fix (2026-07-14). Legacy fed the stored GDT credential
 * to the local NXiSAS engine silently; the refactor had regressed into
 * prompting for the GDT password on every inquiry via the shared
 * PasswordConfirmationDialog. These tests pin the corrected behaviour:
 *
 *   • clicking "Real-Time Online Inquire" fetches the GDT scraping
 *     credential through the NEW silent endpoint and never opens a
 *     password popup / never calls the reveal (confirmation) endpoint;
 *   • the fetched login id + password flow straight into scrape.run;
 *   • a missing GDT credential still shows the existing warning and
 *     never scrapes;
 *   • Sales and Expenses drive the identical shared flow.
 *
 * The engine hook, the credential API, the dialog service, and i18n are
 * mocked so the assertions target the modal's orchestration only.
 */

const h = vi.hoisted(() => ({
    engineStatus: { value: "ready" as string },
    runMock: vi.fn(),
    fetchLoginCredentialsMock: vi.fn(),
    fetchGdtScrapingCredentialMock: vi.fn(),
    revealLoginCredentialMock: vi.fn(),
    dialogOpenMock: vi.fn(),
}));

vi.mock("@/components/addon/sales-einvoices/useEInvoiceScrape", () => ({
    useEInvoiceScrape: () => ({
        engineStatus: h.engineStatus.value,
        retryEngine: vi.fn(),
        scraping: false,
        run: h.runMock,
    }),
}));

vi.mock("@/lib/api/loginCredentials", () => ({
    fetchLoginCredentials: h.fetchLoginCredentialsMock,
    fetchGdtScrapingCredential: h.fetchGdtScrapingCredentialMock,
    revealLoginCredential: h.revealLoginCredentialMock,
}));

vi.mock("@/components/shared/dialog", () => ({
    useDialog: () => ({ open: h.dialogOpenMock }),
}));

vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({ t: (key: string) => key, locale: "en" }),
}));

// The modal probes the last successful inquiry on mount (Auto default
// range) via fetchEInvoiceHistory — mock it to an empty history so the
// mount effect is deterministic and never hits the network. The detail
// dialog is imported by the modal (rendered only on View) and pulls
// fetchEInvoiceDetailHistory from the same module.
vi.mock("@/lib/api/addon", () => ({
    fetchEInvoiceHistory: vi.fn().mockResolvedValue({ rows: [] }),
    fetchEInvoiceDetailHistory: vi.fn().mockResolvedValue({ rows: [] }),
}));

// Noisy children irrelevant to the credential flow — stub to nothing.
vi.mock("@/components/shared/InteractiveDateRangePicker", () => ({
    default: () => null,
}));
vi.mock("@/components/shared/Tooltip", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/InfoIcon", () => ({ default: () => null }));
vi.mock("./EInvoiceHistoryDialog", () => ({ default: () => null }));
vi.mock("./EInvoiceDetailHistoryDialog", () => ({ default: () => null }));

const INQUIRE_BUTTON = { name: "einvoice_update.inquire" };

function okScrapeResult() {
    return {
        outcome: { loginFailed: false, rsltCd: "00000000", rsltMsg: "", errors: [], invoices: [] },
        saved: { saved_count: 0, updated_count: 0 },
        detailOutcome: null,
        detailSaved: null,
        captchaExceeded: false,
    };
}

/** A completed inquiry that carries per-item engine errors — the legacy
 *  partial-failure case (some rows failed, some succeeded). */
function partialFailScrapeResult() {
    return {
        outcome: {
            loginFailed: false,
            rsltCd: "8000720E",
            rsltMsg: "Wrong tax bill code. Please check and try again.",
            errors: ["[1C25TAB-7] Wrong tax bill code. Please check and try again. (8000720E)"],
            invoices: [],
        },
        saved: { saved_count: 1, updated_count: 0 },
        detailOutcome: {
            rsltCd: "8000720E",
            rsltMsg: "Wrong tax bill code. Please check and try again.",
            errors: [],
            details: [],
        },
        detailSaved: { saved_count: 0, updated_count: 0 },
        captchaExceeded: false,
    };
}

function gdtCredentialList() {
    return { items: [{ type: "GDT", accounts: [{ seq_no: 7, login_id: "gdt-login" }] }] };
}

beforeEach(() => {
    h.engineStatus.value = "ready";
    h.runMock.mockReset().mockResolvedValue(okScrapeResult());
    h.fetchLoginCredentialsMock.mockReset().mockResolvedValue(gdtCredentialList());
    h.fetchGdtScrapingCredentialMock
        .mockReset()
        .mockResolvedValue({ login_id: "gdt-login", password: "gdt-secret" });
    h.revealLoginCredentialMock.mockReset();
    h.dialogOpenMock.mockReset();
});

describe("UpdateEInvoiceModal — Real-Time Online Inquire silent credential flow", () => {
    it("fetches the GDT scraping credential and never prompts for a password (Sales)", async () => {
        render(<UpdateEInvoiceModal variant="SALES" onClose={vi.fn()} onScraped={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", INQUIRE_BUTTON));

        await waitFor(() => expect(h.fetchGdtScrapingCredentialMock).toHaveBeenCalledWith(7));

        // The decrypted credential flows straight into the engine scrape.
        await waitFor(() => expect(h.runMock).toHaveBeenCalledTimes(1));
        const arg = h.runMock.mock.calls[0][0];
        expect(arg.cert).toEqual({ seqNo: 7, loginId: "gdt-login", password: "gdt-secret" });
        expect(arg.type).toBe("SALES");

        // No re-auth: the reveal (password-confirmation) endpoint is never
        // called, and no password input is ever rendered.
        expect(h.revealLoginCredentialMock).not.toHaveBeenCalled();
        expect(
            screen.queryByLabelText("einvoice_update.password_aria"),
        ).toBeNull();
    });

    it("drives the identical flow for Expenses", async () => {
        render(<UpdateEInvoiceModal variant="EXPENSE" onClose={vi.fn()} onScraped={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", INQUIRE_BUTTON));

        await waitFor(() => expect(h.fetchGdtScrapingCredentialMock).toHaveBeenCalledWith(7));
        await waitFor(() => expect(h.runMock).toHaveBeenCalledTimes(1));
        expect(h.runMock.mock.calls[0][0].type).toBe("EXPENSE");
        expect(h.revealLoginCredentialMock).not.toHaveBeenCalled();
    });

    it("shows the missing-credential warning and never scrapes when no GDT credential exists", async () => {
        h.fetchLoginCredentialsMock.mockResolvedValue({ items: [] });

        render(<UpdateEInvoiceModal variant="SALES" onClose={vi.fn()} onScraped={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", INQUIRE_BUTTON));

        await waitFor(() =>
            expect(h.dialogOpenMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "warning",
                    description: "einvoice_update.no_credential",
                }),
            ),
        );
        expect(h.fetchGdtScrapingCredentialMock).not.toHaveBeenCalled();
        expect(h.runMock).not.toHaveBeenCalled();
        expect(h.revealLoginCredentialMock).not.toHaveBeenCalled();
    });
});

/**
 * Progress-bar behavior (finalized 2026-07-14 — `update-einvoice-progressbar-final.md`).
 * INTENTIONAL refactor design: a single brand-blue fill for Ready /
 * Scraping / Completed (NO legacy olive-green `#B5CC18`, NO green switch on
 * completion); only `failed` diverges to red. Track stays `bg-[#f5f5f5]`.
 * The refactor-only 15% credential-fetch milestone was removed — progress
 * starts at 0% and the first milestone is 25%.
 */
const PROGRESS_FILL = "einvoice-progress-fill";

describe("UpdateEInvoiceModal — progress bar", () => {
    it("Ready state: bar at 0%, blue fill, #f5f5f5 track (item 1/2/3)", () => {
        render(<UpdateEInvoiceModal variant="SALES" onClose={vi.fn()} onScraped={vi.fn()} />);
        const fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("0%");
        expect(fill.className).toContain("bg-brand");
        // No legacy/green tokens anywhere on the fill.
        expect(fill.className).not.toContain("bg-wb-status-approved-text");
        expect(fill.className).not.toContain("#B5CC18");
        // Track is the retained refactor grey.
        expect(fill.parentElement?.className).toContain("bg-[#f5f5f5]");
    });

    it("does NOT set the removed 15% credential-fetch milestone (item 6)", async () => {
        // Hold run() pending so we can inspect the in-flight bar. Legacy
        // starts at 0 and jumps to 25 — the refactor must NOT flash 15%.
        let resolveRun: (v: ReturnType<typeof okScrapeResult>) => void = () => {};
        h.runMock.mockReturnValue(
            new Promise((r) => {
                resolveRun = r;
            }),
        );
        render(<UpdateEInvoiceModal variant="SALES" onClose={vi.fn()} onScraped={vi.fn()} />);

        fireEvent.click(screen.getByRole("button", INQUIRE_BUTTON));
        // Once run() is reached, the credential fetch has resolved and we are
        // mid-scrape. Progress must still be 0% (never 15%).
        await waitFor(() => expect(h.runMock).toHaveBeenCalledTimes(1));
        const fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("0%");
        expect(fill.style.width).not.toBe("15%");

        resolveRun(okScrapeResult()); // let the flow finish cleanly
        await waitFor(() =>
            expect(screen.queryByText("einvoice_update.completed")).not.toBeNull(),
        );
    });

    it("Completed: 100%, STILL blue (no green switch), Completed label (item 4/5)", async () => {
        render(<UpdateEInvoiceModal variant="SALES" onClose={vi.fn()} onScraped={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", INQUIRE_BUTTON));

        await waitFor(() =>
            expect(screen.queryByText("einvoice_update.completed")).not.toBeNull(),
        );
        const fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("100%");
        expect(fill.className).toContain("bg-brand");
        expect(fill.className).not.toContain("bg-wb-status-approved-text");
    });

    it("Sales and Expenses share identical progress behavior (item 14)", async () => {
        const { unmount } = render(
            <UpdateEInvoiceModal variant="SALES" onClose={vi.fn()} onScraped={vi.fn()} />,
        );
        let fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("0%");
        expect(fill.className).toContain("bg-brand");
        unmount();

        render(<UpdateEInvoiceModal variant="EXPENSE" onClose={vi.fn()} onScraped={vi.fn()} />);
        fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("0%");
        expect(fill.className).toContain("bg-brand");
    });
});

/**
 * Legacy-parity completion behaviour (`nxisas_einvoice.js:898` → WBI1131).
 * Every finished inquiry — clean success OR partial failure — shows exactly
 * one "The inquiry has been finished." info dialog (mapped to the refactor
 * `success` type). It must NEVER pop the old blocking Warning dialog with the
 * raw engine message. Per-item failures surface inline as the red "Partially
 * Failed" label with the error list on hover.
 */
describe("UpdateEInvoiceModal — completion dialog + Partially Failed status", () => {
    it("clean success shows the info finish dialog, never a warning", async () => {
        render(<UpdateEInvoiceModal variant="SALES" onClose={vi.fn()} onScraped={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", INQUIRE_BUTTON));

        await waitFor(() =>
            expect(h.dialogOpenMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "success",
                    description: "einvoice_update.inquiry_finished",
                }),
            ),
        );
        // No warning dialog is ever raised on a finished inquiry.
        expect(h.dialogOpenMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: "warning" }),
        );
        // No inline failure label on a clean run.
        expect(screen.queryByText("einvoice_update.partially_failed")).toBeNull();
    });

    it("partial failure: finish dialog (not warning) + inline Partially Failed label", async () => {
        h.runMock.mockResolvedValue(partialFailScrapeResult());
        render(<UpdateEInvoiceModal variant="EXPENSE" onClose={vi.fn()} onScraped={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", INQUIRE_BUTTON));

        // Same single info dialog as a clean success — the raw engine message
        // ("Wrong tax bill code…") is NOT surfaced as a blocking warning.
        await waitFor(() =>
            expect(h.dialogOpenMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "success",
                    description: "einvoice_update.inquiry_finished",
                }),
            ),
        );
        expect(h.dialogOpenMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: "warning" }),
        );
        // Inline red status label appears (tooltip content is stubbed away by
        // the Tooltip mock, so we assert the label text only).
        await waitFor(() =>
            expect(screen.queryByText("einvoice_update.partially_failed")).not.toBeNull(),
        );
    });
});
