/**
 * Cross-modal ESC stack — coordinates which open modal handles the next
 * Escape keypress when several modals are stacked.
 *
 * Why this exists:
 *   The app has two parallel modal mechanisms — Radix `<Dialog>` (stacked
 *   feature dialogs) and custom shells (`SettingsModal`, `SystemDialog`).
 *   Radix's own `DismissableLayer` already serialises ESC across Radix
 *   Dialogs, but it cannot see the custom shells. Without a shared stack,
 *   pressing ESC fires every shell's document-level keydown listener AND
 *   Radix's onEscapeKeyDown for the topmost Radix Dialog at the same time
 *   — which closes both the child and the parent in one keystroke.
 *
 * How callers use it:
 *   On open, push() and keep the returned id. On close/unmount, pop(id).
 *   In every ESC handler, call isTop(id) before dismissing — only the
 *   top-of-stack modal should respond to Escape.
 *
 * Module-level state is intentional — there's exactly one stack per
 * window, mirroring the visible modal chain.
 */
let nextId = 0;
const stack: number[] = [];

export const modalStack = {
    /** Register a modal as open and return its stack id. Call on mount/open. */
    push(): number {
        const id = ++nextId;
        stack.push(id);
        return id;
    },
    /** Remove a modal from the stack. Call on unmount/close. */
    pop(id: number): void {
        const i = stack.lastIndexOf(id);
        if (i >= 0) stack.splice(i, 1);
    },
    /** Whether the modal owning `id` is the topmost open modal. */
    isTop(id: number): boolean {
        return stack[stack.length - 1] === id;
    },
};
