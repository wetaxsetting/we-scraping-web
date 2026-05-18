/**
 * Per-user MRU cache for the Contact picker — mirrors the Purpose /
 * VAS recents helpers. localStorage, capacity 5, bucketed by
 * (`bizKey`, `userId`).
 */

const MAX_RECENTS = 5;
const STORAGE_KEY = "wecms_txn_contact_recents";

type RecentsBucket = { trcoKeys: string[] };
type RecentsByKey = Record<string, RecentsBucket>;

function bucketKey(bizKey: string | null, userId: string | null): string {
    return `${bizKey ?? "anon"}::${userId ?? "anon"}`;
}

function readAll(): RecentsByKey {
    if (typeof window === "undefined") return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as RecentsByKey;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function writeAll(state: RecentsByKey): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // private mode / quota — recents are best-effort.
    }
}

export function readRecentContacts(
    bizKey: string | null,
    userId: string | null,
): string[] {
    const all = readAll();
    return all[bucketKey(bizKey, userId)]?.trcoKeys ?? [];
}

export function pushRecentContact(
    bizKey: string | null,
    userId: string | null,
    trcoKey: string,
): void {
    if (!trcoKey) return;
    const all = readAll();
    const key = bucketKey(bizKey, userId);
    const prev = all[key]?.trcoKeys ?? [];
    const next = [trcoKey, ...prev.filter((k) => k !== trcoKey)].slice(
        0,
        MAX_RECENTS,
    );
    all[key] = { trcoKeys: next };
    writeAll(all);
}
