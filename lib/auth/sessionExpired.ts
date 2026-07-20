/**
 * Session-expired event bus — single source of truth for the global
 * "your session has expired, please re-authenticate" flow.
 *
 * The flow:
 *   1. The Axios response interceptor catches a 401 and calls
 *      {@link requestReAuth}. That function returns a Promise that
 *      resolves once the user has either re-logged in (`true`) or
 *      cancelled the dialog (`false`).
 *   2. A single `<SessionExpiredDialog>` is mounted by the dashboard
 *      layout via {@link onReAuthRequest}. It opens whenever a request
 *      is queued and resolves the underlying promise from its UI.
 *   3. The interceptor retries the original request on success, or
 *      rejects with the original 401 on cancel so callers can render
 *      their own fallback (typically a redirect to `/login`).
 *
 * Multiple concurrent 401s collapse to one open dialog: every requester
 * waits on the same in-flight Promise, and they all settle together
 * once the user resolves it.
 */

export type ReAuthOutcome = "re_authenticated" | "cancelled";

type Resolver = (outcome: ReAuthOutcome) => void;
type Handler = () => void;

let pendingResolvers: Resolver[] = [];
let isPending = false;
let handler: Handler | null = null;

export function onReAuthRequest(fn: Handler): () => void {
    handler = fn;
    // Catch-up: a 401 can arrive before the dialog has mounted (page/reload
    // bootstrap) or during a route transition when no handler is registered.
    // Without this, `requestReAuth` would have latched `isPending = true`
    // with a null handler, the open would have been a silent no-op, and the
    // `if (!isPending)` guard would swallow every subsequent 401 until a full
    // reload. Re-emitting on registration makes the latch self-healing: the
    // dialog opens the moment a handler comes online for any still-pending
    // request. Idempotent — if the dialog is already open, the handler just
    // re-runs setOpen(true).
    if (isPending && pendingResolvers.length > 0) {
        queueMicrotask(() => handler?.());
    }
    return () => {
        if (handler === fn) handler = null;
    };
}

export function requestReAuth(): Promise<ReAuthOutcome> {
    return new Promise<ReAuthOutcome>((resolve) => {
        pendingResolvers.push(resolve);
        if (!isPending) {
            isPending = true;
            // Defer to the next microtask so React state updates fired
            // by the handler don't run inside the caller's interceptor.
            queueMicrotask(() => handler?.());
        }
    });
}

/** Called by the dialog when the user successfully re-authenticates. */
export function resolveReAuth(outcome: ReAuthOutcome) {
    const resolvers = pendingResolvers;
    pendingResolvers = [];
    isPending = false;
    for (const r of resolvers) r(outcome);
}

/** Whether a re-auth request is currently queued (used by the dialog
 *  provider for its open/closed state). */
export function isReAuthPending(): boolean {
    return isPending;
}
