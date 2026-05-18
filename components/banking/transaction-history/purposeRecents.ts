/**
 * Track the user's most-recently-picked Purpose codes for the
 * Transaction History picker. Mirrors the legacy `USER_USAG_USE_HIS`
 * pattern (per-user purpose-usage history) without a server round-
 * trip — recents live in `localStorage` keyed per active tenant +
 * user so two users on the same browser don't cross-contaminate.
 *
 * Capacity: `MAX_RECENTS` (5) — matches the legacy `comm_0186`
 * picker's RECENT section length.
 */

const MAX_RECENTS = 5;
const STORAGE_KEY = "wecms_txn_purpose_recents";

type RecentsBucket = { useUsagCds: string[] };

type RecentsByKey = Record<string, RecentsBucket>;

/** Compose the bucket key from the current tenant + user. Falls back
 *  to a shared bucket when either id is missing so the recents still
 *  work on an offline / not-yet-logged-in dev mount. */
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
        // Storage full / private mode — swallow; recents are best-effort.
    }
}

/** Read the recent picks for the active user. Most-recent first. */
export function readRecentPurposes(
    bizKey: string | null,
    userId: string | null,
): string[] {
    const all = readAll();
    return all[bucketKey(bizKey, userId)]?.useUsagCds ?? [];
}

/** Push a new pick to the front of the recents list (de-duped). */
export function pushRecentPurpose(
    bizKey: string | null,
    userId: string | null,
    useUsagCd: string,
): void {
    if (!useUsagCd) return;
    const all = readAll();
    const key = bucketKey(bizKey, userId);
    const prev = all[key]?.useUsagCds ?? [];
    const next = [useUsagCd, ...prev.filter((c) => c !== useUsagCd)].slice(
        0,
        MAX_RECENTS,
    );
    all[key] = { useUsagCds: next };
    writeAll(all);
}
