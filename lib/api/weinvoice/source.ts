/**
 * Where the WeInvoice data layer reads from.
 *
 *   NEXT_PUBLIC_WEINVOICE_DATA_SOURCE=api   → the backend (`/api/v1/weinvoice/*`)
 *   anything else / unset (default)          → the in-memory mock store
 *
 * Inlined at build time (`NEXT_PUBLIC_*`). Modules switch one at a time as their endpoints exist;
 * a module without an API implementation keeps using the mock regardless of this flag.
 */
export const DATA_SOURCE: "api" | "mock" = process.env.NEXT_PUBLIC_WEINVOICE_DATA_SOURCE === "api" ? "api" : "mock";
