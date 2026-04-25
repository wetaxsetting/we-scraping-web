import type { ApprovalStatus } from "@/components/payment/approval-box/types";

import type { CurrencyTotal, ResultStatus } from "./types";

/**
 * Mock helpers shared by every Sprint 2 payment list page. The static rows
 * mirror the Approval Box sample (same dates, currencies, requestor) so the
 * pages render with consistent demo data — easier to verify the visual rule
 * across all 12 screens at once.
 */

export const mockApprovalStatuses: ApprovalStatus[] = [
    "in_progress",
    "approved",
    "pending",
    "rejected",
    "draft",
];

export const mockResultStatuses: ResultStatus[] = [
    "success",
    "failed",
    "pending",
    "cancelled",
    "success",
];

export const mockCurrencyTotalsVnd: CurrencyTotal[] = [
    { currency: "USD", total: "0" },
    { currency: "VND", total: "10.000.000" },
    { currency: "KRW", total: "0" },
];

export const mockCurrencyTotalsUsd: CurrencyTotal[] = [
    { currency: "USD", total: "12,500.00" },
    { currency: "VND", total: "0" },
    { currency: "KRW", total: "0" },
];
