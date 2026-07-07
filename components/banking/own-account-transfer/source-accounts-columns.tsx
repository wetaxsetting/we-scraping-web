/**
 * Column registry + i18n key map for the Own Account Transfer source-
 * account picker. Mirrors the AccountInquiry / Settings precedent
 * (CLAUDE.md §13 "Page exposes a column registry keyed by FIELD_ID").
 *
 * <p>FIELD_IDs match the V180 `SYS_SCR_OPTION_WECMS` seed:
 *   <ul>
 *     <li>{@code BANK_CD}          — Bank (locked, sortable)</li>
 *     <li>{@code ACCT_NICK_NM}     — Account (sortable)</li>
 *     <li>{@code BAL}              — Balance (sortable)</li>
 *     <li>{@code AVI_BAL}          — Available (sortable)</li>
 *     <li>{@code ACCT_BAL_LST_STS} — Last Refresh (not sortable)</li>
 *     <li>{@code ETC}              — Action (special, locked)</li>
 *   </ul>
 *
 * <p>Adding a new column = (1) extend the V-next Flyway seed against
 * SYS_SCR_OPTION_WECMS, (2) add a registry entry here, (3) extend
 * `OwnAccountTransferSortField` on the backend if `SORT_YN='Y'`.
 */

import {
    AmountCell,
    BankCell,
    LastRefreshCell,
    PlainTextCell,
    TransferActionCell,
} from "./SourceAccountsTable";
import type { OwnAccountSourceRow } from "./types";

/** Context handed to each column renderer so cell JSX stays declarative. */
export type SourceAccountColumnRenderContext = {
    row:         OwnAccountSourceRow;
    t:           (key: string, vars?: Record<string, string | number>) => string;
    engineReady: boolean;
    onTransfer:  (row: OwnAccountSourceRow) => void;
    /** Whether the row's bank still has saved Login Credentials. False
     *  when the credentials were deleted (the bank account stays, but
     *  scraping-dependent actions — Transfer / Update Balance — are
     *  disabled). Bank-level (see the page's `banksWithCredentials`). */
    hasCredentials: boolean;
};

export type SourceAccountColumnDef = {
    /** Header alignment (defaults to "left"). */
    align?:          "left" | "right";
    /** Optional extra header className. */
    headerClassName?: string;
    /** Tailwind class applied to each `<TableCell>`. */
    cellClassName:   string;
    /** Renderer for the cell body. */
    renderBody:      (ctx: SourceAccountColumnRenderContext) => React.ReactNode;
};

export const SOURCE_ACCOUNTS_COLUMN_REGISTRY: Record<string, SourceAccountColumnDef> = {
    BANK_CD: {
        cellClassName: "py-2.5 pr-2.5 pl-2.5",
        renderBody:    ({ row }) => <BankCell row={row} />,
    },
    ACCT_NICK_NM: {
        cellClassName: "py-2.5 pr-4",
        renderBody:    ({ row }) => <PlainTextCell text={row.acctNickNm} />,
    },
    BAL: {
        align:         "right",
        cellClassName: "p-2.5 text-right",
        renderBody:    ({ row }) => <AmountCell value={row.balance} ccyCd={row.ccyCd} />,
    },
    AVI_BAL: {
        align:         "right",
        cellClassName: "p-2.5 text-right",
        renderBody:    ({ row }) => <AmountCell value={row.available} ccyCd={row.ccyCd} />,
    },
    ACCT_BAL_LST_STS: {
        headerClassName: "pl-4",
        cellClassName:   "py-2.5 pl-4",
        renderBody:      ({ row, t }) => (
            <LastRefreshCell
                t={t}
                stts={row.lastInquiryStts}
                lastInquiryAt={row.lastInquiryAt}
                successLabel={t("own_account_transfer.status.success")}
                failedLabel={t("own_account_transfer.status.failed")}
            />
        ),
    },
    ETC: {
        align:         "right",
        cellClassName: "p-2.5 text-right",
        renderBody:    ({ row, t, engineReady, onTransfer, hasCredentials }) => (
            <TransferActionCell
                row={row}
                engineReady={engineReady}
                hasCredentials={hasCredentials}
                onTransfer={onTransfer}
                label={t("own_account_transfer.row.transfer")}
                noCredentialsTooltip={t("own_account_transfer.no_credentials_tooltip")}
            />
        ),
    },
};

/** FIELD_ID → i18n key for the header label (and the View Setting
 *  popover row label via `getLabel`). Legacy `field_nm` falls through
 *  for unknown ids. */
export const SOURCE_ACCOUNTS_FIELD_LABEL_KEYS: Record<string, string> = {
    BANK_CD:          "own_account_transfer.col.bank",
    ACCT_NICK_NM:     "own_account_transfer.col.nickname",
    BAL:              "own_account_transfer.col.balance",
    AVI_BAL:          "own_account_transfer.col.available",
    ACCT_BAL_LST_STS: "own_account_transfer.col.last_refresh",
    ETC:              "own_account_transfer.col.action",
};
