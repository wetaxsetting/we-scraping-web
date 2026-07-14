import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TransactionSyncDialog, {
    type SyncSelectedAccount,
} from "./TransactionSyncDialog";
import type { ApiSyncStatusResponse } from "@/lib/types/api";

/**
 * Phase 2 polling + cancel-flow behaviour for the Bank Transaction Sync modal.
 * Uses fake timers for the poll cadence; the api client, dialog service,
 * sticky-loading hook, and i18n are mocked so assertions target the modal's
 * orchestration only.
 *
 * Cancel-flow coverage — STRICT LEGACY PARITY (§15):
 *  - CASE 1 (main Cancel / X): whole-session cancel → `cancelSync` → the
 *    "The inquiry has been canceled." Information dialog → OK resets (X also
 *    closes). Polling is paused while the confirmation is open (no completion
 *    dialog can replace it).
 *  - CASE 2 (QNA/OTP/CAPTCHA Cancel / X): account-level `cancelSyncChallenge`
 *    (LOGIN_CAN) — the batch CONTINUES, does NOT reset, and finishes with the
 *    normal "Success X / Failed Y" completion summary. Never calls `cancelSync`.
 * The three challenge dialogs are mocked as interactive Cancel/X buttons.
 */

const h = vi.hoisted(() => ({
    syncTransactionsMock: vi.fn(),
    fetchSyncStatusMock: vi.fn(),
    cancelSyncMock: vi.fn(),
    cancelSyncChallengeMock: vi.fn(),
    dialogOpenMock: vi.fn(),
}));

vi.mock("@/lib/api/banking", () => ({
    ApiCallError: class ApiCallError extends Error {
        code: string;
        constructor(code: string, message: string) { super(message); this.code = code; }
    },
    syncTransactions: h.syncTransactionsMock,
    fetchSyncStatus: h.fetchSyncStatusMock,
    submitSyncQna: vi.fn(),
    submitSyncOtp: vi.fn(),
    submitSyncCaptcha: vi.fn(),
    cancelSync: h.cancelSyncMock,
    cancelSyncChallenge: h.cancelSyncChallengeMock,
}));

vi.mock("@/components/shared/dialog", () => ({ useDialog: () => ({ open: h.dialogOpenMock }) }));
vi.mock("@/hooks/useStickyLoading", () => ({ useStickyLoading: (v: boolean) => v }));
vi.mock("@/lib/i18n", () => ({
    useTranslation: () => ({
        t: (key: string, vars?: Record<string, string>) =>
            vars ? Object.values(vars).join("/") : key,
        locale: "en",
    }),
}));
vi.mock("@/lib/nxisas/nxisas-debug", () => ({ nxisasDebug: vi.fn() }));
vi.mock("@/lib/currency", () => ({ formatAmount: () => "0" }));
vi.mock("@/lib/i18n/scrapingResultCodes", () => ({ lookupScrapingResultMessage: () => null }));
vi.mock("@/components/shared/InteractiveDateRangePicker", () => ({ default: () => null }));
vi.mock("@/components/shared/Tooltip", () => ({
    default: ({ content, children }: { content?: string | null; children: React.ReactNode }) => (
        <>
            {children}
            {content ? <span data-testid="tooltip-content">{content}</span> : null}
        </>
    ),
}));
vi.mock("@/components/shared/InfoIcon", () => ({ default: () => null }));
vi.mock("./LatestTransactionHistoryModal", () => ({ default: () => null }));
vi.mock("./SyncHistoryDialog", () => ({ default: () => null }));

