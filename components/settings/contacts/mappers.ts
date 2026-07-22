import type {
    ApiContactAccountOp,
    ApiContactAccountRow,
    ApiContactAddressOp,
    ApiContactAddressRow,
    ApiContactCreateRequest,
    ApiContactDetail,
    ApiContactOverseasOp,
    ApiContactOverseasRow,
    ApiContactRow,
    ApiContactType,
    ApiContactUpdateRequest,
} from "@/lib/types/api";

import type {
    ContactFormValues,
    ContactLocation,
    ContactRow,
    DepositAccountFormValues,
} from "./types";

/* =================================================================
 *  Wire → in-memory (list path)
 * ================================================================= */

export function locationFromType(type: ApiContactType): ContactLocation {
    return type === "O" ? "overseas" : "local";
}

export function locationToType(location: ContactLocation): ApiContactType {
    return location === "overseas" ? "O" : "L";
}

/**
 * Wire row → in-memory list row. The Spring `ContactListResponse`
 * ships the FULL graph on every list row (addresses + accounts +
 * overseas beneficiaries), so we derive the presentation values
 * (primary address, primary bank, deposit-account display block,
 * extra-address count) on the frontend.
 *
 * <p>Address ordering: primary = `disp_ord === 1` row, falling back
 * to the first address when no row carries disp_ord=1 (defensive
 * against legacy data). Extras = every other address row.
 *
 * <p>Bank-name resolution comes pre-resolved on `bank_nm` per the
 * V86 OQ-7 contract — falls back to the verbatim copy stored on the
 * row when the function returned NULL, and finally to an empty
 * string so the cell never goes visually blank.
 */
export function toContactRow(row: ApiContactRow): ContactRow {
    const location = locationFromType(row.trco_type);
    const addresses = sortAddresses(row.addresses);
    const currentRow = addresses.find((a) => a.disp_ord === 1) ?? addresses[0] ?? null;
    const previousRow = addresses.find((a) => a.disp_ord === 2) ?? null;
    const primaryAddress = currentRow?.trco_bsun_post_adrs ?? "";
    const extraAddresses = addresses
        .filter((a) => a !== currentRow)
        .map((a) => a.trco_bsun_post_adrs ?? "")
        .filter((s) => s.length > 0);

    const primaryDeposit = derivePrimaryDeposit(row, location);

    return {
        id: row.trco_key,
        trcoKey: row.trco_key,
        contactCode: row.hand_trco_key,
        contactName: row.trco_cmnm,
        location,
        taxId: row.trco_tax_id ?? "",
        deposit: primaryDeposit,
        addresses: [primaryAddress, ...extraAddresses],
        addressDetail: {
            current: primaryAddress,
            previous:
                previousRow && (previousRow.trco_bsun_post_adrs ?? "").length > 0
                    ? {
                        value: previousRow.trco_bsun_post_adrs ?? "",
                        // Keep the raw `yyyyMMdd` — the popover formats
                        // it per the active locale via
                        // `formatDateLang`. Mapper stays locale-free.
                        validDate: previousRow.due_dt ?? null,
                    }
                    : null,
        },
    };
}

/**
 * Primary deposit-account block — bank name + account number for the
 * table cell. Local rows pull from `accounts[0]`; Overseas rows from
 * `overseas_beneficiaries[0]`. Both paint the same UI shape — bold
 * bank/beneficiary name on top, muted account/swift number below.
 */
function derivePrimaryDeposit(row: ApiContactRow, location: ContactLocation) {
    if (location === "local") {
        const acc = sortAccounts(row.accounts)[0];
        return {
            bankName: acc?.bank_nm ?? "",
            accountNo: acc?.acct_no ?? "",
        };
    }
    const ovr = row.overseas_beneficiaries[0];
    return {
        bankName: ovr?.bene_name ?? "",
        accountNo: ovr?.bic_code ?? "",
    };
}

function sortAddresses(rows: ApiContactAddressRow[]): ApiContactAddressRow[] {
    return rows
        .slice()
        .sort((a, b) => (a.disp_ord ?? 99) - (b.disp_ord ?? 99));
}

