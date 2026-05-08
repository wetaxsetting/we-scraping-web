/**
 * Contacts panel — Settings popup submenu (Figma 9194:9683).
 *
 * Static UI types for the contact directory the user manages from the
 * Settings popup. Each row is one contact (Local or Overseas) carrying
 * the deposit account the company pays into. Backend wiring lands later.
 */

export type ContactLocation = "local" | "overseas";

/**
 * Deposit account display block.
 *
 * `bankName` is shown bold on the first line followed by a small bank-icon;
 * `accountNo` is the muted line below. For Overseas contacts the Figma
 * frame renders the recipient's personal name as `bankName` and the SWIFT
 * code as `accountNo` — the visual contract is the same, only the source
 * of the strings differs by location.
 */
export type ContactDepositAccount = {
    bankName: string;
    accountNo: string;
};

export type ContactRow = {
    id: string;
    contactCode: string;
    contactName: string;
    location: ContactLocation;
    taxId: string;
    deposit: ContactDepositAccount;
    /**
     * Address list — `addresses[0]` is the (Current) Address shown in
     * the table cell. Anything past index 0 (e.g. a prior / changed
     * address recorded in Settings > Contacts > Add New Contact) is
     * counted into the `+N` badge rendered alongside the primary line.
     * Always non-empty: every contact has at least a current address.
     */
    addresses: string[];
};