// Interactive challenge mocks — Cancel + X both call the dialog's onCancel
// (the real dialogs route Cancel / X / overlay / ESC through the same onCancel).
type ChallengeMockProps = { onCancel: () => void };
vi.mock("@/app/(dashboard)/banking/credentials/QnaDialog", () => ({
    QnaDialog: (p: ChallengeMockProps) => (
        <div>
            <button data-testid="qna-cancel" onClick={() => p.onCancel()}>qna-cancel</button>
            <button data-testid="qna-x" onClick={() => p.onCancel()}>qna-x</button>
        </div>
    ),
}));
vi.mock("@/app/(dashboard)/banking/credentials/OtpDialog", () => ({
    OtpDialog: (p: ChallengeMockProps) => (
        <div>
            <button data-testid="otp-cancel" onClick={() => p.onCancel()}>otp-cancel</button>
            <button data-testid="otp-x" onClick={() => p.onCancel()}>otp-x</button>
        </div>
    ),
}));
vi.mock("@/app/(dashboard)/banking/credentials/CaptchaDialog", () => ({
    CaptchaDialog: (p: ChallengeMockProps) => (
        <div>
            <button data-testid="captcha-cancel" onClick={() => p.onCancel()}>captcha-cancel</button>
            <button data-testid="captcha-x" onClick={() => p.onCancel()}>captcha-x</button>
        </div>
    ),
}));

const PROGRESS_FILL = "sync-progress-fill";
const SYNC_BUTTON = { name: "account_inquiry.sync.sync" };
const CANCEL_BUTTON = { name: "account_inquiry.sync.cancel" };

const ACCOUNTS: SyncSelectedAccount[] = [
    { id: "1", bankCd: "11704088", bankName: "Shinhan VN", accountNo: "1111", currencyCd: "VND" },
];

function statusRes(over: Partial<ApiSyncStatusResponse>): ApiSyncStatusResponse {
    return {
        session_id: "sess-1",
        status: "RUNNING",
        progress: 0,
        current_phase: null,
        completed_accounts: 0,
        total_accounts: 1,
        success_accounts: 0,
        failed_accounts: 0,
        currency_summaries: [],
        failed_account_details: null,
        challenge: null,
        accounts_synced: null,
        debit_count: null,
        credit_count: null,
        debit_total: null,
        credit_total: null,
        last_update: null,
        auto_matched_count: null,
        auto_match_enabled: null,
        error_code: null,
        error_message: null,
        ...over,
    };
}

function challengeRes(kind: "QNA" | "OTP" | "CAPTCHA"): ApiSyncStatusResponse {
    const status = kind === "OTP" ? "OTP_REQUIRED"
        : kind === "QNA" ? "QNA_REQUIRED" : "CAPTCHA_REQUIRED";
    return statusRes({
        status,
        progress: 25,
        challenge: {
            kind, prompt: "prompt", qna_questions: kind === "QNA" ? [] : null,
            captcha_image: kind === "CAPTCHA" ? "img" : null,
            captcha_image_format: null, login_id: "user1",
        },
    });
}

function renderDialog(onClose = vi.fn(), onSyncComplete = vi.fn()) {
    return render(
        <TransactionSyncDialog
            selectedAccounts={ACCOUNTS}
            onClose={onClose}
            onSyncComplete={onSyncComplete}
        />,
    );
}

async function startSync() {
    await act(async () => {
        fireEvent.click(screen.getByRole("button", SYNC_BUTTON));
    });
}

async function tick() {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(750);
    });
}

function dialogsOfType(type: string) {
    return h.dialogOpenMock.mock.calls.map((c) => c[0]).filter((o) => o?.type === type);
}
function lastConfirm() {
    const c = dialogsOfType("confirmation");
    return c[c.length - 1] as { description: string; onConfirm?: () => void; onCancel?: () => void };
}
/** The whole-session-cancel Information dialog (WBI1123) — a "success" dialog
 *  whose description is the cancel_success key (distinct from the completion
 *  summary, whose description is the interpolated Success/Failed string). */
function lastCancelInfo() {
    const c = dialogsOfType("success").filter((o) => o?.description === "account_inquiry.sync.cancel_success");
    return c[c.length - 1] as { description: string; onConfirm?: () => void };
}
/** Completion summary dialogs (Success X / Failed Y) — "success" dialogs that
 *  are NOT the cancel Information dialog. */
function completionSummaryCount() {
    return dialogsOfType("success").filter((o) => o?.description !== "account_inquiry.sync.cancel_success").length;
}