function sortAccounts(rows: ApiContactAccountRow[]): ApiContactAccountRow[] {
    return rows
        .slice()
        .sort((a, b) => (a.disp_ord ?? 99) - (b.disp_ord ?? 99));
}

/* =================================================================
 *  Wire → in-memory (form-values seed for the Edit dialog)
 * ================================================================= */

export function toFormValues(detail: ApiContactDetail): ContactFormValues {
    const addresses = sortAddresses(detail.addresses);
    const current = addresses.find((a) => a.disp_ord === 1) ?? addresses[0] ?? null;
    const previous = addresses.find((a) => a.disp_ord === 2) ?? null;

    const accountSeeds: DepositAccountFormValues[] = sortAccounts(detail.accounts).map(
        (acc) => {
            const napas = acc.napas_bank_cd ?? "";
            const citad = acc.citad_bank_cd ?? "";
            const bankDiv = napas ? "NAPAS" : citad ? "CITAD" : "";
            return {
                id: `acc-${acc.trco_acct_key}`,
                trcoAcctKey: acc.trco_acct_key,
                bank: acc.bank_nm ?? "",
                bankCd: napas || citad,
                bankDiv: bankDiv as "" | "NAPAS" | "CITAD",
                // Edit-time bank status is unknown without a second
                // lookup; default to 'Y' so the verified flow renders.
                // The user can clear and re-pick a bank to refresh.
                bankStatus: "Y",
                currency: (acc.acct_ccy_cd === "USD" ? "USD" : "VND") as "VND" | "USD",
                accountNo: acc.acct_no ?? "",
                recipient: acc.finc_mda_owner_nm ?? "",
                lookupVerified: true,
            };
        },
    );

    const overseasRow: ApiContactOverseasRow | undefined =
        detail.overseas_beneficiaries[0];

    return {
        contactCode: detail.hand_trco_key,
        contactName: detail.trco_cmnm,
        contactEnglishName: detail.trco_cmenm ?? "",
        taxId: detail.trco_tax_id ?? "",
        location: locationFromType(detail.trco_type),
        accounts: accountSeeds.length > 0
            ? accountSeeds
            : [emptyAccount(`acc-seed-${detail.trco_key}`)],
        // Server keys for the sub-row collections — preserved on
        // submit so the backend's `op: 'upsert'` ops keep editing
        // the same rows. New sub-rows added by the dialog get fresh
        // client-side keys via `nextClientKey()`.
        existingAddressKeys: {
            currentKey: current?.trco_addr_key,
            previousKey: previous?.trco_addr_key,
        },
        existingOverseasKey: overseasRow?.trco_ovrs_key,
        overseas: {
            beneficiaryName: overseasRow?.bene_name ?? "",
            swiftCode: overseasRow?.bic_code ?? "",
            beneficiaryAccountNo: overseasRow?.bene_acct_no ?? "",
            beneficiaryBankName: overseasRow?.bene_bank_name ?? "",
            beneficiaryBankCode: overseasRow?.bene_bank_code ?? "",
            beneficiaryAddress: overseasRow?.bene_addr ?? "",
            town: overseasRow?.bene_town_nm ?? "",
        },
        address: current?.trco_bsun_post_adrs ?? "",
        changedAddress: previous?.trco_bsun_post_adrs ?? "",
        validTill: previous ? toIsoDate(previous.due_dt) : "",
    };
}

export function emptyAccount(id: string): DepositAccountFormValues {
    return {
        id,
        bank: "",
        bankCd: "",
        bankDiv: "",
        bankStatus: "",
        // Default currency mirrors the legacy popup's pre-selected
        // option (Currency - VND) so the dropdown isn't empty.
        currency: "VND",
        accountNo: "",
        recipient: "",
        lookupVerified: false,
    };
}

/* =================================================================
 *  In-memory → wire (write path)
 * ================================================================= */

/** Sentinel due-date for the fallback path. Legacy stamps
 *  {@code moment().add(1, 'days').format('YYYYMMDD')} on the current
 *  address row — `tomorrowYyyyMmDd()` reproduces that exactly. The
 *  far-future sentinel is only used when the user clears Valid Till
 *  on a previous-address row but keeps the address text. */
const FAR_FUTURE_DUE_DT = "99991231";

