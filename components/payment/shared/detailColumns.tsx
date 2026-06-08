"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import BlockedCharsTooltip from "@/components/shared/BlockedCharsTooltip";
import type { BlockedCharsMap, FieldCd } from "@/lib/api/blockedChars";
import PaymentResultBadge from "./PaymentResultBadge";
import type { DetailTransaction } from "./types";
import type { PaymentListColumn } from "./types";

type Translator = (key: string, params?: Record<string, string>) => string;

export type ChartAccountOption = {
    code: string;
    nameEn: string;
    seqNo: string;
};

/**
 * Render the info glyph next to a column-header label as a hover
 * tooltip. Always renders {@link BlockedCharsTooltip} so the tooltip
 * surfaces on hover/focus on every detail page — regardless of whether
 * the caller passed a bank-specific {@code blockedChars} map.
 *
 * The tooltip body prefers the bank-specific rule from the server and
 * falls back to {@link BlockedCharsTooltip}'s {@code DEFAULT_BLOCKED_CHARS}
 * table when none is registered (or the page hasn't wired
 * {@code useBlockedChars}). Passing {@code {}} when {@code blockedChars}
 * is absent lets the shared component own the fallback — callers that
 * don't fetch the per-bank rule still get the hover tooltip instead of
 * an inert static icon.
 */
function ColumnInfoIcon({
    fieldCd,
    fieldNameKey,
    blockedChars,
}: {
    fieldCd:       FieldCd;
    fieldNameKey:  string;
    blockedChars?: BlockedCharsMap;
}) {
    return (
        <BlockedCharsTooltip
            fieldCd={fieldCd}
            fieldNameKey={fieldNameKey}
            blockedChars={blockedChars ?? {}}
        />
    );
}

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
 * Renders a multi-line bank label used in detail tables — Figma 1:13476
 * + legacy `pymn_0009_003` `TAR_BANK_CD` cell render:
 *   line 1: "970458 - SHINHAN  [bank glyph] USD"
 *   line 2: "40010023456914"  (account number, muted)
 * Falls back to a single line when the row only has the legacy
 * "code - bank" string (Scheduled detail compatibility).
 *
 * <p>Exported so View-Setting-driven detail pages (e.g.
 * Scheduled Transfer detail) can render the canonical combined cell
 * from their per-page {@code COLUMN_REGISTRY}.
 */
