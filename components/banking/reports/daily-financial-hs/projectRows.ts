import type { BankFilterOption } from "@/components/shared/BankFilterPopover";
import { formatAmount } from "@/lib/currency";
import type { ApiHsLedgerRow } from "@/lib/types/api";

import type { BankGroup, LedgerEntry, LedgerTotals } from "./types";

/**
 * Projects the flat `fn_get_haengsung_daily_financial_report` row stream
 * (legacy `rept_0017_001` / IDO `DAILY_FINCL_REPT_R001`) into the bank-grouped
 * `BankGroup[]` the ledger table renders.
 *
 * Row-type discriminator (function output, in order):
 *  - `HEADER`         → opens a bank/account block (bank name / type / due date
 *                       parsed out of `bank_account`; currency + account no.).
 *  - `BEFORE_BALANCE` → the opening-balance entry row (not persistable — empty
 *                       `acctSeqNo`, legacy does not edit it).
 *  - `TRANSACTION`    → an editable entry row (real `acct_seq_no`).
 *  - `ACCOUNT_TOTAL`  → the block's blue SUB TOTAL row.
 *  - `CURRENCY_TOTAL` → the green TOTAL row closing one currency section.
 *                       Attached to the LAST group of the row's own currency
 *                       (`closesTotal`) — matched by currency, not by stream
 *                       position, so one TOTAL renders per currency (VND / USD
 *                       / KRW) even when the function sorts the grand-total
 *                       rows (`account_type_order 999990-999992`) after every
 *                       account block. Legacy `rept_0017_001` shows each TOTAL
 *                       immediately after its currency's last account group
 *                       (IDO `DAILY_FINCL_REPT_R001` orders currency-first).
 *
 * Amounts arrive as raw wire numbers (or null); we format for display with the
 * per-group currency and render null/blank as an empty cell (legacy never shows
 * "0" for a cell the function left empty).
 */
export function projectHsRows(rows: readonly ApiHsLedgerRow[]): BankGroup[] {
    const groups: BankGroup[] = [];
    let current: BankGroup | null = null;

    for (const row of rows) {
        const ccy = row.currency ?? "VND";

        switch (row.row_type) {
            case "HEADER": {
                current = {
                    id: `${row.bank_cd}_${row.account_number}_${groups.length}`,
                    ...parseBankHeader(row.bank_account),
                    accountNo: row.account_number ?? "",
                    currency: ccy,
                    entries: [],
                    subtotal: EMPTY_TOTALS,
                };
                groups.push(current);
                break;
            }
            case "BEFORE_BALANCE":
            case "TRANSACTION": {
                if (!current) break; // defensive — a HEADER always precedes rows
                current.entries.push(toEntry(row, ccy, current.id));
                break;
            }
            case "ACCOUNT_TOTAL": {
                if (!current) break;
                current.subtotal = toTotals(row, ccy);
                break;
            }
            case "CURRENCY_TOTAL": {
                // Standalone grand total for ONE currency — close that
                // currency's LAST group. Never anchor to the overall last
                // group: the function sorts all CURRENCY_TOTAL rows to the
                // end of the stream, so blind last-group attachment collapses
                // the VND/USD/KRW totals onto one group (each overwrite the
                // previous) instead of rendering one TOTAL per currency.
                const target = findLastGroupOfCurrency(groups, ccy);
                if (target) {
                    target.closesTotal = true;
                    target.total = {
                        ...toTotals(row, ccy),
                        // Actual company balance sits at the table's right edge.
                        memo: fmt(row.balance_company_actual, ccy),
                    };
                }
                break;
            }
            default:
                break;
        }
    }

    return groups;
}

/** Distinct (bank, account) options for the filter dropdown, derived from the
 *  HEADER rows of the unfiltered ("ALL") report — the accounts the report
 *  covers (legacy sourced these from `cash_0001_001_r003`). */
