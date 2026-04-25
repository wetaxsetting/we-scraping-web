import type {
    TransactionRow,
    TransactionStatusCounts,
    TransactionTotals,
} from "./types";

/**
 * Per-account transaction mocks. Keyed by account slug so the dynamic
 * `/banking/transaction-history/[accountId]` route can look up the
 * right set without per-route hardcoding. Replace with API data when the
 * backend endpoint lands.
 *
 * Each row carries a `confirmed` flag + matching fields (purpose, VAS
 * account, contacts name, confirmer) — Figma node 989:22011 shows the
 * matching panel on the right so unconfirmed rows render as yellow
 * editable rows with a Confirm button, and confirmed rows render with
 * read-only values and an Undo button.
 */

export const mockTransactionsByAccount: Record<string, TransactionRow[]> = {
    "bidv-0569": [
        {
            id: "bidv-0569-1",
            date: "25 Nov 2024",
            time: "09:14:22",
            deposit: "15,000,000",
            balance: "35,000,000",
            remarks: "Salary payment — HAENGSUNG",
            confirmed: false,
        },
        {
            id: "bidv-0569-2",
            date: "25 Nov 2024",
            time: "11:03:10",
            withdraw: "2,450,000",
            balance: "32,550,000",
            remarks: "Office supplies — Phong Vũ",
            confirmed: false,
        },
        {
            id: "bidv-0569-3",
            date: "25 Nov 2024",
            time: "14:45:31",
            withdraw: "1,120,000",
            balance: "31,430,000",
            remarks: "Utility — EVN Hà Nội",
            confirmed: true,
            purpose: "43 Other Expenses",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "yellow",
        },
        {
            id: "bidv-0569-4",
            date: "24 Nov 2024",
            time: "16:22:04",
            deposit: "20,000,000",
            balance: "32,550,000",
            remarks: "Customer payment — ABC Ltd.",
            confirmed: true,
            purpose: "34 Other Income",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "pink",
        },
        {
            id: "bidv-0569-5",
            date: "24 Nov 2024",
            time: "09:10:58",
            withdraw: "350,000",
            balance: "12,550,000",
            remarks: "Refund reversal — order #2210",
            confirmed: false,
        },
    ],
    "vcb-8210": [
        {
            id: "vcb-8210-1",
            date: "23 Nov 2024",
            time: "10:04:11",
            deposit: "5,000,000",
            balance: "18,000,000",
            remarks: "Incoming VCB transfer",
            confirmed: true,
            purpose: "34 Other Income",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "yellow",
        },
        {
            id: "vcb-8210-2",
            date: "22 Nov 2024",
            time: "16:30:22",
            withdraw: "2,300,000",
            balance: "13,000,000",
            remarks: "Bank fee — monthly",
            confirmed: false,
        },
    ],
    "hdbank-0442": [
        {
            id: "hdbank-0442-1",
            date: "21 Nov 2024",
            time: "08:05:47",
            deposit: "7,500,000",
            balance: "9,500,000",
            remarks: "Vendor refund",
            confirmed: false,
        },
    ],
    "woori-2308": [
        {
            id: "woori-2308-1",
            date: "30 Oct 2024",
            time: "11:12:13",
            withdraw: "1,000,000",
            balance: "1,000,000",
            remarks:
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text since the 1500s,",
            confirmed: false,
            purpose: "40 Loan Repaid",
            vasAccount: "1112 Name",
            contactsName: "CÔNG TY TNHH PARIS BAGUETTE VIỆT NAM",
        },
        {
            id: "woori-2308-2",
            date: "30 Oct 2024",
            time: "11:12:13",
            deposit: "1,000,000",
            balance: "1,000,000",
            remarks:
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry",
            confirmed: false,
        },
        {
            id: "woori-2308-3",
            date: "30 Oct 2024",
            time: "11:12:13",
            deposit: "1,000,000",
            balance: "1,000,000",
            remarks: "Lorem Ipsum is simply dummy text of",
            confirmed: false,
        },
        {
            id: "woori-2308-4",
            date: "30 Oct 2024",
            time: "11:12:13",
            withdraw: "1,000,000",
            balance: "1,000,000",
            remarks: "Lorem Ipsum is simply dummy text of",
            confirmed: true,
            purpose: "40 Loan Repaid",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "yellow",
        },
        {
            id: "woori-2308-5",
            date: "30 Oct 2024",
            time: "11:12:13",
            withdraw: "1,000,000",
            balance: "1,000,000",
            remarks:
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text since the 1500s,",
            confirmed: true,
            purpose: "43 Other Expenses",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "pink",
        },
        {
            id: "woori-2308-6",
            date: "30 Oct 2024",
            time: "11:12:13",
            withdraw: "1,000,000",
            balance: "1,000,000",
            remarks:
                "Lorem Ipsum is simply dummy text of the printing and typesetting industry",
            confirmed: true,
            purpose: "43 Other Expenses",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "yellow",
        },
        {
            id: "woori-2308-7",
            date: "30 Oct 2024",
            time: "11:12:13",
            deposit: "1,000,000",
            balance: "1,000,000",
            remarks: "Lorem Ipsum is simply dummy text of",
            confirmed: true,
            purpose: "34 Other Income",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "yellow",
        },
    ],
    "bidv-2913": [
        {
            id: "bidv-2913-1",
            date: "28 Oct 2024",
            time: "09:30:00",
            deposit: "22,000.00",
            balance: "109,420.00",
            remarks: "Incoming remittance — Korea HQ",
            confirmed: true,
            purpose: "34 Other Income",
            vasAccount: "1112 Name",
            contactsName: "0002 CÔNG TY TNHH NAM LONG GIA PHÁT",
            confirmedBy: { name: "Ngoc Thanh", date: "30-10-2024" },
            docIconVariant: "yellow",
        },
        {
            id: "bidv-2913-2",
            date: "27 Oct 2024",
            time: "14:52:18",
            withdraw: "12,500.00",
            balance: "87,420.00",
            remarks: "Overseas settlement — supplier SG",
            confirmed: false,
        },
    ],
    "shinhan-6946": [
        {
            id: "shinhan-6946-1",
            date: "25 Oct 2024",
            time: "12:00:00",
            deposit: "500,000",
            balance: "500,000",
            remarks: "Initial funding",
            confirmed: false,
        },
    ],
};