export function DepositBankCell({ row }: { row: DetailTransaction }) {
    // Render the multi-line layout whenever ANY of the multi-line slots
    // are populated — bank code, currency, or account number. Legacy
    // `pymn_0009_003.ts:510-518` renders the same multi-line block from
    // partial data (e.g. when the bank-name resolver returns an empty
    // string), and the refactor's per-line wire shape often ships
    // `tarBankCd` + `fincMdaNo` without a resolved `bankNm`. Falling
    // back to the bare `depositBank` string in that case (the previous
    // behaviour) produced a degraded one-line cell with just the bank
    // code, which is what the user flagged.
    const hasAnyMultiLineData =
        !!row.depositBankCode || !!row.depositBankCurrency || !!row.accountNo;

    if (hasAnyMultiLineData) {
        return (
            <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-wb-13 font-medium text-wb-ink">
                    {row.depositBankCode && (
                        <span>
                            {row.depositBankCode}
                            {row.depositBankName ? ` - ${row.depositBankName}` : ""}
                        </span>
                    )}
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

/** Bank-side response codes the legacy live system considers retryable.
 *  Mirror of `pymn_0010_002.ts:441` `validResponseCode`. */
const RERUN_VALID_RS_CDS: ReadonlySet<string> = new Set(["0001", "0002", "0003", "0004", "0005"]);

/**
 * Result-column cell with optional error tooltip — wraps
 * {@link PaymentResultBadge} with a native `title` so the bank-side
 * failure message ({@code RS_MSG}) surfaces on hover. Mirrors legacy
 * `pymn_0010_002.ts:418` (`<div class="error_message">…RS_MSG…</div>`).
 */
function ResultBadgeCell({ row, t }: {
    row: DetailTransaction;
    t: Translator;
}) {
    if (!row.result) return null;
    const badge = (
        <PaymentResultBadge
            status={row.result}
            label={t(`payment.result.${row.result}`)}
        />
    );
    if (row.result === "failed" && row.rsMsg && row.rsMsg.trim().length > 0) {
        return (
            <span title={row.rsMsg} className="inline-flex cursor-help">
                {badge}
            </span>
        );
    }
    return badge;
}

/** True when the row qualifies for the Re-run CTA — RS_CD is in the
 *  transient-failure set AND PROC_DTTM is today. Legacy mirror:
 *  `pymn_0010_002.ts:441-449`. */
function isRerunEligible(row: DetailTransaction): boolean {
    if (!row.rsCd || !RERUN_VALID_RS_CDS.has(row.rsCd)) return false;
    if (!row.procDttm || row.procDttm.length < 8) return false;
    const procDate = row.procDttm.substring(0, 8); // yyyymmdd
    const today = new Date();
    const todayYmd =
        today.getUTCFullYear().toString().padStart(4, "0") +
        (today.getUTCMonth() + 1).toString().padStart(2, "0") +
        today.getUTCDate().toString().padStart(2, "0");
    return procDate === todayYmd;
}

/**
 * Banking Transaction ID cell — Figma 1:13476 + 2026-05-29 Re-run /
 * Unmatch extensions:
 *   • Re-run eligible (RS_CD ∈ {"0001"…"0005"} AND PROC_DTTM today) → Re-run CTA
 *   • LINK_MATCH_YN === "Y" → Unmatch CTA (red outline)
 *   • populated bankingTxnId → render the ID
 *   • empty + result === "success" → render a "Match" CTA
 *   • otherwise → blank
 *
 * Re-run takes priority over both Match and Unmatch since the row is
 * still actively failed. Unmatch takes priority over the ID display
 * because a matched row's ID typically populates from the bank-trsc
 * link itself — legacy parity (`pymn_0010_002.ts:452-457`).
 */
function BankingTxnIdCell({
    row,
    matchLabel,
    unmatchLabel,
    rerunLabel,
    onRerun,
    onMatch,
    onUnmatch,
}: {
    row: DetailTransaction;
    matchLabel: string;
    unmatchLabel?: string;
    rerunLabel?: string;
    onRerun?: (rowId: string) => void;
    /** Per-line Match handler (Internal Transfer + Vendor + Expense). The
     *  second arg is the bounding rect of the clicked Match button so the
     *  caller can anchor the inline banking-match dropdown beneath the cell
     *  (legacy `ShowBankingTransactionDropdownInCell`). When omitted, the
     *  Match CTA stays an inert stub — preserves the read-only behaviour on
     *  sibling modules that have not wired per-line match. */
    onMatch?: (row: DetailTransaction, anchorRect?: DOMRect) => void;
    /** Per-line Unmatch handler (Vendor + Expense). When omitted, the Unmatch
     *  CTA stays inert. */
    onUnmatch?: (row: DetailTransaction) => void;
}) {
    if (rerunLabel && onRerun && isRerunEligible(row)) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onRerun(row.id);
                }}
                className="inline-flex h-7 cursor-pointer items-center rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-neutral-50"
            >
                {rerunLabel}
            </button>
        );
    }
    // Matched — show the banking transaction id + an Unmatch action
    // (legacy `pymn_0008_002.ts:438-451`: matched rows render the id cell
    // alongside the red-outline Unmatch button). The id is omitted when the
    // row carries none.
    if (unmatchLabel && row.linkMatchYn === "Y") {
        return (
            <div className="flex items-center gap-2">
                {row.bankingTxnId && (
                    <span className="block truncate text-wb-13 font-medium text-wb-ink">
                        {row.bankingTxnId}
                    </span>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onUnmatch?.(row);
                    }}
                    className="inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md border border-wb-red-04 bg-white px-3 text-wb-13 font-medium text-wb-red-07 shadow-wb-btn hover:bg-wb-red-04/10"
                >
                    {unmatchLabel}
                </button>
            </div>
        );
    }
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
                onClick={(e) => {
                    e.stopPropagation();
                    onMatch?.(row, e.currentTarget.getBoundingClientRect());
                }}
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
        /**
         * Per-field blocked-chars map from {@code useBlockedChars}. When
         * provided AND the matching field entry is populated, the
         * Recipient Name + Remarks column headers swap their static
         * info icon for a {@link BlockedCharsTooltip}. Omit to keep
         * the legacy placeholder.
         */
        blockedChars?: BlockedCharsMap;
        /**
         * When {@code true} the column factory uses Overseas-flavored
         * field codes for the tooltip — {@code BENA} (Beneficiary Name)
         * + {@code MEMO} instead of the SCDUL_PYMN family's
         * {@code RCPT}/{@code RMKS}. The visible header text stays the
         * same since the Overseas Scheduled detail reuses the generic
         * "Recipient Name" / "Remark" labels.
         */
        overseas?: boolean;
    },
): PaymentListColumn<DetailTransaction>[] {
    const recipientFieldCd: FieldCd = options?.overseas ? "BENA" : "RCPT";
    const remarkFieldCd:    FieldCd = options?.overseas ? "MEMO" : "RMKS";
    const recipientFieldNameKey = options?.overseas
        ? "payment.field.beneficiary_name"
        : "payment.field.recipient_name";
    const remarkFieldNameKey = options?.overseas
        ? "payment.field.memo"
        : "payment.field.remarks";
    return [
        {
            key: "depositBank",
            label: t("payment.detail.col.deposit_bank"),
            width: "214px",
            sortable: true,
            render: (row) => <DepositBankCell row={row} />,
        },
        {
            key: "recipientName",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.detail.col.recipient_name")}
                    <ColumnInfoIcon
                        fieldCd={recipientFieldCd}
                        fieldNameKey={recipientFieldNameKey}
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
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
            // Figma 8:599 — Remarks header includes an info icon (ico_question).
            // When `blockedChars` is supplied the icon becomes a live
            // tooltip surfacing the bank-specific blocked-character set
            // (mirrors legacy `_v2common.app.addHeaderInfoIcon`).
            label: (
                <span className="flex items-center gap-1">
                    {t("payment.detail.col.remark")}
                    <ColumnInfoIcon
                        fieldCd={remarkFieldCd}
                        fieldNameKey={remarkFieldNameKey}
                        blockedChars={options?.blockedChars}
                    />
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
    options?: {
        /**
         * Per-field blocked-chars map from {@code useBlockedChars}. When
         * provided AND the {@code RMKS} entry is populated, the Remarks
         * column header swaps its static info icon for a
         * {@link BlockedCharsTooltip}. Omit to keep the legacy
         * placeholder.
         */
        blockedChars?: BlockedCharsMap;
        /**
         * Re-run click handler. When supplied AND a row qualifies
         * ({@code RS_CD} ∈ transient set + {@code PROC_DTTM} today),
         * the Banking Transaction ID cell renders a Re-run CTA instead
         * of the ID. Mirrors legacy {@code pymn_0010_002.ts:441-472}.
         */
        onRerun?: (lineId: string) => void;
        /**
         * Per-line banking-match handlers (Internal Transfer + Vendor +
         * Expense — legacy {@code comm_0197_*} domestic path). When supplied,
         * the Banking Transaction ID cell's Match / Unmatch CTAs become
         * interactive. The Match handler receives the clicked button's
         * bounding rect so the caller can anchor the inline banking-match
         * dropdown beneath the cell (legacy
         * {@code ShowBankingTransactionDropdownInCell}). Omit on sibling
         * modules to keep the read-only stub.
         */
        onMatch?: (row: DetailTransaction, anchorRect?: DOMRect) => void;
        onUnmatch?: (row: DetailTransaction) => void;
    },
): PaymentListColumn<DetailTransaction>[] {
    return [
        {
            key: "dateTime",
            label: t("payment.col.date_time"),
            width: "var(--w-wb-trd-datetime)",
            sortable: true,
            // Sort by the raw `yyyyMMddHHmmss`-style timestamp when present
            // (the renderer formats it for display) — lexicographic
            // ordering matches chronological order for this format.
            sortValue: (row) => row.dateTime ?? "",
            render: (row) => <DateTimeStack value={row.dateTime} />,
        },
        {
            key: "depositBank",
            label: t("payment.detail.col.deposit_bank"),
            width: "var(--w-wb-trd-deposit-bank)",
            sortable: true,
            // Multi-line cell — sort by the bank code line so codes group
            // together regardless of resolved bank-name length.
            sortValue: (row) =>
                row.depositBankCode ?? row.depositBank ?? "",
            render: (row) => <DepositBankCell row={row} />,
        },
        {
            key: "recipientName",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.detail.col.recipient_name")}
                    <ColumnInfoIcon
                        fieldCd="RCPT"
                        fieldNameKey="payment.field.recipient_name"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "var(--w-wb-trd-recipient)",
            sortable: true,
        },
        {
            key: "transferAmount",
            label: t("payment.detail.col.transfer_amount"),
            align: "right",
            width: "var(--w-wb-trd-amount)",
            sortable: true,
            // Pre-formatted display string (e.g. "1,000.00") — sort by the
            // underlying numeric value so 10 < 100 instead of "10" > "100".
            sortValue: (row) =>
                Number((row.transferAmount ?? "").replace(/[^\d.-]/g, "")) || 0,
        },
        {
            key: "remark",
            // Figma 1:13476 — Remarks header includes an info glyph that
            // becomes a live blocked-chars tooltip when `options.blockedChars`
            // is supplied (mirrors legacy `_v2common.app.addHeaderInfoIcon`).
            label: (
                <span className="flex items-center gap-1">
                    {t("payment.detail.col.remark")}
                    <ColumnInfoIcon
                        fieldCd="RMKS"
                        fieldNameKey="payment.field.remarks"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "var(--w-wb-trd-remark)",
            sortable: true,
        },
        {
            key: "result",
            label: t("payment.detail.col.results"),
            width: "var(--w-wb-trd-result)",
            sortable: true,
            // Status badge text — sort by the underlying result token so
            // groups (success / failed / pending) cluster predictably.
            sortValue: (row) => row.result ?? "",
            render: (row) => <ResultBadgeCell row={row} t={t} />,
        },
        {
            key: "resultDateTime",
            label: t("payment.detail.col.result_datetime"),
            width: "var(--w-wb-trd-result-datetime)",
            sortable: true,
            sortValue: (row) => row.resultDateTime ?? "",
            // Legacy parity (pymn_0010_002.ts:428): blank Result Date/Time
            // when the row is still in-progress — the timestamp only
            // appears on a final result (success or failed).
            render: (row) => (
                <DateTimeStack
                    value={row.result === "pending" ? undefined : row.resultDateTime}
                />
            ),
        },
        {
            key: "reportingAccount",
            label: t("payment.detail.col.reporting_account"),
            width: "var(--w-wb-trd-reporting)",
            sortable: true,
            render: (row) => <ResultReportingAccountCell row={row} />,
        },
        {
            key: "description",
            label: t("payment.detail.col.description"),
            width: "var(--w-wb-trd-description)",
            sortable: true,
        },
        {
            key: "documentNo",
            label: t("payment.detail.col.document_no"),
            width: "var(--w-wb-trd-document-no)",
            sortable: true,
        },
        {
            key: "bankingTxnId",
            label: t("payment.detail.col.banking_txn_id"),
            width: "var(--w-wb-trd-banking-id)",
            sortable: true,
            sortValue: (row) => row.bankingTxnId ?? "",
            render: (row) => (
                <BankingTxnIdCell
                    row={row}
                    matchLabel={t("payment.detail.match")}
                    unmatchLabel={t("payment.detail.unmatch")}
                    rerunLabel={options?.onRerun ? t("payment.detail.rerun") : undefined}
                    onRerun={options?.onRerun}
                    onMatch={options?.onMatch}
                    onUnmatch={options?.onUnmatch}
                />
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
    options?: {
        /**
         * Per-field blocked-chars map from {@code useBlockedChars}. When
         * provided AND the matching entry is populated, the Beneficiary
         * Name / Beneficiary Address / Memo column headers each swap
         * their static info icon for a {@link BlockedCharsTooltip}.
         * Omit to keep the legacy placeholder.
         */
        blockedChars?: BlockedCharsMap;
        /** Per-line Match handler (OVR-G1). Receives the clicked button's
         *  bounding rect for anchoring the inline match dropdown. When omitted
         *  the Match CTA stays an inert stub. */
        onMatch?: (row: DetailTransaction, anchorRect?: DOMRect) => void;
        /** Per-line Unmatch handler (OVR-G1). When omitted the Unmatch CTA stays inert. */
        onUnmatch?: (row: DetailTransaction) => void;
    },
): PaymentListColumn<DetailTransaction>[] {
    return [
        {
            key: "trnSeq",
            label: t("payment.overseas.col.trn_seq"),
            width: "120px",
            sortable: true,
            sortValue: (row) => Number(row.trnSeq ?? 0) || 0,
        },
        {
            key: "recipientName",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.overseas.col.beneficiary_name")}
                    <ColumnInfoIcon
                        fieldCd="BENA"
                        fieldNameKey="payment.field.beneficiary_name"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "180px",
            sortable: true,
        },
        {
            key: "depositBankName",
            label: t("payment.overseas.col.beneficiary_bank_name"),
            width: "200px",
            render: (row) => <BeneficiaryBankCell row={row} />,
            sortable: true,
            sortValue: (row) => row.depositBankName ?? "",
        },
        {
            key: "accountNo",
            label: t("payment.overseas.col.beneficiary_account_no"),
            width: "180px",
            sortable: true,
        },
        {
            key: "bnfcAddr",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.overseas.col.beneficiary_address")}
                    <ColumnInfoIcon
                        fieldCd="BEAD"
                        fieldNameKey="payment.field.beneficiary_address"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "220px",
            sortable: true,
        },
        {
            key: "depositBankCurrency",
            label: t("payment.overseas.col.transfer_currency"),
            width: "140px",
            sortable: true,
        },
        {
            key: "transferAmount",
            label: t("payment.overseas.col.transfer_amount"),
            align: "right",
            width: "138px",
            sortable: true,
            sortValue: (row) =>
                Number(String(row.transferAmount ?? "").replace(/,/g, "")) || 0,
        },
        {
            key: "feePayer",
            label: t("payment.overseas.col.fee_payer"),
            width: "110px",
            // FEE_PAYER is SORT_YN='N' per legacy pymn_0008_002 — header
            // renders without a sort glyph and ignores clicks. Other 12
            // columns in this factory are sortable: true.
        },
        {
            key: "remark",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.overseas.col.memo")}
                    <ColumnInfoIcon
                        fieldCd="MEMO"
                        fieldNameKey="payment.field.memo"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "200px",
            sortable: true,
        },
        {
            key: "reportingAccount",
            label: t("payment.overseas.col.reporting_account"),
            width: "220px",
            render: (row) => <ResultReportingAccountCell row={row} />,
            sortable: true,
            sortValue: (row) => row.reportingAccount ?? "",
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
            sortable: true,
            sortValue: (row) => row.result ?? "",
        },
        {
            key: "resultDateTime",
            label: t("payment.detail.col.result_datetime"),
            width: "var(--w-wb-trd-result-datetime)",
            // Legacy parity (pymn_0010_002.ts:428): blank Result Date/Time
            // when the row is still in-progress — the timestamp only
            // appears on a final result (success or failed).
            render: (row) => (
                <DateTimeStack
                    value={row.result === "pending" ? undefined : row.resultDateTime}
                />
            ),
            sortable: true,
            sortValue: (row) => row.resultDateTime ?? "",
        },
        {
            key: "bankingTxnId",
            label: t("payment.detail.col.banking_txn_id"),
            width: "var(--w-wb-trd-banking-id)",
            render: (row) => (
                <BankingTxnIdCell
                    row={row}
                    matchLabel={t("payment.detail.match")}
                    unmatchLabel={t("payment.detail.unmatch")}
                    onMatch={options?.onMatch}
                    onUnmatch={options?.onUnmatch}
                />
            ),
            sortable: true,
            sortValue: (row) => row.bankingTxnId ?? "",
        },
    ];
}

/**
 * Column definition for Overseas Payment Scheduled detail — mirrors
 * the live JEX overseas scheduled detail view {@code pymn_0007_004}.
 *
 * Ten columns matching the legacy column set (see
 * {@code WECMS DEV/.../pymn_0007_004.ts:417-489}):
 *   Beneficiary Name | Beneficiary Bank Name | Beneficiary Account No. |
 *   Beneficiary Address | Transfer Currency | Transfer Amount |
 *   Fee Payer | Memo | Reporting Account | Banking Transaction ID
 *
 * Differs from {@link overseasResultDetailColumns} in two ways:
 *   1. Drops Status + Result Date/Time columns (no result before dispatch).
 *   2. Reporting Account is the editable picker
 *      ({@link ReportingAccountCell}) so the user can assign / change
 *      the chart-of-accounts code from the Scheduled list — the result
 *      page renders it read-only.
 */
export function overseasScheduledDetailColumns(
    t: Translator,
    options?: {
        accounts?: ChartAccountOption[];
        onSelectReportingAccount?: (rowId: string, code: string | null) => void;
        /**
         * Per-field blocked-chars map from {@code useBlockedChars}. When
         * provided AND the matching entry is populated, the Beneficiary
         * Name / Beneficiary Address / Memo column headers each swap
         * their static info icon for a {@link BlockedCharsTooltip}.
         * Omit to keep the legacy placeholder.
         */
        blockedChars?: BlockedCharsMap;
    },
): PaymentListColumn<DetailTransaction>[] {
    return [
        {
            key: "recipientName",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.overseas.col.beneficiary_name")}
                    <ColumnInfoIcon
                        fieldCd="BENA"
                        fieldNameKey="payment.field.beneficiary_name"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "180px",
            sortable: true,
        },
        {
            key: "depositBankName",
            label: t("payment.overseas.col.beneficiary_bank_name"),
            width: "200px",
            render: (row) => <BeneficiaryBankCell row={row} />,
            sortable: true,
            sortValue: (row) => row.depositBankName ?? "",
        },
        {
            key: "accountNo",
            label: t("payment.overseas.col.beneficiary_account_no"),
            width: "180px",
            sortable: true,
        },
        {
            key: "bnfcAddr",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.overseas.col.beneficiary_address")}
                    <ColumnInfoIcon
                        fieldCd="BEAD"
                        fieldNameKey="payment.field.beneficiary_address"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "220px",
            sortable: true,
        },
        {
            key: "depositBankCurrency",
            label: t("payment.overseas.col.transfer_currency"),
            width: "140px",
            sortable: true,
        },
        {
            key: "transferAmount",
            label: t("payment.overseas.col.transfer_amount"),
            align: "right",
            width: "138px",
            sortable: true,
            sortValue: (row) =>
                Number(String(row.transferAmount ?? "").replace(/,/g, "")) || 0,
        },
        {
            key: "feePayer",
            label: t("payment.overseas.col.fee_payer"),
            width: "150px",
            sortable: true,
        },
        {
            key: "remark",
            label: (
                <span className="inline-flex items-center gap-1">
                    {t("payment.overseas.col.memo")}
                    <ColumnInfoIcon
                        fieldCd="MEMO"
                        fieldNameKey="payment.field.memo"
                        blockedChars={options?.blockedChars}
                    />
                </span>
            ),
            width: "200px",
            sortable: true,
        },
        {
            key: "reportingAccount",
            label: t("payment.overseas.col.reporting_account"),
            width: "220px",
            cellClassName: "bg-[#FFFEDB]",
            render: (row) => (
                <ReportingAccountCell
                    row={row}
                    accounts={options?.accounts}
                    onSelect={options?.onSelectReportingAccount}
                />
            ),
            sortable: true,
            sortValue: (row) => row.reportingAccount ?? "",
        },
        {
            key: "bankingTxnId",
            label: t("payment.detail.col.banking_txn_id"),
            width: "175px",
            sortable: true,
            sortValue: (row) => row.bankingTxnId ?? "",
        },
    ];
}

// Sum of scheduledDetailColumns widths
export const SCHEDULED_DETAIL_MIN_WIDTH = "1527px";
export const RESULT_DETAIL_MIN_WIDTH = "var(--w-wb-trd-table-min)";
export const OVERSEAS_RESULT_DETAIL_MIN_WIDTH = "1948px";
// Sum of overseasScheduledDetailColumns widths: 180+200+180+220+140+138+150+200+220+175 = 1803
export const OVERSEAS_SCHEDULED_DETAIL_MIN_WIDTH = "1803px";