export function deriveBankOptions(rows: readonly ApiHsLedgerRow[]): BankFilterOption[] {
    const seen = new Set<string>();
    const options: BankFilterOption[] = [];
    for (const row of rows) {
        if (row.row_type !== "HEADER") continue;
        const bankCd = row.bank_cd ?? "";
        const acctNo = row.account_number ?? "";
        const key = `${bankCd}::${acctNo}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({
            bankCd,
            bankNm: parseBankHeader(row.bank_account).bankName || bankCd,
            acctNo,
        });
    }
    return options;
}

/* ------------------------------------------------------------------ */

/** Last group whose currency matches — the group a CURRENCY_TOTAL row closes.
 *  Falls back to the overall last group for a total whose currency has no
 *  account group (defensive; the function only emits a total per currency
 *  that has accounts). */
function findLastGroupOfCurrency(groups: readonly BankGroup[], ccy: string): BankGroup | null {
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i].currency === ccy) return groups[i];
    }
    return groups[groups.length - 1] ?? null;
}

const EMPTY_TOTALS: LedgerTotals = {
    beforeBalance: "",
    receipt: "",
    payment: "",
    balance: "",
};

function toEntry(row: ApiHsLedgerRow, ccy: string, groupId: string): LedgerEntry {
    // Only TRANSACTION rows are editable and carry an ACCT_SEQ_NO (the save PK).
    // Legacy (`rept_0017_001.ts` fnGetDataRow) renders the Receipt/Payment/
    // Description cells ONLY for `isTransaction`; a BEFORE_BALANCE row shows
    // empty code/description cells (no input boxes, no label text) — just the
    // Before Balance amount. Mirror that: blank those fields for non-transaction
    // rows so the projection is the single source of truth.
    const isTransaction = row.row_type === "TRANSACTION";
    const acctSeqNo = row.acct_seq_no ?? "";
    return {
        id: acctSeqNo ? `${groupId}_${acctSeqNo}` : `${groupId}_before`,
        acctSeqNo,
        editable: isTransaction,
        receiptCode: isTransaction ? (row.rept_cd ?? "") : "",
        paymentCode: isTransaction ? (row.pymn_cd ?? "") : "",
        descriptionEn: isTransaction ? (row.description_en ?? "") : "",
        descriptionKo: isTransaction ? (row.description_ko ?? "") : "",
        counterparty: row.customer_supplier ?? "",
        beforeBalance: fmt(row.before_balance, ccy),
        receipt: fmt(row.receipt, ccy),
        payment: fmt(row.payment, ccy),
        balance: fmt(row.balance, ccy),
        memo: isTransaction ? (row.memo ?? "") : "",
    };
}

function toTotals(row: ApiHsLedgerRow, ccy: string): LedgerTotals {
    return {
        beforeBalance: fmt(row.before_balance, ccy),
        receipt: fmt(row.receipt, ccy),
        payment: fmt(row.payment, ccy),
        balance: fmt(row.balance, ccy),
    };
}

/** Format a wire amount for display; null / blank → empty cell (never "0"). */
function fmt(wire: string | null | undefined, ccy: string): string {
    if (wire === null || wire === undefined || wire === "") return "";
    return formatAmount(wire, ccy, false);
}

/**
 * Parse the function's multi-line `bank_account` HEADER string:
 *   "Vietcom Bank\n(Current account)\nDue date: 19.Sep.2025"
 * into the display pieces the Bank cell renders.
 */
function parseBankHeader(bankAccount: string | null): {
    bankName: string;
    accountType?: string;
    dueDateLabel?: string;
    dueDateValue?: string;
} {
    const lines = (bankAccount ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const bankName = lines[0] ?? "";
    let accountType: string | undefined;
    let dueDateValue: string | undefined;

    for (const line of lines.slice(1)) {
        const lower = line.toLowerCase();
        if (lower.startsWith("due date")) {
            // "Due date: 19.Sep.2025" → "19 Sep 2025"
            const raw = line.split(":").slice(1).join(":").trim();
            dueDateValue = formatDueDate(raw);
        } else if (line.startsWith("(")) {
            accountType = line;
        }
    }

    return {
        bankName,
        accountType,
        dueDateLabel: dueDateValue ? "Due Date" : undefined,
        dueDateValue,
    };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "19.Sep.2025" / "19.9.2025" → "19 Sep 2025" (legacy formatDueDateFromBankAcct). */
function formatDueDate(raw: string): string {
    const parts = raw.split(".").map((p) => p.trim());
    if (parts.length < 3) return raw;
    const [day, month, year] = parts;
    const monthNum = Number(month);
    const monthLabel =
        Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12
            ? MONTHS[monthNum - 1]
            : month;
    return `${Number(day)} ${monthLabel} ${year}`;
}