function sumTotals(rows: TransactionRow[]): TransactionTotals {
    let deposit = 0;
    let withdraw = 0;
    for (const r of rows) {
        if (r.deposit) deposit += toNumber(r.deposit);
        if (r.withdraw) withdraw += toNumber(r.withdraw);
    }
    return {
        count: rows.length,
        depositTotal: format(deposit),
        withdrawTotal: format(withdraw),
    };
}

function toNumber(s: string): number {
    if (s.includes(",") && s.includes(".")) {
        return Number(s.replace(/,/g, ""));
    }
    if (s.match(/^\d{1,3}(\.\d{3})+$/)) {
        return Number(s.replace(/\./g, ""));
    }
    return Number(s.replace(/[,\s]/g, ""));
}

function format(n: number): string {
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function totalsFor(accountId: string): TransactionTotals {
    const rows = mockTransactionsByAccount[accountId] ?? [];
    return sumTotals(rows);
}

export function rowsFor(accountId: string): TransactionRow[] {
    return mockTransactionsByAccount[accountId] ?? [];
}

export function countsFor(rows: TransactionRow[]): TransactionStatusCounts {
    let confirmed = 0;
    for (const r of rows) {
        if (r.confirmed) confirmed += 1;
    }
    return {
        all: rows.length,
        confirmed,
        unconfirmed: rows.length - confirmed,
    };
}
