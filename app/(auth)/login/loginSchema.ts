import { z } from "zod";

/**
 * Zod messages hold translation **keys**, not localized strings. The caller
 * (LoginForm) runs `t(key)` when surfacing the message in the Warning dialog,
 * so validation text follows the active locale without rebuilding the schema.
 *
 * Form field names are camelCase (`userId`, `password`) — semantic frontend
 * naming. The wire shape uses `user_id` / `user_pw`; the API client in
 * `lib/auth/client.ts` handles the wire ↔ form translation.
 */
export const loginSchema = z.object({
    userId: z
        .string()
        .trim()
        .min(1, "login.user_id_required")
        .max(50, "login.user_id_max"),
    password: z
        .string()
        .min(1, "login.password_required")
        .max(100, "login.password_max"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