export function toCreateRequest(values: ContactFormValues): ApiContactCreateRequest {
    return buildBody(values);
}

export function toUpdateRequest(values: ContactFormValues): ApiContactUpdateRequest {
    // Detect previously-existing sub-rows that the user dropped from
    // the form so they translate to `op: "delete"` on the wire (the
    // Spring controller folds REC4 / REC6 deletes into the same body).
    const presentAcctKeys = new Set(
        values.accounts.map((a) => a.trcoAcctKey).filter(Boolean) as string[],
    );
    const accountsToDelete = (values.deletedAccountKeys ?? [])
        .filter((k) => !presentAcctKeys.has(k))
        .map((trcoAcctKey) => ({ trco_acct_key: trcoAcctKey }));

    // Overseas symmetric path — populated when the user confirmed a
    // location switch (Overseas → Local) in edit mode, so the
    // previously-saved beneficiary row(s) get dropped server-side.
    // Mirrors legacy `comm_0184_005` REC6 deletes.
    const presentOvrsKey = values.location === "overseas"
        ? values.existingOverseasKey
        : undefined;
    const overseasToDelete = (values.deletedOverseasKeys ?? [])
        .filter((k) => k !== presentOvrsKey)
        .map((trcoOvrsKey) => ({ trco_ovrs_key: trcoOvrsKey }));

    return {
        ...buildBody(values),
        // Edit endpoint never flips trash from this UI surface; the
        // bulk-delete + per-row delete endpoints own that transition.
        trco_stts: null,
        accounts_to_delete: accountsToDelete,
        overseas_to_delete: overseasToDelete,
    };
}

function buildBody(values: ContactFormValues): ApiContactCreateRequest {
    const addresses = buildAddressOps(values);
    const isLocal = values.location === "local";
    const accounts: ApiContactAccountOp[] = isLocal
        ? values.accounts
            // Skip incomplete cards (no bank picked + no account no.)
            // so they don't fail the per-account bean-validation on
            // the server. Mirrors legacy `comm_0184_002_c001.jsp:75`
            // (only validate cards with a bank code).
            .filter((acc) => acc.bankCd || acc.accountNo.trim())
            .map((acc, idx) => ({
                op: "upsert" as const,
                trco_acct_key: acc.trcoAcctKey || nextClientKey(`A${idx}`),
                // Legacy splits the bank into NAPAS_BANK_CD / CITAD_BANK_CD
                // based on which kind of bank was picked. Mirrors
                // `comm_0184_002.ts:424-441`.
                napas_bank_cd: acc.bankDiv === "NAPAS" ? acc.bankCd : null,
                citad_bank_cd: acc.bankDiv === "CITAD" ? acc.bankCd : null,
                bank_nm: acc.bank.trim() || null,
                acct_no: acc.accountNo.trim() || null,
                acct_ccy_cd: acc.currency || null,
                finc_mda_owner_nm: acc.recipient.trim() || null,
                disp_ord: idx + 1,
            }))
        : [];

    const overseasBeneficiaries: ApiContactOverseasOp[] = !isLocal
        ? [
            {
                op: "upsert",
                trco_ovrs_key: values.existingOverseasKey || nextClientKey("O"),
                bene_name: values.overseas.beneficiaryName.trim() || null,
                bic_code: values.overseas.swiftCode.trim() || null,
                bene_acct_no: values.overseas.beneficiaryAccountNo.trim() || null,
                bene_bank_name: values.overseas.beneficiaryBankName.trim() || null,
                bene_bank_code: values.overseas.beneficiaryBankCode.trim() || null,
                bene_addr: values.overseas.beneficiaryAddress.trim() || null,
                bene_town_nm: values.overseas.town.trim() || null,
            },
        ]
        : [];

    return {
        hand_trco_key: values.contactCode.trim(),
        trco_cmnm: values.contactName.trim(),
        // Spring DTO has `trco_cmenm` as @NotBlank. If the dialog
        // didn't surface the English-name field yet, fall back to the
        // primary name so the wire never carries an empty string.
        trco_cmenm: (values.contactEnglishName.trim() || values.contactName.trim()),
        trco_tax_id: values.taxId.trim() || null,
        trco_type: locationToType(values.location),
        addresses,
        accounts,
        overseas_beneficiaries: overseasBeneficiaries,
    };
}

