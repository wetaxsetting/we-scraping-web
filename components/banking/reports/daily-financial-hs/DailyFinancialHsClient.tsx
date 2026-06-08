"use client";

import { useMemo } from "react";

import DailyFinancialHsPage from "./DailyFinancialHsPage";
import type { BankGroup, LedgerEntry } from "./types";
import { fetchDailyFinancialHs } from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import type { ApiHsLedgerRow } from "@/lib/types/api";

/**
 * Client wrapper for Banking > Daily Financial (HS).
 *
 * Calls `GET /api/v1/banking/reports/daily-financial-hs` (stub in
 * Sprint 1 — deterministic 6-row payload demonstrating the grouping
 * structure) and projects the flat `ROW_TYPE` row stream into the rich
 * `BankGroup` shape the page renders. When the backend returns no
 * rows the page falls back to its in-component mock so the chrome
 * stays usable.
 *
 * Projection rules:
 *   - Consecutive `ROW_TYPE='DETAIL'` rows sharing the same
 *     `(BANK_NM, ACCT_NO, CCY_CD)` collect under one BankGroup.
 *   - The next `ROW_TYPE='SUBTOTAL'` closes the group; its
 *     `DEBIT / CREDIT / BAL` become the group subtotal.
 *   - A trailing `ROW_TYPE='TOTAL'` marks the end of a currency
 *     section; we surface it as `closesTotal: true` + `runningTotal`
 *     on the LAST group of that section so the page renders the
 *     green TOTAL row in place.
 */
export default function DailyFinancialHsClient() {
    const { data } = useApiData(() => fetchDailyFinancialHs(), []);

    const groups = useMemo<BankGroup[] | undefined>(
        () => (data?.rows ? projectHsRows(data.rows) : undefined),
        [data],
    );

    return <DailyFinancialHsPage ledgerGroups={groups} />;
}

function projectHsRows(rows: ReadonlyArray<ApiHsLedgerRow>): BankGroup[] {
    const out: BankGroup[] = [];
    let current: {
        bankName: string;
        accountNo: string;
        currency: string;
        entries: LedgerEntry[];
    } | null = null;
    let entrySeq = 0;
    let groupSeq = 0;

    const closeGroup = (subtotal: ApiHsLedgerRow | null) => {
        if (!current) return;
        out.push({
            id: `hs-${groupSeq++}`,
            bankName: current.bankName,
            accountNo: current.accountNo,
            currency: current.currency,
            entries: current.entries,
            subtotal: {
                beforeBalance: "",
                receipt: subtotal?.credit ?? "",
                payment: subtotal?.debit ?? "",
                balance: subtotal?.balance ?? "",
            },
        });
        current = null;
    };

    for (const r of rows) {
        const rowType = (r.row_type ?? "").toUpperCase();
        if (rowType === "DETAIL") {
            const sameGroup =
                current &&
                current.bankName === r.bank_nm &&
                current.accountNo === r.acct_no &&
                current.currency === r.ccy_cd;
            if (!sameGroup) {
                // Different account — close pending group with no subtotal
                // (the backend always emits SUBTOTAL before switching, but
                // be defensive).
                if (current) closeGroup(null);
                current = {
                    bankName: r.bank_nm,
                    accountNo: r.acct_no,
                    currency: r.ccy_cd,
                    entries: [],
                };
            }
            current!.entries.push({
                id: `e-${entrySeq++}`,
                receiptCode: "",
                paymentCode: r.rcv_pay_cd ?? "",
                descriptionEn: r.description_en ?? "",
                descriptionKo: r.description_ko ?? "",
                counterparty: "",
                beforeBalance: "",
                receipt: r.credit ?? "",
                payment: r.debit ?? "",
                balance: r.balance ?? "",
                memo: "",
            });
        } else if (rowType === "SUBTOTAL") {
            closeGroup(r);
        } else if (rowType === "TOTAL") {
            // Attach the section TOTAL to the last group we emitted in
            // the same currency. Per backend, TOTAL always comes after
            // the section's final SUBTOTAL.
            for (let i = out.length - 1; i >= 0; i--) {
                if (out[i].currency === r.ccy_cd) {
                    out[i] = {
                        ...out[i],
                        closesTotal: true,
                        runningTotal: {
                            beforeBalance: "",
                            receipt: r.credit ?? "",
                            payment: r.debit ?? "",
                            balance: r.balance ?? "",
                        },
                    };
                    break;
                }
            }
        }
    }

    // Defensive — flush any group left open without a SUBTOTAL.
    if (current) closeGroup(null);

    return out;
}