beforeEach(() => {
    vi.useFakeTimers();
    h.syncTransactionsMock.mockReset().mockResolvedValue(
        statusRes({ status: "RUNNING", progress: 0, total_accounts: 1 }));
    h.fetchSyncStatusMock.mockReset();
    h.cancelSyncMock.mockReset().mockResolvedValue(statusRes({ status: "CANCELLED" }));
    h.cancelSyncChallengeMock.mockReset().mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
    h.dialogOpenMock.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("TransactionSyncDialog — initial + start (Phase 2)", () => {
    it("idle: blue fill at 0% over the #f5f5f5 track, Sync available", () => {
        renderDialog();
        const fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("0%");
        expect(fill.className).toContain("bg-brand");
        expect(fill.parentElement?.className).toContain("bg-[#f5f5f5]");
        expect(screen.getByRole("button", SYNC_BUTTON)).toBeTruthy();
    });

    it("start: calls start endpoint, shows Cancel, begins polling", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
        renderDialog();
        await startSync();

        expect(h.syncTransactionsMock).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", CANCEL_BUTTON)).toBeTruthy();

        await tick();
        expect(h.fetchSyncStatusMock).toHaveBeenCalledWith("sess-1");
        expect(screen.getByTestId(PROGRESS_FILL).style.width).toBe("25%");
    });
});

describe("TransactionSyncDialog — real progress + no rewind", () => {
    it("width follows backend progress 25 → 50 → (stale 40 ignored) → 100", async () => {
        h.fetchSyncStatusMock
            .mockResolvedValueOnce(statusRes({ status: "RUNNING", progress: 25 }))
            .mockResolvedValueOnce(statusRes({ status: "RUNNING", progress: 50 }))
            .mockResolvedValueOnce(statusRes({ status: "RUNNING", progress: 40 }))
            .mockResolvedValueOnce(statusRes({
                status: "COMPLETED", progress: 100, completed_accounts: 1,
                success_accounts: 1, accounts_synced: 1,
            }));
        renderDialog(vi.fn(), vi.fn());
        await startSync();

        await tick();
        expect(screen.getByTestId(PROGRESS_FILL).style.width).toBe("25%");
        await tick();
        expect(screen.getByTestId(PROGRESS_FILL).style.width).toBe("50%");
        await tick();
        expect(screen.getByTestId(PROGRESS_FILL).style.width).toBe("50%");
        await tick();
        const fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("100%");
        expect(fill.className).toContain("bg-brand");
    });

    it("shows the live completed/total counter from the backend", async () => {
        h.syncTransactionsMock.mockResolvedValue(
            statusRes({ status: "RUNNING", progress: 0, total_accounts: 3 }));
        h.fetchSyncStatusMock.mockResolvedValue(
            statusRes({ status: "RUNNING", progress: 33, total_accounts: 3, completed_accounts: 1 }));
        renderDialog();
        await startSync();
        await tick();
        expect(screen.getByText("1/3")).toBeTruthy();
    });
});

describe("TransactionSyncDialog — terminal states stop polling", () => {
    it("success: 100% blue, completion dialog, polling stops, onSyncComplete", async () => {
        const onSyncComplete = vi.fn();
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({
            status: "COMPLETED", progress: 100, completed_accounts: 1, accounts_synced: 1,
        }));
        renderDialog(vi.fn(), onSyncComplete);
        await startSync();
        await tick();

        expect(onSyncComplete).toHaveBeenCalled();
        expect(screen.getByTestId(PROGRESS_FILL).style.width).toBe("100%");
        expect(completionSummaryCount()).toBe(1);

        const callsAfterComplete = h.fetchSyncStatusMock.mock.calls.length;
        await tick();
        await tick();
        expect(h.fetchSyncStatusMock.mock.calls.length).toBe(callsAfterComplete);
    });

    it("completion dialog fires exactly once", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({
            status: "COMPLETED", progress: 100, completed_accounts: 1, accounts_synced: 1,
        }));
        renderDialog();
        await startSync();
        await tick();
        expect(completionSummaryCount()).toBe(1);
        await tick();
        await tick();
        expect(completionSummaryCount()).toBe(1);
    });

    it("failure: red fill at 100%, error dialog, polling stops", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({
            status: "FAILED", progress: 100, error_code: "WBE2095", error_message: "bank rejected",
        }));
        renderDialog();
        await startSync();
        await tick();

        const fill = screen.getByTestId(PROGRESS_FILL);
        expect(fill.style.width).toBe("100%");
        expect(fill.className).toContain("bg-wb-status-rejected-text");
        expect(h.dialogOpenMock).toHaveBeenCalledWith(
            expect.objectContaining({ type: "error", errorCode: "WBE2095" }));

        const calls = h.fetchSyncStatusMock.mock.calls.length;
        await tick();
        expect(h.fetchSyncStatusMock.mock.calls.length).toBe(calls);
    });

    it("challenge (OTP_REQUIRED) pauses polling and preserves progress", async () => {
        h.fetchSyncStatusMock
            .mockResolvedValueOnce(statusRes({ status: "RUNNING", progress: 25 }))
            .mockResolvedValueOnce(challengeRes("OTP"));
        renderDialog();
        await startSync();
        await tick();
        await tick();

        expect(screen.getByTestId(PROGRESS_FILL).style.width).toBe("25%");
        const calls = h.fetchSyncStatusMock.mock.calls.length;
        await tick();
        await tick();
        expect(h.fetchSyncStatusMock.mock.calls.length).toBe(calls);
    });

    it("ignores a stale response from a different session id", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({
            session_id: "OLD", status: "COMPLETED", progress: 100, accounts_synced: 1,
        }));
        renderDialog();
        await startSync();
        await tick();
        expect(completionSummaryCount()).toBe(0);
    });
});

