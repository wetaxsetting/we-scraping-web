/**
 * Coverage for the credential **Type** column on the Registered Login
 * Credentials dialog.
 *
 * <p>Added 2026-08-27. Two credentials at the same institution were rendered
 * with Login ID only, so a Vietcom tenant holding both an iB@nking and a
 * DigiBiz login could not tell them apart — and since the Bank Account column
 * is bank-wide (legacy `BANK_CERT_INFO_R005` parity), both rows also showed the
 * same accounts. For Vietcom that distinction decides whether the bound
 * accounts can transfer at all (`trns_0001_007.ts` picks `TRANSFER_ML` for
 * CORPORATE, `TRANSFER` for DIGIBIZ), so the sub-type is now its own column.
 *
 * @see ../../../docs/bugs/own-account-transfer-vietcom-guard-message-2026-08-27.md
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/lib/i18n";

import RegisteredLoginCredentialsDialog, {
    type RegisteredCredentialEntry,
} from "./RegisteredLoginCredentialsDialog";

import en from "@/locales/en.json";
import ko from "@/locales/ko.json";
import vi from "@/locales/vi.json";

const TYPE_KEY = "settings.login_credentials.registered.col.login_type";

function renderDialog(entries: RegisteredCredentialEntry[]) {
    return render(
        <LocaleProvider>
            <RegisteredLoginCredentialsDialog
                institutionName="Vietcombank"
                entries={entries}
                onClose={() => {}}
            />
        </LocaleProvider>,
    );
}

describe("Registered Login Credentials — Type column", () => {
    it("registers the header key in every locale", () => {
        for (const [name, dict] of [
            ["en", en],
            ["ko", ko],
            ["vi", vi],
        ] as const) {
            const value = (dict as Record<string, string>)[TYPE_KEY];
            expect(value, `${name}.json is missing ${TYPE_KEY}`).toBeTruthy();
            expect(value.trim().length, `${name}.json has a blank ${TYPE_KEY}`)
                .toBeGreaterThan(0);
        }
    });

    it("renders the sub-type so two same-bank credentials are distinguishable", () => {
        renderDialog([
            { loginId: "vcb-digibiz-login",  loginType: "DigiBiz",   password: "p1", bankAccount: "0441000688210", extraAccountCount: 2 },
            { loginId: "vcb-ibanking-login", loginType: "Corporate", password: "p2", bankAccount: "0441000688210", extraAccountCount: 2 },
        ]);

        expect(screen.getByText("DigiBiz")).toBeInTheDocument();
        expect(screen.getByText("Corporate")).toBeInTheDocument();
    });

    it("falls back to an em-dash when the sub-type is absent or blank", () => {
        renderDialog([
            // Non-blank bankAccount on purpose: the Bank Account column renders
            // its OWN em-dash placeholder when empty, so a blank one here would
            // let this assertion pass even if the Type column were removed.
            { loginId: "gdt-user", password: "p1", bankAccount: "0441000688210", extraAccountCount: 0 },
            { loginId: "legacy-row", loginType: "   ", password: "p2", bankAccount: "1063895376", extraAccountCount: 0 },
        ]);

        // Exactly one em-dash per row, and every one of them is the Type cell.
        expect(screen.getAllByText("—")).toHaveLength(2);
    });
});
