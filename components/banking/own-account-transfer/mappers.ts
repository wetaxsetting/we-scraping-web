/**
 * Boundary mappers for Banking > Own Account Transfer.
 *
 * Wire types (snake_case, from {@code lib/types/api.ts}) cross the
 * mapper layer exactly once; downstream components / hooks see the
 * camelCase {@code OwnAccount*} shapes from {@code types.ts}. No
 * component reads a snake_case property directly — if a feature
 * grows a new column, extend the wire type AND the mapper here
 * before adding it to the UI.
 *
 * <p>Path A scope (2026-05-20). The composer-scope mappers
 * (`toOwnAccountTargetRow`, `toOwnAccountTargets`, history mappers)
 * were dropped together with their wire types when the backend
 * deferred /target-accounts, /transfer-history, /scraping-result to
 * the composer/execution MR. They land back here when those endpoints
 * exist.
 */

import type {
    ApiOwnAccountSourceListResponse,
    ApiOwnAccountSourceRow,
    ApiOwnAccountTargetListResponse,
    ApiOwnAccountTargetRow,
} from "@/lib/types/api";

import type {
    OwnAccountSourceRow,
    OwnAccountSourceTotals,
    OwnAccountTargetRow,
} from "./types";

const ENGINE_SUCCESS = "00000000";

export function toOwnAccountSourceRow(api: ApiOwnAccountSourceRow): OwnAccountSourceRow {
    const balance   = api.bal      ?? 0;
    const available = api.real_amt ?? balance;
    return {
        bankCd:              api.bank_cd,
        bankNm:              api.bank_nm ?? api.bank_cd,
        acctNo:              api.acct_no,
        acctNickNm:          api.acct_nick_nm ?? api.acct_no,
        acctTypeCd:          api.acct_type_cd,
        balance,
        available,
        ccyCd:               "VND",
        lastInquiryStts:     api.acct_bal_inq_stts,
        lastInquiryMsg:      api.acct_bal_inq_msg,
        lastInquiryAt:       api.acct_bal_lst_inq_dtm,
        lastBalanceUpdateAt: api.acct_bal_upd_dtm,
        canTransfer:         api.can_transfer,
    };
}

export function toOwnAccountSourceTotals(
    api: ApiOwnAccountSourceListResponse,
): OwnAccountSourceTotals {
    return {
        totalAccounts:  api.total_count,
        totalBalance:   api.tot_bal      ?? 0,
        totalAvailable: api.tot_avi_bal  ?? 0,
    };
}

/** True when the engine's last reported status code maps to a success. */
export function isEngineStatusSuccess(status: string | null | undefined): boolean {
    return status === ENGINE_SUCCESS;
}

/** Map a wire target-account row to the composer's in-memory shape. */
export function toOwnAccountTargetRow(api: ApiOwnAccountTargetRow): OwnAccountTargetRow {
    return {
        kind:        "OWN_ACCOUNT",
        bankCd:      api.bank_cd,
        bankNm:      api.bank_nm ?? api.bank_cd,
        acctNo:      api.acct_no,
        acctNickNm:  api.acct_nick_nm ?? api.acct_no,
        acctTypeCd:  api.acct_type_cd,
        ccyCd:       api.ccy_cd,
        napasBankCd: api.napas_bank_cd,
    };
}

/** Map the wire target-accounts response to a list of in-memory rows. */
export function toOwnAccountTargets(
    api: ApiOwnAccountTargetListResponse,
): OwnAccountTargetRow[] {
    return api.list.map(toOwnAccountTargetRow);
}