describe("TransactionSyncDialog — CASE 1 main Cancel / X (whole-session)", () => {
    it("Cancel: confirm → cancelSync → 'inquiry canceled' Information dialog → OK resets; no completion summary", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
        renderDialog();
        await startSync();
        await tick();

        fireEvent.click(screen.getByRole("button", CANCEL_BUTTON));
        expect(lastConfirm().description).toBe("account_inquiry.sync.cancel_confirm");

        await act(async () => { lastConfirm().onConfirm!(); }); // Yes → cancel + info dialog
        expect(h.cancelSyncMock).toHaveBeenCalledWith("sess-1");
        expect(h.cancelSyncChallengeMock).not.toHaveBeenCalled();
        expect(lastCancelInfo().description).toBe("account_inquiry.sync.cancel_success");
        expect(completionSummaryCount()).toBe(0);            // NOT the Success/Failed summary
        expect(screen.queryByRole("button", SYNC_BUTTON)).toBeNull(); // not reset until OK

        act(() => { lastCancelInfo().onConfirm!(); });        // OK → reset to READY
        expect(screen.queryByRole("button", SYNC_BUTTON)).not.toBeNull();
        expect(screen.getByTestId(PROGRESS_FILL).style.width).toBe("0%");
        expect(screen.queryByText(/undefined/i)).toBeNull();
    });

    it("Cancel confirmation pauses polling; a queued COMPLETED cannot replace it; No resumes", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
        renderDialog();
        await startSync();
        await tick();

        fireEvent.click(screen.getByRole("button", CANCEL_BUTTON));
        const confirm = lastConfirm();
        const callsWhenOpened = h.fetchSyncStatusMock.mock.calls.length;

        h.fetchSyncStatusMock.mockResolvedValue(statusRes({
            status: "COMPLETED", progress: 100, accounts_synced: 1, completed_accounts: 1,
        }));
        await tick();
        await tick();
        expect(h.fetchSyncStatusMock.mock.calls.length).toBe(callsWhenOpened);
        expect(completionSummaryCount()).toBe(0);

        await act(async () => { confirm.onCancel!(); }); // No → resume
        await tick();
        expect(h.fetchSyncStatusMock.mock.calls.length).toBeGreaterThan(callsWhenOpened);
    });

    it("Yes cancels and a late COMPLETED is ignored (no completion summary)", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
        renderDialog();
        await startSync();
        await tick();

        fireEvent.click(screen.getByRole("button", CANCEL_BUTTON));
        await act(async () => { lastConfirm().onConfirm!(); });
        expect(h.cancelSyncMock).toHaveBeenCalledWith("sess-1");

        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "COMPLETED", progress: 100 }));
        const calls = h.fetchSyncStatusMock.mock.calls.length;
        await tick();
        await tick();
        expect(h.fetchSyncStatusMock.mock.calls.length).toBe(calls);
        expect(completionSummaryCount()).toBe(0);
    });

    it("X while running: confirm → cancelSync → Information → OK resets, closes, refreshes parent", async () => {
        const onClose = vi.fn();
        const onSyncComplete = vi.fn();
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
        renderDialog(onClose, onSyncComplete);
        await startSync();
        await tick();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(lastConfirm().description).toBe("account_inquiry.sync.close_confirm");
        await act(async () => { lastConfirm().onConfirm!(); });
        expect(h.cancelSyncMock).toHaveBeenCalledWith("sess-1");
        expect(onClose).not.toHaveBeenCalled(); // not closed until Information OK

        act(() => { lastCancelInfo().onConfirm!(); });
        expect(onClose).toHaveBeenCalled();
        expect(onSyncComplete).toHaveBeenCalled(); // parent Account Inquiry list refreshed
    });

    it("X while running: No keeps the popup open and resumes polling", async () => {
        const onClose = vi.fn();
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
        renderDialog(onClose);
        await startSync();
        await tick();

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        const callsWhenOpened = h.fetchSyncStatusMock.mock.calls.length;
        await act(async () => { lastConfirm().onCancel!(); });
        expect(onClose).not.toHaveBeenCalled();
        expect(h.cancelSyncMock).not.toHaveBeenCalled();
        await tick();
        expect(h.fetchSyncStatusMock.mock.calls.length).toBeGreaterThan(callsWhenOpened);
    });
});

