/**
 * Per-user MRU cache for the VAS Account picker. Mirrors the
 * Purpose-recents helper — `localStorage`, capacity 5, bucketed by
 * (`bizKey`, `userId`).
 */

const MAX_RECENTS = 5;
const STORAGE_KEY = "wecms_txn_vas_recents";

type RecentsBucket = { vasAcctCds: string[] };
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
        // private mode / quota exceeded — recents are best-effort.
    }
}

export function readRecentVasAccounts(
    bizKey: string | null,
    userId: string | null,
): string[] {
    const all = readAll();
    return all[bucketKey(bizKey, userId)]?.vasAcctCds ?? [];
}

export function pushRecentVasAccount(
    bizKey: string | null,
    userId: string | null,
    vasAcctCd: string,
): void {
    if (!vasAcctCd) return;
    const all = readAll();
    const key = bucketKey(bizKey, userId);
    const prev = all[key]?.vasAcctCds ?? [];
    const next = [vasAcctCd, ...prev.filter((c) => c !== vasAcctCd)].slice(
        0,
        MAX_RECENTS,
    );
    all[key] = { vasAcctCds: next };
    writeAll(all);
}
