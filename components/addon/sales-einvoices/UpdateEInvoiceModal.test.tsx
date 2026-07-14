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

// Noisy children irrelevant to the credential flow — stub to nothing.
vi.mock("@/components/shared/InteractiveDateRangePicker", () => ({
    default: () => null,
}));
vi.mock("@/components/shared/Tooltip", () => ({
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/shared/InfoIcon", () => ({ default: () => null }));
vi.mock("./EInvoiceHistoryDialog", () => ({ default: () => null }));

const INQUIRE_BUTTON = { name: "einvoice_update.inquire" };

function okScrapeResult() {
    return {
        outcome: { loginFailed: false, rsltCd: "00000000", rsltMsg: "", invoices: [] },
        saved: { saved_count: 0, updated_count: 0 },
        detailOutcome: null,
        detailSaved: null,
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
