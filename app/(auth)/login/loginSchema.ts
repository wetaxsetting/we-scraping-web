import { z } from "zod";

/**
 * Zod messages hold translation **keys**, not localized strings. The caller
 * (LoginForm) runs `t(key)` when surfacing the message in the Warning dialog,
 * so validation text follows the active locale without rebuilding the schema.
 */
export const loginSchema = z.object({
    USER_ID: z
        .string()
        .trim()
        .min(1, "login.user_id_required")
        .max(50, "login.user_id_max"),
    USER_PW: z
        .string()
        .min(1, "login.password_required")
        .max(100, "login.password_max"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