describe("TransactionSyncDialog — CASE 2 challenge Cancel / X (account-level LOGIN_CAN, continues)", () => {
    async function reachChallenge(kind: "QNA" | "OTP" | "CAPTCHA") {
        h.fetchSyncStatusMock
            .mockResolvedValueOnce(statusRes({ status: "RUNNING", progress: 25 }))
            .mockResolvedValueOnce(challengeRes(kind));
        renderDialog();
        await startSync();
        await tick(); // RUNNING
        await tick(); // *_REQUIRED → challenge dialog renders, polling paused
    }

    const cases: Array<{ kind: "QNA" | "OTP" | "CAPTCHA"; trigger: "cancel" | "x"; testId: string }> = [
        { kind: "QNA", trigger: "cancel", testId: "qna-cancel" },
        { kind: "QNA", trigger: "x", testId: "qna-x" },
        { kind: "OTP", trigger: "cancel", testId: "otp-cancel" },
        { kind: "OTP", trigger: "x", testId: "otp-x" },
        { kind: "CAPTCHA", trigger: "cancel", testId: "captcha-cancel" },
        { kind: "CAPTCHA", trigger: "x", testId: "captcha-x" },
    ];

    for (const { kind, trigger, testId } of cases) {
        it(`${kind} ${trigger}: confirm, No keeps challenge, Yes → account-level LOGIN_CAN + batch continues + completion summary`, async () => {
            await reachChallenge(kind);
            expect(screen.getByTestId(testId)).toBeTruthy();

            // Cancel/X → confirmation; NO backend call yet; whole-session cancel never used.
            fireEvent.click(screen.getByTestId(testId));
            expect(lastConfirm()).toBeTruthy();
            expect(h.cancelSyncChallengeMock).not.toHaveBeenCalled();
            expect(h.cancelSyncMock).not.toHaveBeenCalled();

            // No → challenge dialog stays open (onCancel is a no-op for challenge confirm).
            act(() => { lastConfirm().onCancel?.(); });
            expect(screen.getByTestId(testId)).toBeTruthy();
            expect(h.cancelSyncChallengeMock).not.toHaveBeenCalled();

            // Yes → account-level challenge cancel; challenge cleared; batch continues.
            fireEvent.click(screen.getByTestId(testId));
            await act(async () => { lastConfirm().onConfirm!(); });
            expect(h.cancelSyncChallengeMock).toHaveBeenCalledWith("sess-1");
            expect(h.cancelSyncMock).not.toHaveBeenCalled();     // NOT a whole-session cancel
            expect(screen.queryByTestId(testId)).toBeNull();     // challenge cleared
            // Popup did NOT reset — still scraping (Cancel button, not Sync).
            expect(screen.queryByRole("button", SYNC_BUTTON)).toBeNull();

            // Batch finishes → the normal "Success X / Failed Y" completion summary.
            h.fetchSyncStatusMock.mockResolvedValue(statusRes({
                status: "COMPLETED", progress: 100, completed_accounts: 1,
                success_accounts: 0, accounts_synced: 0, failed_accounts: 1,
                currency_summaries: [{
                    ccy_cd: "VND", success_count: 0, failed_count: 1,
                    credit_count: 0, credit_total: "0", debit_count: 0, debit_total: "0",
                    auto_matched_count: 0,
                }],
            }));
            await tick();
            expect(completionSummaryCount()).toBeGreaterThan(0);
            expect(screen.queryByText(/undefined/i)).toBeNull(); // LOGIN_CAN never renders "undefined"
        });
    }
});

