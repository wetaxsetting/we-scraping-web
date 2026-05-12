import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`
 * (see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * This file runs server-side in front of every non-excluded route and is the
 * single sanctioned gate for authentication. Client-side route guards
 * (previously `app/(dashboard)/layout.tsx` with a `?preview=1` bypass) are
 * intentionally removed — they could be defeated by disabling JS, and the
 * query-string bypass was a production-grade security hole.
 *
 * Contract: the login flow mirrors the JWT into a non-HttpOnly
 * `wecms_token` cookie (see lib/auth/storage.ts). Axios keeps reading from
 * localStorage for the `Authorization` header so the existing request
 * pipeline is unchanged. If the cookie is missing the request is redirected
 * to `/login`, preserving the intended URL as `?next=…` so a successful
 * login can bounce the user back to where they were headed.
 */

const TOKEN_COOKIE = "wecms_token";
const PUBLIC_PREFIXES = ["/login"];

export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return NextResponse.next();
    }

    const hasToken = request.cookies.has(TOKEN_COOKIE);
    if (hasToken) return NextResponse.next();

    const loginUrl = new URL("/login", request.url);
    const target   = `${pathname}${search}`;
    if (target && target !== "/") {
        loginUrl.searchParams.set("next", target);
    }
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: [
        // Run on every request except the Next.js internals and
        // static assets. `templates/` exempts the slug-scoped
        // downloadable reference templates under
        // `public/templates/<slug>/...` (first consumer: VAS Account —
        // see `lib/api/vasAccount.ts downloadVasAccountTemplate`).
        // The legacy project served these ungated too; they carry no
        // tenant data, just blank reference forms with column headers.
        "/((?!_next/static|_next/image|favicon.ico|assets/|images/|templates/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
    ],
};
