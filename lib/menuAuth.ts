import type { StoredUser } from "@/lib/auth/storage";
import type { TopMenuKey } from "@/components/layout/topMenu";

/**
 * Menu Authorization Framework (MENU-1) — frontend half.
 *
 * The backend `/api/v1/auth/me` returns `allMenus` (admin bypass) +
 * `allowedMenuCds` (granted leaf slugs from `USER_MENU_AUTH_INFM`,
 * e.g. `addon-einvoices-sales`). This module maps those slugs to the
 * top-nav modules, the sidebar items, and the app routes so the UI can:
 *   - show a top module only if ≥1 of its leaves is granted,
 *   - show a sidebar item only if its route's leaf is granted,
 *   - redirect a direct URL hit to an ungranted page.
 *
 * The leaf slugs are the same ids the Menu Entitlement screen writes
 * (`ENTITLEMENT_SECTIONS` item ids). Admins bypass everything via
 * `allMenus`. The backend is the source of truth; this is presentation
 * + client routing only (server-side per-menu API enforcement is a
 * documented follow-up).
 */

/** Route prefix → granted leaf slug. Detail `[id]` routes match by
 *  prefix. Resolved longest-prefix-first so `…account-inquiry-fcy`
 *  wins over `…account-inquiry`. Routes not listed fall back to
 *  section-level gating (see {@link isRouteAllowed}). */
const ROUTE_MENU_MAP: ReadonlyArray<{ prefix: string; cd: string | readonly string[]; noLanding?: boolean }> = [
    // Add-on Service
    { prefix: "/addon/sales-einvoices", cd: "addon-einvoices-sales" },
    { prefix: "/addon/expenses-einvoices", cd: "addon-einvoices-expenses" },
    { prefix: "/addon/operation-status", cd: "addon-operation-status-inquiry" },
    { prefix: "/addon/tax-filing", cd: "addon-vat-declaration" },
    // Banking
    { prefix: "/banking/account-inquiry-fcy", cd: "banking-fcy-update-inquire" },
    { prefix: "/banking/account-inquiry", cd: "banking-vnd-account-inquiry" },
    { prefix: "/banking/transaction-history-fcy", cd: "banking-fcy-inquire-transactions" },
    { prefix: "/banking/transaction-history", cd: "banking-vnd-inquire-transactions" },
    // Smart Organizer operates on transactions; the backend gates it on
    // canAccessAny(VND, FCY inquire-transactions). Any-of here mirrors that —
    // either grant admits. Not a sidebar item (reached from the transaction
    // flow), so noLanding keeps it out of the fallback-home set.
    {
        prefix: "/banking/smart-organizer",
        cd: ["banking-vnd-inquire-transactions", "banking-fcy-inquire-transactions"],
        noLanding: true,
    },
    { prefix: "/banking/transfer-own-accounts", cd: "banking-internal-transfer-own" },
    { prefix: "/banking/own-account-transfer", cd: "banking-internal-transfer-own" },
    { prefix: "/banking/transfer-history", cd: "banking-internal-transfer-history" },
    // Bank Credentials is a Login-Credentials management surface that lives
    // under /banking by URL but is gated by the SETTINGS entitlement (matches
    // backend BankCredentialController @menuAuthz.canAccess('settings-core-
    // login-credentials')). Cross-section: the leaf-code check in
    // isRouteAllowed is authoritative, not the /banking URL prefix. noLanding
    // keeps this contextual page out of the fallback-home set.
    { prefix: "/banking/credentials", cd: "settings-core-login-credentials", noLanding: true },
    { prefix: "/banking/reports/daily-cash", cd: "banking-reports-daily-cash" },
    // HaengSung Daily Financial (rept_0017_001) has its OWN permission code,
    // distinct from the standard F/M Daily Financial (rept_0015_001). Matches
    // the backend seed (V243) so an H user's grant + route guard resolve to the
    // same code. SORTED_ROUTE_MAP matches the longer `-hs` prefix first, so the
    // standard `/banking/reports/daily-financial` entry below still resolves
    // correctly for F/M.
    { prefix: "/banking/reports/daily-financial-hs", cd: "banking-reports-daily-financial-hs" },
    { prefix: "/banking/reports/daily-financial", cd: "banking-reports-daily-financial" },
    { prefix: "/banking/reports/cash-flow", cd: "banking-reports-cash-flow" },
    // Payment
    { prefix: "/payment/approval-box", cd: "payment-approval-box" },
    { prefix: "/payment/internal-transfer/scheduled-transfer", cd: "payment-internal-transfer-scheduled" },
    { prefix: "/payment/internal-transfer/transfer-result", cd: "payment-internal-transfer-result" },
    { prefix: "/payment/vendor-payment/scheduled-payment", cd: "payment-vendor-scheduled" },
    { prefix: "/payment/vendor-payment/payment-result", cd: "payment-vendor-result" },
    { prefix: "/payment/expense-payment/scheduled-payment", cd: "payment-expense-scheduled" },
    { prefix: "/payment/expense-payment/payment-result", cd: "payment-expense-result" },
    { prefix: "/payment/payroll/scheduled-payment", cd: "payment-payroll-scheduled" },
    { prefix: "/payment/payroll/payment-result", cd: "payment-payroll-result" },
    { prefix: "/payment/overseas-payment/scheduled-payment", cd: "payment-overseas-request" },
    { prefix: "/payment/overseas-payment/payment-result", cd: "payment-overseas-result" },
    { prefix: "/payment/overseas-payment/exchange-rate-inquiry", cd: "payment-overseas-exchange" },
    { prefix: "/payment/corporate-card/card-transactions", cd: "payment-corporate-card-transactions" },
];