describe("TransactionSyncDialog — LOGIN_CAN failed-account tooltip", () => {
    it("renders '[Bank Account] {message} (LOGIN_CAN)' on the Failed count, never 'undefined'", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({
            status: "COMPLETED", progress: 100, completed_accounts: 1,
            success_accounts: 0, accounts_synced: 0, failed_accounts: 1,
            currency_summaries: [{
                ccy_cd: "VND", success_count: 0, failed_count: 1,
                credit_count: 0, credit_total: "0", debit_count: 0, debit_total: "0",
                auto_matched_count: 0,
            }],
            failed_account_details: [{
                bank_cd: "11704088", acct_no: "1111", ccy_cd: "VND",
                error_code: "LOGIN_CAN", error_message: "Login inquiry was cancelled.",
            }],
        }));
        renderDialog();
        await startSync();
        await tick(); // → COMPLETED

        // Multiple tooltips exist (e.g. the Auto-checkbox hint) — pick the
        // failed-account one by its LOGIN_CAN content.
        const tips = screen.getAllByTestId("tooltip-content");
        const failedTip = tips.find((el) => el.textContent?.includes("LOGIN_CAN"));
        expect(failedTip).toBeTruthy();
        expect(failedTip!.textContent).toContain("[Shinhan VN 1111]"); // bank name + account number
        expect(failedTip!.textContent).toContain("(LOGIN_CAN)");       // code suffix
        expect(failedTip!.textContent).not.toContain("undefined");     // never raw undefined
    });

    it("shows no failed tooltip when there are no per-account failures", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({
            status: "COMPLETED", progress: 100, completed_accounts: 1,
            success_accounts: 1, accounts_synced: 1, failed_accounts: 0,
            currency_summaries: [{
                ccy_cd: "VND", success_count: 1, failed_count: 0,
                credit_count: 0, credit_total: "0", debit_count: 0, debit_total: "0",
                auto_matched_count: 0,
            }],
        }));
        renderDialog();
        await startSync();
        await tick();
        // No LOGIN_CAN failed-account tooltip (other tooltips, e.g. the Auto
        // hint, may still exist — assert none carries a LOGIN_CAN detail).
        const tips = screen.queryAllByTestId("tooltip-content");
        expect(tips.some((el) => el.textContent?.includes("LOGIN_CAN"))).toBe(false);
    });
});

describe("TransactionSyncDialog — cleanup", () => {
    it("unmount stops polling (no fetch after unmount)", async () => {
        h.fetchSyncStatusMock.mockResolvedValue(statusRes({ status: "RUNNING", progress: 25 }));
        const { unmount } = renderDialog();
        await startSync();
        await tick();
        const calls = h.fetchSyncStatusMock.mock.calls.length;

        unmount();
        await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
        expect(h.fetchSyncStatusMock.mock.calls.length).toBe(calls);
    });
});
