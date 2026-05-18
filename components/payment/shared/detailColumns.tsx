"use client";

import { ChevronDown, Info, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import PaymentResultBadge from "./PaymentResultBadge";
import type { DetailTransaction } from "./detailMocks";
import type { PaymentListColumn } from "./types";

type Translator = (key: string, params?: Record<string, string>) => string;

export type ChartAccountOption = {
    code: string;
    nameEn: string;
    seqNo: string;
};

type ReportingAccountCellProps = {
    row: DetailTransaction;
    accounts?: ChartAccountOption[];
    onSelect?: (rowId: string, code: string | null) => void;
};

/**
 * Reporting Account cell — interactive dropdown that lets the user pick
 * a chart-of-accounts code. Opens an inline popover anchored to the cell.
 */
function ReportingAccountCell({ row, accounts, onSelect }: ReportingAccountCellProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const filtered = (accounts ?? []).filter((a) => {
        const q = query.toLowerCase();
        return a.code.toLowerCase().includes(q) || a.nameEn.toLowerCase().includes(q);
    });

    const handleSelect = (code: string | null) => {
        setOpen(false);
        setQuery("");
        onSelect?.(row.id, code);
    };

    const trigger = row.reportingAccountUnassigned ? (
        <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-0.5 text-wb-13 font-medium text-brand hover:underline"
        >
            <span>Select Account</span>
            <ChevronDown className="size-3.5 shrink-0" strokeWidth={2} />
        </button>
    ) : (
        <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex flex-col gap-0.5 text-left"
        >
            <span className="flex items-center gap-0.5 text-wb-13 font-medium text-wb-ink">
                {row.reportingAccount}
                <ChevronDown className="size-3.5 shrink-0" strokeWidth={2} />
            </span>
            {row.reportingAccountBreadcrumb && (
                <span className="text-wb-12 font-medium text-wb-ntrl-6">
                    {row.reportingAccountBreadcrumb}
                </span>
            )}
        </button>
    );

    return (
        <div ref={ref} className="relative">
            {trigger}
            {open && (
                <div
                    className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-wb-ntrl-3 bg-white shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Search */}
                    <div className="flex items-center gap-1.5 border-b border-wb-ntrl-3 px-2 py-1.5">
                        <Search className="size-3.5 shrink-0 text-wb-ntrl-5" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search code or name…"
                            className="flex-1 bg-transparent text-wb-13 outline-none placeholder:text-wb-ntrl-4"
                        />
                        {query && (
                            <button type="button" onClick={() => setQuery("")}>
                                <X className="size-3.5 text-wb-ntrl-5" />
                            </button>
                        )}
                    </div>
                    {/* List */}
                    <ul className="max-h-52 overflow-y-auto py-1 text-wb-13">
                        {!row.reportingAccountUnassigned && (
                            <li>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(null)}
                                    className="w-full px-3 py-1.5 text-left text-wb-ntrl-5 hover:bg-wb-ntrl-1"
                                >
                                    — Clear selection
                                </button>
                            </li>
                        )}
                        {filtered.length === 0 && (
                            <li className="px-3 py-2 text-wb-ntrl-5">No results</li>
                        )}
                        {filtered.map((a) => (
                            <li key={a.seqNo}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(a.code)}
                                    className="w-full px-3 py-1.5 text-left hover:bg-wb-ntrl-1"
                                >
                                    <span className="font-medium text-wb-ink">{a.code}</span>
                                    <span className="ml-1.5 text-wb-ntrl-6">{a.nameEn}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

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
 * Column definition for the Scheduled-detail inner transaction table —
 * mirrors Figma 8:599:
 * Deposit Bank | Recipient Name | Transfer Amount | Remarks ⓘ |
 * Reporting Account | Description | Document No. | Banking Transaction ID
 *
 * Result-detail variants add a Date/Time column on the left and swap
 * Reporting Account / Description for a Results badge — handled by
 * `resultDetailColumns` below.
 *
 * Pass `accounts` + `onSelectReportingAccount` to enable the inline
 * chart-of-accounts picker on the Reporting Account cell.
 */
export function scheduledDetailColumns(
    t: Translator,
    options?: {
        accounts?: ChartAccountOption[];
        onSelectReportingAccount?: (rowId: string, code: string | null) => void;
    },
): PaymentListColumn<DetailTransaction>[] {
    return [
        {
            key: "depositBank",
            label: t("payment.detail.col.deposit_bank"),
            width: "214px",
            sortable: true,
        },
        {
            key: "recipientName",
            label: t("payment.detail.col.recipient_name"),
            width: "200px",
            sortable: true,
        },
        {
            key: "transferAmount",
            label: t("payment.detail.col.transfer_amount"),
            align: "right",
            width: "138px",
            sortable: true,
            // Pre-formatted display string (e.g. "1,000.00") — sort by the
            // underlying numeric value so 10 < 100 instead of "10" > "100".
            sortValue: (row) =>
                Number((row.transferAmount ?? "").replace(/[^\d.-]/g, "")) || 0,
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
            sortable: true,
        },
        {
            key: "reportingAccount",
            label: t("payment.detail.col.reporting_account"),
            width: "220px",
            render: (row) => (
                <ReportingAccountCell
                    row={row}
                    accounts={options?.accounts}
                    onSelect={options?.onSelectReportingAccount}
                />
            ),
            sortable: true,
        },
        {
            key: "description",
            label: t("payment.detail.col.description"),
            width: "180px",
            sortable: true,
        },
        {
            key: "documentNo",
            label: t("payment.detail.col.document_no"),
            width: "140px",
            sortable: true,
        },
        {
            key: "bankingTxnId",
            label: t("payment.detail.col.banking_txn_id"),
            width: "175px",
            sortable: true,
        },
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

/**
 * Beneficiary Bank cell for Overseas Payment detail — Figma 29:17560:
 *   line 1: bank name (bnfc_bank_nm)
 *   line 2: BIC code (bic_cd), muted
 */
function BeneficiaryBankCell({ row }: { row: DetailTransaction }) {
    if (!row.depositBankName && !row.depositBankCode) {
        return (
            <span className="block truncate text-wb-13 font-medium text-wb-ink">
                {row.depositBank}
            </span>
        );
    }
    return (
        <div className="flex flex-col gap-0.5">
            {row.depositBankName && (
                <span className="text-wb-13 font-medium text-wb-ink">
                    {row.depositBankName}
                </span>
            )}
            {row.depositBankCode && (
                <span className="text-wb-12 font-normal text-wb-ntrl-6">
                    {row.depositBankCode}
                </span>
            )}
        </div>
    );
}

/**
 * Column definition for Overseas Payment Result detail — Figma 29:17560.
 *
 * Thirteen columns mirroring the live JEX overseas result detail view:
 *   Transaction Seq | Beneficiary Name | Beneficiary Bank Name |
 *   Beneficiary Account No. | Beneficiary Address | Transfer Currency |
 *   Transfer Amount | Fee Payer | Memo | Reporting Account | Status |
 *   Result Date/Time | Banking Transaction ID
 */
export function overseasResultDetailColumns(
    t: Translator,
): PaymentListColumn<DetailTransaction>[] {
    return [
        {
            key: "trnSeq",
            label: t("payment.overseas.col.trn_seq"),
            width: "120px",
        },
        {
            key: "recipientName",
            label: t("payment.overseas.col.beneficiary_name"),
            width: "180px",
        },
        {
            key: "depositBankName",
            label: t("payment.overseas.col.beneficiary_bank_name"),
            width: "200px",
            render: (row) => <BeneficiaryBankCell row={row} />,
        },
        {
            key: "accountNo",
            label: t("payment.overseas.col.beneficiary_account_no"),
            width: "180px",
        },
        {
            key: "bnfcAddr",
            label: t("payment.overseas.col.beneficiary_address"),
            width: "220px",
        },
        {
            key: "depositBankCurrency",
            label: t("payment.overseas.col.transfer_currency"),
            width: "140px",
        },
        {
            key: "transferAmount",
            label: t("payment.overseas.col.transfer_amount"),
            align: "right",
            width: "138px",
        },
        {
            key: "feePayer",
            label: t("payment.overseas.col.fee_payer"),
            width: "110px",
        },
        {
            key: "remark",
            label: t("payment.overseas.col.memo"),
            width: "200px",
        },
        {
            key: "reportingAccount",
            label: t("payment.overseas.col.reporting_account"),
            width: "220px",
            render: (row) => <ResultReportingAccountCell row={row} />,
        },
        {
            key: "result",
            label: t("payment.overseas.col.status"),
            width: "120px",
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
export const OVERSEAS_RESULT_DETAIL_MIN_WIDTH = "1948px";