function buildAddressOps(values: ContactFormValues): ApiContactAddressOp[] {
    const ops: ApiContactAddressOp[] = [];
    const currentAddress = values.address.trim();
    if (currentAddress) {
        ops.push({
            op: "upsert",
            trco_addr_key:
                values.existingAddressKeys?.currentKey || nextClientKey("AD1"),
            disp_ord: 1,
            trco_bsun_post_adrs: currentAddress,
            issu_dt: todayYyyyMmDd(),
            // Legacy stamps today+1 on the current-address row. The
            // refactor preserves this exactly (see Save handler in
            // `comm_0184_002.ts:357-358`).
            due_dt: tomorrowYyyyMmDd(),
        });
    }

    const previousAddress = values.changedAddress.trim();
    if (previousAddress) {
        ops.push({
            op: "upsert",
            trco_addr_key:
                values.existingAddressKeys?.previousKey || nextClientKey("AD2"),
            disp_ord: 2,
            trco_bsun_post_adrs: previousAddress,
            issu_dt: todayYyyyMmDd(),
            // Legacy uses the user-picked Valid Till on the
            // previous-address row (`comm_0184_002.ts:455`). Falls back
            // to the far-future sentinel when the user reveals the
            // block but clears the date.
            due_dt: fromIsoDate(values.validTill) || FAR_FUTURE_DUE_DT,
        });
    } else if (values.existingAddressKeys?.previousKey) {
        // User cleared the (Changed) Address block in Edit mode →
        // emit a delete op so the previous-address row is removed.
        ops.push({
            op: "delete",
            trco_addr_key: values.existingAddressKeys.previousKey,
        });
    }

    return ops;
}

/* =================================================================
 *  Helpers
 * ================================================================= */

/**
 * Client-side key generator for new sub-rows. Mirrors the legacy
 * SeqHelper.getNextVal behaviour the backend expects on the
 * write path — the Spring `AddressOp` / `AccountOp` / `OverseasOp`
 * records mark `trco_*_key` `@NotBlank`, so a placeholder fresh
 * id keeps the request shape valid.
 *
 * Format: `C<prefix><14-char timestamp><4-digit suffix>`. ≤ 20 chars
 * to fit the legacy VARCHAR(20) PK column.
 */
let keyCounter = 0;
function nextClientKey(prefix: string): string {
    keyCounter = (keyCounter + 1) % 10000;
    const d = new Date();
    const ts =
        d.getUTCFullYear().toString().padStart(4, "0") +
        (d.getUTCMonth() + 1).toString().padStart(2, "0") +
        d.getUTCDate().toString().padStart(2, "0") +
        d.getUTCHours().toString().padStart(2, "0") +
        d.getUTCMinutes().toString().padStart(2, "0") +
        d.getUTCSeconds().toString().padStart(2, "0");
    return `${prefix.slice(0, 3)}${ts}${keyCounter.toString().padStart(4, "0")}`.slice(
        0,
        20,
    );
}

/** `yyyyMMdd` → `yyyy-MM-dd` for the native `<input type="date">`. */
function toIsoDate(yyyyMmDd: string | null | undefined): string {
    if (!yyyyMmDd || yyyyMmDd.length !== 8) return "";
    return `${yyyyMmDd.slice(0, 4)}-${yyyyMmDd.slice(4, 6)}-${yyyyMmDd.slice(6, 8)}`;
}

/** `yyyy-MM-dd` (HTML date input) → `yyyyMMdd` (legacy wire). */
function fromIsoDate(iso: string): string {
    if (!iso) return "";
    return iso.replace(/-/g, "");
}

function todayYyyyMmDd(): string {
    return ymd(new Date());
}

/** `today + 1 day` in `yyyyMMdd` — used as the legacy default DUE_DT
 *  for current-address rows (`moment().add(1,'days')`). */
function tomorrowYyyyMmDd(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return ymd(d);
}

function ymd(d: Date): string {
    return (
        d.getFullYear().toString().padStart(4, "0") +
        (d.getMonth() + 1).toString().padStart(2, "0") +
        d.getDate().toString().padStart(2, "0")
    );
}
