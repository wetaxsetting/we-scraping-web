import { ChevronDown, Info } from "lucide-react";

import PaymentResultBadge from "./PaymentResultBadge";
import type { DetailTransaction } from "./detailMocks";
import type { PaymentListColumn } from "./types";

type Translator = (key: string, params?: Record<string, string>) => string;

/**
 * Renders a multi-line bank label used in detail tables — Figma 1:13476:
 *   line 1: "970458 - SHINHAN  [bank glyph] USD"
 *   line 2: "40010023456914"  (account number, muted)
 * Falls back to a single line when the row only has the legacy
 * "code - bank" string (Scheduled detail compatibility).
 */
function DepositBankCell({ row }: { row: DetailTransaction }) {
    if (row.depositBankCode && row.depositBankName) {
        return (
            <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-wb-13 font-medium text-wb-ink">
                    <span>
                        {row.depositBankCode} - {row.depositBankName}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/table/ico-building.svg"
                        alt=""
                        aria-hidden
                        className="size-3.5 shrink-0 opacity-60"
                    />
                    {row.depositBankCurrency && (
                        <span className="text-wb-13 font-medium text-wb-ntrl-6">
                            {row.depositBankCurrency}
                        </span>
                    )}
                </span>
                {row.accountNo && (
                    <span className="text-wb-12 font-normal text-wb-ntrl-6">
                        {row.accountNo}
                    </span>
                )}
            </div>
        );
    }
    return (
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
            {row.depositBank}
        </span>
    );
}

/**
 * Two-line Date/Time renderer used by Result detail tables. Splits on `\n`
 * — line 1 is the date in ink, line 2 is the time in muted neutral.
 */
function DateTimeStack({ value }: { value: string | undefined }) {
    if (!value) return null;
    const [line1, line2] = value.split("\n");
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-wb-13 font-medium text-wb-ink">{line1}</span>
            {line2 && (
                <span className="text-wb-12 font-normal text-wb-ntrl-6">{line2}</span>
            )}
        </div>
    );
}

/**
 * Static reporting-account cell for Result detail (no chevron, no
 * "Select Account" placeholder — the row has already been processed by
 * the bank, so the value is read-only).
 */
function ResultReportingAccountCell({ row }: { row: DetailTransaction }) {
    if (!row.reportingAccount) return null;
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-wb-13 font-medium text-wb-ink">
                {row.reportingAccount}
            </span>
            {row.reportingAccountBreadcrumb && (
                <span className="text-wb-12 font-normal text-wb-ntrl-6">
                    {row.reportingAccountBreadcrumb}
                </span>
            )}
        </div>
    );
}

/**
 * Banking Transaction ID cell — Figma 1:13476:
 *   • populated → render the ID
 *   • empty + result === "success" → render a "Match" CTA
 *   • empty otherwise → blank
 *
 * The Match button is the canonical Internal Transfer Result detail
 * affordance: a successful bank transaction with no matched txn ID is
 * the row that needs reconciliation.
 */
function BankingTxnIdCell({
    row,
    matchLabel,
}: {
    row: DetailTransaction;
    matchLabel: string;
}) {
    if (row.bankingTxnId) {
        return (
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {row.bankingTxnId}
            </span>
        );
    }
    if (row.result === "success") {
        return (
            <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-7 cursor-pointer items-center rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-neutral-50"
            >
                {matchLabel}
            </button>
        );
    }
    return null;
}

/**
 * Reporting Account cell — two states per Figma 8:599:
 *   • Unassigned → "Select Account ↓" in brand blue (interactive placeholder).
 *   • Assigned   → "Code - Name ↓" with a muted breadcrumb sub-line.
 *
 * Row-level yellow highlight for assigned rows is applied via getRowClass in
 * ScheduledTransferDetailPage — this render fn only owns the cell content.
 */
function ReportingAccountCell({ row }: { row: DetailTransaction }) {
    if (row.reportingAccountUnassigned) {
        return (
            <button
                type="button"
                className="flex cursor-pointer items-center gap-0.5 text-wb-13 font-medium text-brand hover:underline"
            >
                <span>Select Account</span>
                <ChevronDown className="size-3.5 shrink-0" strokeWidth={2} />
            </button>
        );
    }
    return (
        <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-0.5 text-wb-13 font-medium text-wb-ink">
                {row.reportingAccount}
                <ChevronDown className="size-3.5 shrink-0" strokeWidth={2} />
            </span>
            {row.reportingAccountBreadcrumb && (
                <span className="text-wb-12 font-medium text-wb-ntrl-6">
                    {row.reportingAccountBreadcrumb}
                </span>
            )}
        </div>
    );
}

/**
 * Column definition for the Scheduled-detail inner transaction table —
 * mirrors Figma 8:599:
 * Deposit Bank | Recipient Name | Transfer Amount | Remarks ⓘ |
 * Reporting Account | Description | Document No. | Banking Transaction ID
 *
 * Result-detail variants add a Date/Time column on the left and swap
 * Reporting Account / Description for a Results badge — handled by
 * `resultDetailColumns` below.
 */
