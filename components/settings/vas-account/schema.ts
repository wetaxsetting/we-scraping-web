import { z } from "zod";

/**
 * Zod schema for the Add / Edit VAS Account dialog. Mirrors the
 * Spring DTO `VasAccountCreateRequest` validation constraints
 * (`@NotBlank`, `@Size`, `@Pattern`). Messages hold translation keys;
 * the caller runs `t(key)` when surfacing the error so the dialog
 * follows the active locale without rebuilding the schema.
 *
 * Form field names are camelCase — semantic frontend naming. The
 * `toCreateRequest` / `toUpdateRequest` mappers translate to the
 * snake_case wire body.
 *
 * Server enforces the same rules, so a client-side bypass (DOM edit,
 * disabled hook) is harmless: backend bean-validation fires and the
 * envelope surfaces as `WBE_VALIDATION`. The schema exists primarily
 * to gate the Submit button and render per-field messages instantly.
 */
export const vasAccountSchema = z.object({
    vasCode: z
        .string()
        .trim()
        .min(3, "settings.vas_account.validation.vasCode.length")
        .max(15, "settings.vas_account.validation.vasCode.length")
        .regex(/^[A-Za-z0-9_]+$/, "settings.vas_account.validation.vasCode.format"),
    accountName: z
        .string()
        .trim()
        .min(1, "settings.vas_account.validation.accountName.required")
        .max(50, "settings.vas_account.validation.accountName.max"),
    status: z.enum(["active", "inactive"]),
});

export type VasAccountSchemaIssue = {
    /** Form field name (e.g. `"vasCode"`). */
    path: string;
    /** Translation key from the schema messages. */
    key: string;
};

/** Run the schema, return per-field issue keys or `null` on success.
 *  Caller decides how to surface (per-field inline message + Submit
 *  disable, or shared error dialog).
 *
 *  Returns `null` on success so the caller can do
 *  `if (!issues) submit();`. */
export function validateVasAccount(values: unknown): VasAccountSchemaIssue[] | null {
    const result = vasAccountSchema.safeParse(values);
    if (result.success) return null;
    return result.error.issues.map((iss) => ({
        path: iss.path.join("."),
        key: iss.message,
    }));
}
