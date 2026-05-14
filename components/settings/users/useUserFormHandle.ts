import { useRef, type RefObject } from "react";

import type { UserFormDraft } from "./types";

/**
 * Imperative handle exposed by the Add / Edit user forms so the
 * `<UsersPanel>` toolbar (which owns the Save button) can read the
 * current draft + check password confirmation in one call.
 *
 * <p>The forms stay uncontrolled (refs on every `<input>` + checkbox),
 * matching the existing static-UI convention — switching to controlled
 * state or RHF would be a much larger refactor and the backend
 * validates every field already.
 */
export type UserFormHandle = {
    /** Read the current draft. Returns `null` when the password and
     *  confirm-password don't match — the form fires the validation
     *  dialog itself and the parent skips the Save call. */
    collect(): UserFormDraft | null;
};

export function useUserFormHandleRef(): RefObject<UserFormHandle | null> {
    return useRef<UserFormHandle | null>(null);
}
