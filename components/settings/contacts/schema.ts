import { z } from "zod";

/**
 * Zod schema for the Add / Edit Contact dialog. Mirrors the Spring
 * DTO `ContactsCreateRequest` validation constraints (`@NotBlank`,
 * `@Size`). Messages hold translation keys; the caller runs `t(key)`
 * when surfacing.
 *
 * <p>The reshape on `location` (Local ships `accounts[]`, Overseas
 * ships `overseas{}`) is enforced by a refinement at the root level:
 *   - Local: requires `accounts.length >= 1` and a non-blank
 *     `accounts[0].accountNo`.
 *   - Overseas: requires a non-blank `overseas.beneficiaryName`.
 * The opposite half is left as drafts that the mapper drops on submit.
 *
 * Server enforces the same rules — a client-side bypass surfaces as
 * `WBE_VALIDATION` from the envelope. The schema exists primarily to
 * gate the Submit button and render per-field messages instantly.
 */
const depositAccountSchema = z.object({
    id: z.string(),
    trcoAcctKey: z.string().optional(),
    bank: z.string().trim().max(200, "settings.contacts.validation.bank.max"),
    bankCd: z.string().trim().max(15),
    bankDiv: z.enum(["", "NAPAS", "CITAD"]),
    bankStatus: z.enum(["", "Y", "N"]),
    currency: z.enum(["", "VND", "USD"]),
    accountNo: z.string().trim().max(100, "settings.contacts.validation.accountNo.max"),
    recipient: z.string().trim().max(150, "settings.contacts.validation.recipient.max"),
    lookupVerified: z.boolean().optional(),
});

// Field names match the form-values type in `./types.ts` exactly.
// The earlier `beneficiaryBankAddress` here was a typo against
// `beneficiaryBankCode` in the form — when `buildValues()` set the
// `overseas` object, `beneficiaryBankAddress` was `undefined` and
// Zod's un-translated default message ("expected string, received
// undefined") leaked into the dialog. The dialog's `buildValues()`
// additionally `?? ""`s every field so a future field rename can't
// re-introduce the same class of bug.
const overseasSchema = z.object({
    trcoOvrsKey: z.string().optional(),
    beneficiaryName: z.string().trim().max(150, "settings.contacts.validation.beneficiaryName.max"),
    swiftCode: z.string().trim().max(20, "settings.contacts.validation.swiftCode.max"),
    beneficiaryAccountNo: z.string().trim().max(100, "settings.contacts.validation.beneficiaryAccountNo.max"),
    beneficiaryBankName: z.string().trim().max(200, "settings.contacts.validation.beneficiaryBankName.max"),
    beneficiaryBankCode: z.string().trim().max(20, "settings.contacts.validation.beneficiaryBankCode.max"),
    beneficiaryAddress: z.string().trim().max(500, "settings.contacts.validation.beneficiaryAddress.max"),
});

export const contactSchema = z
    .object({
        contactCode: z
            .string()
            .trim()
            .min(1, "settings.contacts.validation.contactCode.required")
            .max(20, "settings.contacts.validation.contactCode.max"),
        contactName: z
            .string()
            .trim()
            .min(1, "settings.contacts.validation.contactName.required")
            .max(200, "settings.contacts.validation.contactName.max"),
        taxId: z
            .string()
            .trim()
            .max(50, "settings.contacts.validation.taxId.max")
            // Mirrors legacy `comm_0184_002.ts:166` — when present,
            // must be exactly 10 digits or `10-3` digits (with optional
            // hyphen). Empty string passes (the field is optional).
            .refine((v) => {
                if (!v) return true;
                const digits = v.replace(/\D/g, "");
                return digits.length === 10 || digits.length === 13;
            }, "settings.contacts.validation.taxId.format"),
        location: z.enum(["local", "overseas"]),
        accounts: z.array(depositAccountSchema),
        overseas: overseasSchema,
        address: z
            .string()
            .trim()
            .min(1, "settings.contacts.validation.address.required")
            .max(400, "settings.contacts.validation.address.max"),
        changedAddress: z
            .string()
            .trim()
            .max(400, "settings.contacts.validation.changedAddress.max"),
        validTill: z.string(),
    })
    .superRefine((values, ctx) => {
        if (values.location === "local") {
            if (values.accounts.length < 1) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["accounts"],
                    message: "settings.contacts.validation.accounts.required",
                });
            } else {
                // Per-account checks. Skip silently-empty cards (no
                // bank picked AND no account no.) — mapper drops
                // those before wire. Cards with EITHER half filled
                // need both bank + account no., mirroring legacy
                // `validateRec1Item` at
                // `comm_0184_002_c001_act.jsp:83-87`.
                values.accounts.forEach((acc, i) => {
                    const halfFilled = !!acc.bankCd || !!acc.accountNo.trim();
                    if (!halfFilled) return;
                    if (!acc.bankCd) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ["accounts", i, "bankCd"],
                            message: "settings.contacts.validation.bank.required",
                        });
                    }
                    if (!acc.accountNo.trim()) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: ["accounts", i, "accountNo"],
                            message: "settings.contacts.validation.accountNo.required",
                        });
                    }
                });
            }
        } else {
            if (!values.overseas.beneficiaryName.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["overseas", "beneficiaryName"],
                    message: "settings.contacts.validation.beneficiaryName.required",
                });
            }
        }
    });

export type ContactSchemaIssue = {
    path: string;
    key: string;
};

/** Run the schema, return per-field issue keys or `null` on success. */
export function validateContact(values: unknown): ContactSchemaIssue[] | null {
    const result = contactSchema.safeParse(values);
    if (result.success) return null;
    return result.error.issues.map((iss) => ({
        path: iss.path.join("."),
        key: iss.message,
    }));
}
