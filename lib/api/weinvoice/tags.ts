/*
 * Tags (screen 18 · Cài đặt → Quản lý tag).
 *
 *  - mock mode (default): in-memory store, unchanged behaviour.
 *  - api mode — backend interface-specification § "Catalogue and tags" (DTOs `TagItem`,
 *    `TagRequest`):
 *      GET    /tags        → [{ id, name, color, invoice_count }]
 *      POST   /tags        { name, color? }  → tag     (WBE3014 name taken)
 *      PATCH  /tags/{id}   { name?, color? } → tag     (WBE3013 not found · WBE3014)
 *      DELETE /tags/{id}   → null                      (WBE3013)
 *    Every mutation calls the endpoint first and only then updates the store from the response; a
 *    failure throws WeInvoiceApiError.
 */
import type { Tag } from "@/lib/weinvoice/types";
import { wiDelete, wiGet, wiPatch, wiPost } from "@/lib/api/weinvoice/http";
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { getState, setState } from "@/lib/api/weinvoice/store";

const PALETTE = ["#0060b9", "#04662e", "#c50712", "#8a5a00", "#6b3fa0", "#009688", "#b5447a", "#525252"];

/**
 * `TagItem` (camelCased): the UI `Tag` plus the tenant-wide usage count. In api mode the store holds
 * these, so the screen shows the backend count instead of counting the (partial) client cache.
 */
export type TagWithUsage = Tag & { invoiceCount?: number };

/** Usage count for a tag: the backend count in api mode, else what the store holds. */
export function tagUsage(tag: Tag, invoices: { tags: string[] }[]): number {
    const n = (tag as TagWithUsage).invoiceCount;
    return DATA_SOURCE === "api" && typeof n === "number" ? n : invoices.filter((i) => i.tags.includes(tag.id)).length;
}

/** API mode: `GET /tags` → store.tags. No-op in mock mode. */
export async function loadTags(): Promise<void> {
    if (DATA_SOURCE !== "api") return;
    const tags = (await wiGet<TagWithUsage[] | null>("/tags")) ?? [];
    setState((s) => {
        s.tags = tags;
    });
}

export async function createTag(name: string, color?: string): Promise<Tag> {
    const c = color ?? PALETTE[getState().tags.length % PALETTE.length];
    if (DATA_SOURCE === "api") {
        const tag = await wiPost<TagWithUsage>("/tags", { name: name.trim(), color: c });
        setState((s) => {
            s.tags.push({ invoiceCount: 0, ...tag });
        });
        return tag;
    }
    const tag: Tag = { id: `tag-${Date.now().toString(36)}`, name: name.trim(), color: c };
    setState((s) => {
        s.tags.push(tag);
    });
    return tag;
}

export async function updateTag(id: string, patch: Partial<Omit<Tag, "id">>): Promise<void> {
    if (DATA_SOURCE === "api") {
        const saved = await wiPatch<TagWithUsage | null>(`/tags/${encodeURIComponent(id)}`, patch);
        setState((s) => {
            const t = s.tags.find((x) => x.id === id);
            if (t) Object.assign(t, patch, saved ?? {});
        });
        return;
    }
    setState((s) => {
        const t = s.tags.find((x) => x.id === id);
        if (t) Object.assign(t, patch);
    });
}

/** Removing a tag also detaches it from every invoice. */
export async function deleteTag(id: string): Promise<void> {
    if (DATA_SOURCE === "api") await wiDelete(`/tags/${encodeURIComponent(id)}`);
    setState((s) => {
        s.tags = s.tags.filter((t) => t.id !== id);
        for (const inv of s.invoices) if (inv.tags.includes(id)) inv.tags = inv.tags.filter((t) => t !== id);
    });
}

export const TAG_PALETTE = PALETTE;
