export type TransferStatus = "success" | "failed";

/** Row rendered in the Transfer History table. Matches the Figma 96:42769
 * column set: Date/Time · From Bank · To Bank · Transfer Amount · Remarks ·
 * Results. From/To banks render with currency chip + account number.
 * `status === "failed"` surfaces the red "Failed" accent in the Results
 * column instead of the relative last-update timestamp alone. */
export type TransferRow = {
    id: string;
    date: string;
    time: string;
    fromBank: string;
    fromCurrency: "VND" | "USD" | "EUR" | "KRW" | "JPY";
    fromAccount: string;
    toBank: string;
    toCurrency: "VND" | "USD" | "EUR" | "KRW" | "JPY";
    toAccount: string;
    amount: string;
    remarks: string;
    lastUpdate: string;
    status: TransferStatus;
    /** Engine status / error message (legacy `TRNS_MSG`). Shown as the
     *  hover tooltip on the Results cell — empty string when absent. */
    statusMessage: string;
    /** True when this transfer's engine job was multi-level-approval
     *  (`_ML`) — i.e. the bank only REGISTERED it and someone must still
     *  approve it in internet banking. Derived from the two bank codes
     *  by `recordedTransferNeedsBankApproval`, because
     *  `NAPAS_REMIT_TRNS_HSTR` stores no job kind. Only meaningful on a
     *  `success` row; a failed transfer needs no approval. */
    needsBankApproval: boolean;
};

/** Aggregate totals shown in the table's footer row. */
export type TransferHistoryTotal = {
    currency: string;
    count: number;
    total: string;
};

/**
 * Row rendered in the Transfer Own Accounts list. Matches the Account Inquiry
 * column set (Bank / Nickname / Balance / Available / Last Update) plus an
 * Action column with the per-row Transfer button. `error: true` surfaces the
 * "Failed" accent in the Last Update column.
 */
export type OwnAccountRow = {
    id: string;
    bankName: string;
    bankType: "Current" | "Savings" | "Fixed";
    accountNo: string;
    nickname: string;
    balance: string;
    available: string;
    lastUpdate: string;
    currency: "VND" | "USD" | "EUR" | "KRW" | "JPY";
    error?: boolean;
};

export type OwnAccountTotals = {
    count: number;
    balance: string;
    available: string;
};
