/*
 * Provider catalogue (screen 16 · Công cụ → Danh mục NCC).
 *
 *  - mock mode: the static catalogue in lib/weinvoice/providers.ts (screen filters locally).
 *  - api mode: `GET /providers?keyword=&link_status=` (backend interface-specification § "Catalogue
 *    and tags", DTO `ProviderItem`) — a plain array (no paging) with the tenant's invoice count per
 *    provider.
 */
import { wiGet } from "@/lib/api/weinvoice/http";
import type { Provider } from "@/lib/weinvoice/providers";

/** Server-side `link_status`: ok · check (catalogue review note) · missing (no lookup link). */
export type ProviderLinkStatus = "ok" | "check" | "missing";

/** `ProviderItem` (camelCased). `lookupUrl` is null when `linkStatus` is `missing`. */
export type ProviderRec = Omit<Provider, "lookupUrl" | "captchaUrl" | "altLookupUrls" | "verify"> & {
    lookupUrl: string | null;
    captchaUrl: string | null;
    altLookupUrls: string[];
    verify: string | null;
    linkStatus: ProviderLinkStatus;
    invoiceCount: number;
    /** The engine has an adapter that fetches the original PDF. */
    autoPdf: boolean;
};

export type ProviderList = { rows: ProviderRec[]; totalCount: number };

export async function listProviders(q: { keyword?: string; linkStatus?: ProviderLinkStatus }): Promise<ProviderList> {
    const rows = await wiGet<ProviderRec[] | null>("/providers", { keyword: q.keyword?.trim() || undefined, linkStatus: q.linkStatus });
    const list = (rows ?? []).map((p) => ({ ...p, altLookupUrls: p.altLookupUrls ?? [] }));
    return { rows: list, totalCount: list.length };
}
