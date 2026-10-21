/**
 * Regression coverage for the Own Account Transfer **credential gate** on the
 * source-accounts table.
 *
 * <p>Guards the parity fix of 2026-08-19: the gate was a bank-level
 * `Set<BANK_CD>` ("any account of this bank has a cert ⇒ enable every account
 * of this bank"), while legacy JEX resolves the credential **per account**:
 * `trns_0001_007.ts:1561-1584` and `:1896-1924` call
 * `_v2nxisas.getCertInfo(BANK_CERT_SEQ)` with the seq of the row being
 * transferred, and the linkage itself is per account — the Login-Credentials
 * Account Picker writes `ACCT_MSTR.BANK_CERT_SEQ` only for the accounts the
 * user ticks (legacy `fnsh_0101_001_c001` → refactor
 * `AccountRegistrationService:164/195`).
 *
 * <p>The bank-level aggregation therefore showed an ENABLED Transfer button on
 * accounts that resolve no credential, and the flow only failed one click
 * later inside the composer's own per-row pre-flight.
 *
 * @see ../../../docs/bugs/own-account-transfer-credential-gate-per-account-parity-2026-08-19.md
 * @see ../../../docs/audits/own-account-transfer-shinhan-transfer-button-disabled-audit-2026-08-19.md
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/lib/i18n";
import { hasSavedBankCert } from "@/lib/nxisas/jexjs-adapter";

import SourceAccountsTable from "./SourceAccountsTable";
import type { OwnAccountSourceRow } from "./types";
import type { ViewSettingItem } from "@/components/shared/view-setting";

/* ===================================================================
 *  Fixtures — the reported Shinhan VN rows (bank 11704088)
 * ================================================================= */

/** Only the columns the gate needs: the account label + the ETC action cell.
 *  `ViewSettingItem` is a WIRE type — lowercase snake_case properties
 *  (CLAUDE.md § API Naming), and the table reads `col.field_id`. */
const COLUMNS: ViewSettingItem[] = [
    { field_id: "ACCT_NICK_NM", field_nm: "Account Nickname", disp_ord: 1,  use_yn: "Y", sort_yn: "N", size: "200" },
    { field_id: "ETC",          field_nm: "",                 disp_ord: 99, use_yn: "Y", sort_yn: "N", size: "120" },
];

function row(over: Partial<OwnAccountSourceRow> = {}): OwnAccountSourceRow {
    return {
        bankCd: "11704088",
        bankNm: "Shinhan VN",
        acctNo: "700022499445",
        acctNickNm: "SHB 9445",
        acctTypeCd: "03",
        balance: 0,
        available: 0,
        ccyCd: "VND",
        lastInquiryStts: "00000000",
        lastInquiryMsg: "",
        lastInquiryAt: null,
        lastBalanceUpdateAt: null,
        canTransfer: true,
        // Linked + complete cert material (the enabled case).
        bankCertSeq: "18",
        certInfoCon: "WEBCASH01",
        nxisasGbSeqNo: "0",
        loginID: "WEBCASH01",
        loginPWD: "pw",
        ...over,
    };
}

/** A row in the reported state: `BANK_CERT_SEQ` points at a deleted
 *  credential, so the backend projects every cert field as null. */
function danglingRow(over: Partial<OwnAccountSourceRow> = {}): OwnAccountSourceRow {
    return row({
        acctNo: "703012365769",
        acctNickNm: "SHB 5769",
        bankCertSeq: "1",     // seq 1 no longer exists in BANK_CERT_INFO
        certInfoCon: null,
        loginID: null,
        loginPWD: null,
        nxisasGbSeqNo: null,
        ...over,
    });
}

function renderTable(rows: OwnAccountSourceRow[], onTransfer = vi.fn()) {
    render(
        <LocaleProvider>
            <SourceAccountsTable
                rows={rows}
                visibleColumns={COLUMNS}
                engineReady
                rowHasCredentials={(r) => hasSavedBankCert(r)}
                onTransfer={onTransfer}
            />
        </LocaleProvider>,
    );
    return { onTransfer };
}

/** Transfer buttons in document order, one per body row. */
function transferButtons(): HTMLButtonElement[] {
    return screen.getAllByRole("button", { name: /transfer/i }) as HTMLButtonElement[];
}

/* ===================================================================
 *  Tests
 * ================================================================= */

describe("Own Account Transfer — per-account credential gate", () => {
    it("enables Transfer on a row that resolves its own cert material", () => {
        renderTable([row()]);
        expect(transferButtons()[0].disabled).toBe(false);
    });

    it("disables Transfer on a row whose cert seq points at a deleted credential", () => {
        // The reported Shinhan state: bank_cert_seq set, every cert field null.
        renderTable([danglingRow()]);
        expect(transferButtons()[0].disabled).toBe(true);
    });

    it("gates PER ACCOUNT, not per bank — same bank, mixed linkage", () => {
        // THE REGRESSION. Under the old bank-level Set, the linked row put
        // 11704088 into the set and BOTH buttons rendered enabled.
        renderTable([row(), danglingRow()]);
        const [linked, unlinked] = transferButtons();
        expect(linked.disabled).toBe(false);
        expect(unlinked.disabled).toBe(true);
    });

    it("shows the credentials tooltip on the ungated row only", () => {
        renderTable([row(), danglingRow()]);
        expect(screen.queryByRole("tooltip")).toBeNull();

        // Hovering the linked row's cell must not open a tooltip…
        fireEvent.mouseEnter(transferButtons()[0]);
        expect(screen.queryByRole("tooltip")).toBeNull();

        // …while the unlinked row's wrapper does.
        const wrapper = transferButtons()[1].parentElement as HTMLElement;
        fireEvent.mouseEnter(wrapper);
        expect(screen.getByRole("tooltip").textContent).toContain("Login Credentials");
    });

    it("never fires onTransfer from a disabled row", () => {
        const { onTransfer } = renderTable([danglingRow()]);
        fireEvent.click(transferButtons()[0]);
        expect(onTransfer).not.toHaveBeenCalled();
    });

    it("still disables every row when the whole bank lost its credential", () => {
        // Fully-unlinked bank — unchanged from the previous behaviour, which is
        // the state the 2026-08-19 audit reported.
        renderTable([danglingRow({ acctNo: "700022499445", acctNickNm: "SHB 9445" }),
                     danglingRow({ acctNo: "700022964690", acctNickNm: "SHB 4690" }),
                     danglingRow({ acctNo: "703012202658", acctNickNm: "SHB 2658" }),
                     danglingRow()]);
        for (const b of transferButtons()) expect(b.disabled).toBe(true);
    });

    it("keeps the permission gate independent of credentials", () => {
        // `canTransfer` false (no W grant) must stay disabled even with a
        // complete cert — and must NOT claim the credentials are missing.
        renderTable([row({ canTransfer: false })]);
        expect(transferButtons()[0].disabled).toBe(true);
        fireEvent.mouseEnter(transferButtons()[0]);
        expect(screen.queryByRole("tooltip")).toBeNull();
    });
});
