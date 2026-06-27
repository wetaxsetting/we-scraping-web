"use client";

import { useMemo, useState } from "react";

import DailyFinancialHsPage from "./DailyFinancialHsPage";
import type { BankGroup, LedgerEntry } from "./types";
import { fetchDailyFinancialHs } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import { todayLocalIso } from "@/lib/datetime";
import type { ApiHsLedgerRow } from "@/lib/types/api";

/**
 * Client wrapper for Banking > Daily Financial (HS).
 *
 * Calls `GET /api/v1/banking/reports/daily-financial-hs` — real DB-backed
 * (DF-2): the backend returns the legacy
 * `fn_get_haengsung_daily_financial_report` rows verbatim (row type + order
 * preserved). This wrapper projects that flat `row_type` stream into the
 * `BankGroup` shape the page renders. The HS variant renders eagerly (§7c) —
 * the report loads on mount for today and refetches when the As-of date
 * changes. No mock fallback.
 *
 * Projection rules (function row types → render shape):
 *   - `HEADER` opens a new bank group (bank name + account type subtitle +
 *     optional due date parsed from the composite `bank_account`).
 *   - `BEFORE_BALANCE` and `TRANSACTION` become ledger entries inside the
 *     open group.
 *   - `ACCOUNT_TOTAL` closes the group as its sub-total row.
 *   - `CURRENCY_TOTAL` attaches as the green TOTAL row on the last group of
 *     that currency section.
 */
export default function DailyFinancialHsClient() {
    const [asOf, setAsOf] = useState<string>(todayIso());

    const { data } = useApiData(
        () => fetchDailyFinancialHs({ asOf: toYmd(asOf), accountFilter: "ALL" }),
        [asOf],
    );

    const groups = useMemo<BankGroup[]>(
        () => projectHsRows(data?.rows ?? []),
        [data],
    );

    return (
        <DailyFinancialHsPage
            ledgerGroups={groups}
            asOfDate={asOf}
            onAsOfChange={setAsOf}
        />
    );
}

function todayIso(): string {
    // Browser-LOCAL today, not UTC — `toISOString()` is a day behind for ICT
    // users after 17:00 local. This page renders eagerly on mount, so the
    // wrong default would be immediately visible + queried.
    return todayLocalIso();
}

/** ISO `YYYY-MM-DD` → legacy `YYYYMMDD` (the function's `p_as_of_date`). */
function toYmd(iso: string): string {
    return iso.replace(/-/g, "");
}

const s = (v: string | null | undefined): string => v ?? "";

function projectHsRows(rows: ReadonlyArray<ApiHsLedgerRow>): BankGroup[] {
    const out: BankGroup[] = [];
    let current: {
        bankName: string;
        subtitle?: string;
        dueDate?: string;
        accountNo: string;
        currency: string;
        entries: LedgerEntry[];
    } | null = null;
    let entrySeq = 0;
    let groupSeq = 0;

    const closeGroup = (accountTotal: ApiHsLedgerRow | null) => {
        if (!current) return;
        out.push({
            id: `hs-${groupSeq++}`,
            bankName: current.bankName,
            subtitle: current.subtitle,
            dueDate: current.dueDate,
            accountNo: current.accountNo,
            currency: current.currency,
            entries: current.entries,
            subtotal: {
                beforeBalance: s(accountTotal?.before_balance),
                receipt: s(accountTotal?.receipt),
                payment: s(accountTotal?.payment),
                balance: s(accountTotal?.balance),
            },
        });
        current = null;
    };

    const pushEntry = (r: ApiHsLedgerRow) => {
        if (!current) return;
        current.entries.push({
            id: `e-${entrySeq++}`,
            receiptCode: s(r.rept_cd),
            paymentCode: s(r.pymn_cd),
            descriptionEn: s(r.description_en),
            descriptionKo: s(r.description_ko),
            counterparty: s(r.customer_supplier),
            beforeBalance: s(r.before_balance),
            receipt: s(r.receipt),
            payment: s(r.payment),
            balance: s(r.balance),
            memo: s(r.memo),
        });
    };

    for (const r of rows) {
        switch ((r.row_type ?? "").toUpperCase()) {
            case "HEADER": {
                // A new bank/account block. The function emits a composite
                // `bank_account` ("BankName\n(Type account)\nDue date: …");
                // split it for the bank-name / subtitle / due-date slots.
                if (current) closeGroup(null); // defensive — ACCOUNT_TOTAL normally closes
                const lines = s(r.bank_account)
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                const subtitle = lines.find((l) => l.startsWith("("));
                const dueDate = lines.find((l) => /^due date/i.test(l));
                current = {
                    bankName: s(r.bank_name_sort) || lines[0] || "",
                    subtitle,
                    dueDate,
                    accountNo: s(r.account_number),
                    currency: s(r.currency),
                    entries: [],
                };
                break;
            }
            case "BEFORE_BALANCE":
            case "TRANSACTION":
                pushEntry(r);
                break;
            case "ACCOUNT_TOTAL":
                closeGroup(r);
                break;
            case "CURRENCY_TOTAL": {
                // Attach the section TOTAL to the last emitted group in the
                // same currency (the function emits it after that section's
                // final ACCOUNT_TOTAL).
                for (let i = out.length - 1; i >= 0; i--) {
                    if (out[i].currency === r.currency) {
                        out[i] = {
                            ...out[i],
                            closesTotal: true,
                            runningTotal: {
                                beforeBalance: s(r.before_balance),
                                receipt: s(r.receipt),
                                payment: s(r.payment),
                                balance: s(r.balance),
                            },
                        };
                        break;
                    }
                }
                break;
            }
            default:
                break;
        }
    }

    // Defensive — flush any group left open without an ACCOUNT_TOTAL.
    if (current) closeGroup(null);

    return out;
}
