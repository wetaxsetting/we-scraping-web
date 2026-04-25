import type {
    OwnAccountRow,
    OwnAccountTotals,
    TransferHistoryTotal,
    TransferRow,
} from "./types";

export const mockTransferHistory: TransferRow[] = [
    {
        id: "itr-1",
        date: "05-07-2023",
        time: "11:39:50",
        fromBank: "SHINHAN",
        fromCurrency: "VND",
        fromAccount: "0001-00000569-14",
        toBank: "WOORI",
        toCurrency: "VND",
        toAccount: "4001-00234569-14",
        amount: "50.000",
        remarks: "This is remarks",
        lastUpdate: "40mn ago",
        status: "success",
    },
    {
        id: "itr-2",
        date: "05-07-2023",
        time: "11:39:50",
        fromBank: "SHINHAN",
        fromCurrency: "VND",
        fromAccount: "0001-00000569-14",
        toBank: "WOORI",
        toCurrency: "VND",
        toAccount: "2001-00234569-14",
        amount: "50.000",
        remarks: "This is remarks",
        lastUpdate: "40mn ago",
        status: "success",
    },
    {
        id: "itr-3",
        date: "05-07-2023",
        time: "11:39:50",
        fromBank: "SHINHAN",
        fromCurrency: "VND",
        fromAccount: "0001-00000569-14",
        toBank: "WOORI",
        toCurrency: "VND",
        toAccount: "1201-00234569-14",
        amount: "50.000",
        remarks: "This is remarks",
        lastUpdate: "40mn ago",
        status: "failed",
    },
];

export const mockTransferHistoryTotal: TransferHistoryTotal = {
    currency: "VND",
    count: mockTransferHistory.length,
    total: "150.000₫",
};

export type OwnAccountOption = {
    value: string;
    label: string;
    /** Balance chip shown next to the account name in the picker. */
    balance: string;
};

export const mockOwnAccounts: OwnAccountOption[] = [
    {
        value: "acc-1",
        label: "BIDV • 0001-00000569-14 (VND)",
        balance: "20.000.000₫",
    },
    {
        value: "acc-2",
        label: "HD BANK • 0001-00000569-22 (VND)",
        balance: "8.450.000₫",
    },
    {
        value: "acc-3",
        label: "WOORI BANK • 0001-00000523-06 (USD)",
        balance: "$87,420.00",
    },
    {
        value: "acc-4",
        label: "WOORI BANK • 0001-00000523-41 (EUR)",
        balance: "€14,890.00",
    },
];

/**
 * Transfer Own Accounts — list rows. Mirrors the Account Inquiry shape so the
 * two pages stay visually consistent (same columns, same typography). The
 * "error" flag marks accounts whose last-sync failed; the UI renders the red
 * "Failed" accent in the Last Update column.
 */
export const mockOwnAccountRows: OwnAccountRow[] = [
    {
        id: "own-1",
        bankName: "SHINHAN",
        bankType: "Current",
        accountNo: "0001-00000569-14",
        nickname: "VIETCOM 8210 - payment account",
        balance: "2.300.000",
        available: "2.300.000",
        lastUpdate: "40mn ago",
        currency: "VND",
    },
    {
        id: "own-2",
        bankName: "VIETCOM",
        bankType: "Current",
        accountNo: "0001-00000569-14",
        nickname: "Vietcom 8210 - payment account",
        balance: "2.300.000",
        available: "2.300.000",
        lastUpdate: "40mn ago",
        currency: "VND",
        error: true,
    },
    {
        id: "own-3",
        bankName: "IBK",
        bankType: "Current",
        accountNo: "0001-00000569-14",
        nickname: "Vietcom 8210 - payment account",
        balance: "2.300.000",
        available: "2.300.000",
        lastUpdate: "40mn ago",
        currency: "VND",
    },
];

export const mockOwnAccountTotals: OwnAccountTotals = {
    count: mockOwnAccountRows.length,
    balance: "9.184.172.642₫",
    available: "9.131.311.364₫",
};

/** Extend the picker options so each list row has a matching modal option. */
export const mockOwnAccountsExtended: OwnAccountOption[] = [
    ...mockOwnAccounts,
    {
        value: "own-1",
        label: "SHINHAN • 0001-00000569-14 (VND)",
        balance: "2.300.000₫",
    },
    {
        value: "own-2",
        label: "VIETCOM • 0001-00000569-14 (VND)",
        balance: "2.300.000₫",
    },
    {
        value: "own-3",
        label: "IBK • 0001-00000569-14 (VND)",
        balance: "2.300.000₫",
    },
];