/** Longest-prefix-first so more specific routes match before their
 *  parents (e.g. the FCY twin before the VND base). */
const SORTED_ROUTE_MAP = [...ROUTE_MENU_MAP].sort((a, b) => b.prefix.length - a.prefix.length);

/** Normalise a route entry's permission code(s) to an any-of list. */
function cdsOf(cd: string | readonly string[]): readonly string[] {
    return typeof cd === "string" ? [cd] : cd;
}

/** First mapped route per leaf slug — used to pick a landing route.
 *  `noLanding` entries (contextual / cross-section pages like Bank
 *  Credentials and Smart Organizer) are skipped so they never become a
 *  fallback home; array entries register each of their codes. */
const CD_ROUTE = new Map<string, string>();
for (const entry of ROUTE_MENU_MAP) {
    if (entry.noLanding) continue;
    for (const cd of cdsOf(entry.cd)) {
        if (!CD_ROUTE.has(cd)) CD_ROUTE.set(cd, entry.prefix);
    }
}

/** Top-nav module a leaf slug belongs to, from its first token
 *  (`addon-einvoices-sales` → `addon`). */
function sectionOf(cd: string): TopMenuKey | null {
    const head = cd.split("-", 1)[0];
    return head === "banking" || head === "payment" || head === "addon" || head === "settings"
        ? head
        : null;
}

/** Top-nav module a route belongs to. */
export function routeSection(pathname: string): TopMenuKey | null {
    if (pathname.startsWith("/banking")) return "banking";
    if (pathname.startsWith("/payment")) return "payment";
    if (pathname.startsWith("/addon")) return "addon";
    if (pathname.startsWith("/settings")) return "settings";
    return null;
}

/** True when the user is granted at least one leaf in the module
 *  (admins bypass). Drives top-nav + sidebar-group visibility. */
export function isSectionAllowed(section: TopMenuKey, user: StoredUser | null | undefined): boolean {
    if (user?.allMenus) return true;
    // `settings-core-users` is a valid Settings grant — a non-admin holding
    // it sees Settings → Users (read-only). It therefore drives visibility
    // like any other slug (no exclusion).
    return (user?.allowedMenuCds ?? []).some((cd) => sectionOf(cd) === section);
}

/** True when the specific leaf slug is granted (admins bypass). */
export function isMenuAllowed(cd: string, user: StoredUser | null | undefined): boolean {
    if (user?.allMenus) return true;
    return (user?.allowedMenuCds ?? []).includes(cd);
}

/** Resolve a route to its permission code(s) (longest-prefix; any-of).
 *  Null when the route isn't a mapped menu page. */
export function routeMenuCds(pathname: string): readonly string[] | null {
    for (const e of SORTED_ROUTE_MAP) {
        if (pathname.startsWith(e.prefix)) return cdsOf(e.cd);
    }
    return null;
}

/** Back-compat single-slug resolver — the primary (first) code for a
 *  route, or null. Prefer {@link routeMenuCds} for gating. */
export function routeMenuCd(pathname: string): string | null {
    const cds = routeMenuCds(pathname);
    return cds ? cds[0] : null;
}

/**
 * Whether the caller may view a route. Admins → always. Non-module
 * routes (no section, e.g. `/`) → allowed (the dashboard shell, profile,
 * etc. are not menu-gated).
 *
 * A MAPPED route is gated precisely by its leaf permission code(s) —
 * any-of, and authoritative across sections: a `/banking` page may be
 * gated by a `settings-*` code (Bank Credentials), and Smart Organizer
 * is admitted by either the VND or FCY inquire-transactions code. Holding
 * a leaf code already implies its section is allowed, so this is
 * equivalent to the previous section∧leaf check for every same-section
 * route and only changes the cross-section / any-of cases.
 *
 * An UNMAPPED route falls back to the coarse module/section gate: allowed
 * iff the user holds any leaf in that module (never false-block a page we
 * didn't map).
 */
export function isRouteAllowed(pathname: string, user: StoredUser | null | undefined): boolean {
    if (user?.allMenus) return true;
    const section = routeSection(pathname);
    if (!section) return true;
    const cds = routeMenuCds(pathname);
    if (cds) return cds.some((cd) => isMenuAllowed(cd, user));
    return isSectionAllowed(section, user);
}

/**
 * A safe landing route for a user whose current route is not allowed:
 * the first granted leaf that maps to a real route. Returns null when
 * the user is an admin (caller uses the default home) or has no granted
 * route at all (caller shows a "no menus" state instead of redirecting,
 * which avoids a redirect loop).
 */
export function firstAllowedRoute(user: StoredUser | null | undefined): string | null {
    if (!user || user.allMenus) return null;
    for (const cd of user.allowedMenuCds) {
        const route = CD_ROUTE.get(cd);
        if (route) return route;
    }
    return null;
}
