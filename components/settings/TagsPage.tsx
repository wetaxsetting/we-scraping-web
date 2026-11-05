"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import PageHeader from "@/components/shared/PageHeader";
import PageLayout from "@/components/shared/PageLayout";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/IconButton";
import { useDialog } from "@/components/shared/dialog";
import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { createTag, deleteTag, loadTags, TAG_PALETTE, tagUsage, updateTag } from "@/lib/api/weinvoice/tags";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";
import { cn } from "@/lib/utils";

/** Cài đặt → Quản lý tag hoá đơn. */
export default function TagsPage() {
    const { t } = useTranslation();
    const { confirm, toast } = useDialog();
    const tags = useStore((s) => s.tags);
    const invoices = useStore((s) => s.invoices);
    const [name, setName] = useState("");
    const usage = (id: string) => {
        const tag = tags.find((g) => g.id === id);
        return tag ? tagUsage(tag, invoices) : 0;
    };
    /** Runs a tag mutation; a backend failure (api mode) is shown, never a fake success. */
    const run = async (op: () => Promise<unknown>): Promise<boolean> => {
        try {
            await op();
            return true;
        } catch (e) {
            // No tag-specific UI message exists: show the backend message + code (WBE3014 name taken, …).
            toast(e instanceof WeInvoiceApiError ? `${e.message} (${e.code})` : (e as Error).message, "error");
            // WBE3013: the tag is gone on the server — re-read the list.
            if (e instanceof WeInvoiceApiError && e.code === "WBE3013") void loadTags().catch(() => undefined);
            return false;
        }
    };

    return (
        <PageLayout>
            <PageHeader title={t("nav.i.tags")} subtitle={t("tags.subtitle")} />
            <form
                className="flex max-w-[520px] items-center gap-2"
                onSubmit={async (e) => {
                    e.preventDefault();
                    const n = name.trim();
                    if (!n) return;
                    if (!(await run(() => createTag(n)))) return;
                    setName("");
                    toast(t("tag.created", { tag: n }));
                }}
            >
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("tag.new_ph")} className="h-9 flex-1 rounded-md px-3 text-wb-14 shadow-wb-outline outline-none focus:shadow-wb-focus" />
                <Button size="md" type="submit" variant="primary" icon={<Plus />}>{t("tag.create")}</Button>
            </form>
            <div className="max-w-[820px] overflow-hidden rounded-lg shadow-wb-card">
                <table className="w-full border-collapse text-wb-13">
                    <thead>
                        <tr className="h-[var(--h-wb-table-head)] border-b border-wb-table-border bg-wb-bg-sidebar text-left font-semibold text-wb-ntrl-8">
                            <th className="px-3">{t("tags.col.name")}</th>
                            <th className="px-3">{t("tags.col.color")}</th>
                            <th className="px-3 text-right">{t("tags.col.usage")}</th>
                            <th className="w-[60px]" />
                        </tr>
                    </thead>
                    <tbody>
                        {tags.map((g) => (
                            <tr key={g.id} className="h-14 border-b border-wb-table-border font-medium">
                                <td className="px-3">
                                    <input defaultValue={g.name} onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && void run(() => updateTag(g.id, { name: e.target.value.trim() }))} className="h-8 w-full max-w-[300px] rounded-md px-2 hover:shadow-wb-outline focus:shadow-wb-focus focus:outline-none" />
                                </td>
                                <td className="px-3">
                                    <div className="flex gap-1.5">
                                        {TAG_PALETTE.map((c) => (
                                            <button key={c} onClick={() => void run(() => updateTag(g.id, { color: c }))} className={cn("size-5 cursor-pointer rounded-full", g.color === c && "ring-2 ring-offset-2")} style={{ background: c, ["--tw-ring-color" as string]: c }} aria-label={c} />
                                        ))}
                                    </div>
                                </td>
                                <td className="px-3 text-right tabular-nums">{usage(g.id)}</td>
                                <td className="px-2 text-right">
                                    <IconButton
                                        title={t("common.delete")}
                                        className="hover:text-wb-red-07"
                                        onClick={async () => {
                                            if (await confirm({ title: t("tags.delete_title"), message: t("tags.delete_msg", { tag: g.name, n: usage(g.id) }), danger: true, confirmLabel: t("common.delete") })) await run(() => deleteTag(g.id));
                                        }}
                                    >
                                        <Trash2 />
                                    </IconButton>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </PageLayout>
    );
}