export function scheduledDetailColumns(
    t: Translator,
): PaymentListColumn<DetailTransaction>[] {
    return [
        { key: "depositBank", label: t("payment.detail.col.deposit_bank"), width: "214px" },
        { key: "recipientName", label: t("payment.detail.col.recipient_name"), width: "200px" },
        {
            key: "transferAmount",
            label: t("payment.detail.col.transfer_amount"),
            align: "right",
            width: "138px",
        },
        {
            key: "remark",
            // Figma 8:599 — Remarks header includes an info icon (ico_question)
            label: (
                <span className="flex items-center gap-1">
                    {t("payment.detail.col.remark")}
                    <Info className="size-3.5 shrink-0 text-wb-ntrl-5" strokeWidth={1.8} />
                </span>
            ),
            width: "260px",
        },
        {
            key: "reportingAccount",
            label: t("payment.detail.col.reporting_account"),
            width: "220px",
            render: (row) => <ReportingAccountCell row={row} />,
        },
        { key: "description", label: t("payment.detail.col.description"), width: "180px" },
        { key: "documentNo", label: t("payment.detail.col.document_no"), width: "140px" },
        { key: "bankingTxnId", label: t("payment.detail.col.banking_txn_id"), width: "175px" },
    ];
}

/**
 * Result-detail column set — Figma 1:13476.
 *
 * Eleven columns mirroring the live JEX Result detail (`pymn_0004_002.act`):
 *   Date/Time | Deposit Bank | Recipient Name | Transfer Amount | Remarks ⓘ |
 *   Results | Result Date/Time | Reporting Account | Description |
 *   Document No. | Banking Transaction ID
 *
 * Banking Transaction ID renders a Match CTA when the row is a successful
 * transfer with no matched txn ID (Figma 1:13476 last row). Reporting
 * Account and Date/Time are read-only stacks — Result detail is post-bank,
 * so there is no "Select Account" placeholder, no chevron.
 */
export function resultDetailColumns(
    t: Translator,
): PaymentListColumn<DetailTransaction>[] {
    return [
        {
            key: "dateTime",
            label: t("payment.col.date_time"),
            width: "var(--w-wb-trd-datetime)",
            render: (row) => <DateTimeStack value={row.dateTime} />,
        },
        {
            key: "depositBank",
            label: t("payment.detail.col.deposit_bank"),
            width: "var(--w-wb-trd-deposit-bank)",
            render: (row) => <DepositBankCell row={row} />,
        },
        {
            key: "recipientName",
            label: t("payment.detail.col.recipient_name"),
            width: "var(--w-wb-trd-recipient)",
        },
        {
            key: "transferAmount",
            label: t("payment.detail.col.transfer_amount"),
            align: "right",
            width: "var(--w-wb-trd-amount)",
        },
        {
            key: "remark",
            // Figma 1:13476 — Remarks header includes an info glyph.
            label: (
                <span className="flex items-center gap-1">
                    {t("payment.detail.col.remark")}
                    <Info className="size-3.5 shrink-0 text-wb-ntrl-5" strokeWidth={1.8} />
                </span>
            ),
            width: "var(--w-wb-trd-remark)",
        },
        {
            key: "result",
            label: t("payment.detail.col.results"),
            width: "var(--w-wb-trd-result)",
            render: (row) =>
                row.result ? (
                    <PaymentResultBadge
                        status={row.result}
                        label={t(`payment.result.${row.result}`)}
                    />
                ) : null,
        },
        {
            key: "resultDateTime",
            label: t("payment.detail.col.result_datetime"),
            width: "var(--w-wb-trd-result-datetime)",
            render: (row) => <DateTimeStack value={row.resultDateTime} />,
        },
        {
            key: "reportingAccount",
            label: t("payment.detail.col.reporting_account"),
            width: "var(--w-wb-trd-reporting)",
            render: (row) => <ResultReportingAccountCell row={row} />,
        },
        {
            key: "description",
            label: t("payment.detail.col.description"),
            width: "var(--w-wb-trd-description)",
        },
        {
            key: "documentNo",
            label: t("payment.detail.col.document_no"),
            width: "var(--w-wb-trd-document-no)",
        },
        {
            key: "bankingTxnId",
            label: t("payment.detail.col.banking_txn_id"),
            width: "var(--w-wb-trd-banking-id)",
            render: (row) => (
                <BankingTxnIdCell row={row} matchLabel={t("payment.detail.match")} />
            ),
        },
    ];
}

// Sum of scheduledDetailColumns widths
export const SCHEDULED_DETAIL_MIN_WIDTH = "1527px";
export const RESULT_DETAIL_MIN_WIDTH = "var(--w-wb-trd-table-min)";
