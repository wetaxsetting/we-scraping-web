/**
 * Draft wire rule (weinvoice-api-integration-2026-11-03.md § "All endpoints request"): where the
 * backend note does not name a field, the wire name is the snake_case of the UI type's camelCase
 * field (`sellerTaxId` ↔ `seller_tax_id`). These two helpers apply that rule to keys only, deeply;
 * values (codes, ids, dates) are never touched.
 */
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function mapKeys(v: unknown, f: (k: string) => string): unknown {
    if (Array.isArray(v)) return v.map((x) => mapKeys(x, f));
    if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
        return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [f(k), mapKeys(x, f)]));
    }
    return v;
}

/** UI object → wire body (camelCase → snake_case keys). */
export const snakify = <T = unknown>(v: unknown): T => mapKeys(v, toSnake) as T;
/** Wire data → UI object (snake_case → camelCase keys). */
export const camelize = <T = unknown>(v: unknown): T => mapKeys(v, toCamel) as T;
