/*
 * In-memory store behind every WeInvoice screen (read through useStore).
 *
 *  - mock mode (default): seeded from mockData.ts; resets on reload.
 *  - api mode (NEXT_PUBLIC_WEINVOICE_DATA_SOURCE=api): starts EMPTY and is filled from the backend
 *    by lib/api/weinvoice/remote.ts (hydrate after login); mutations update it from API responses.
 *    No mock record is ever shown in api mode.
 */
import { useSyncExternalStore } from "react";

import { buildSeed, STATE_VERSION, type DemoState } from "@/lib/api/weinvoice/mockData";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";

/** Empty state used in api mode before / instead of the mock seed. */
export function emptyState(): DemoState {
    return { version: STATE_VERSION, invoices: [], connections: [], tags: [], history: [], emails: [], mailboxes: [], subaccounts: [], portals: [], gdtVerified: {}, journalRules: [], activeTaxId: "", incomplete: [] };
}

const initialState = () => (DATA_SOURCE === "api" ? emptyState() : buildSeed());

let state: DemoState = initialState();
const listeners = new Set<() => void>();

export function getState(): DemoState {
    return state;
}

export function setState(mutator: (s: DemoState) => DemoState | void) {
    const draft = structuredClone(state);
    state = mutator(draft) ?? draft;
    listeners.forEach((l) => l());
}

export function resetState() {
    state = initialState();
    listeners.forEach((l) => l());
}

export function hasUserData(s: DemoState | null | undefined): boolean {
    return !!s && s.invoices.length > 0;
}

function subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: DemoState) => T): T {
    return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}
