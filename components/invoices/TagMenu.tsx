"use client";

import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { useDialog } from "@/components/shared/dialog";
import { Popover } from "@/components/shared/Popover";
import { getInvoices, setTags } from "@/lib/api/weinvoice/invoices";
import { WeInvoiceApiError } from "@/lib/api/weinvoice/http";
import { createTag } from "@/lib/api/weinvoice/tags";
import { useTranslation } from "@/lib/i18n";
import { useStore } from "@/lib/api/weinvoice/store";

/** Backend failure → message + code (no tag-specific UI message exists). */
const errText = (e: unknown) => (e instanceof WeInvoiceApiError ? `${e.message} (${e.code})` : (e as Error).message);

/** Assign / remove tags on one or many invoices (Invoy 🏷 + bulk tag). */
export default function TagMenu({ ids, trigger }: { ids: string[]; trigger: (toggle: () => void) => ReactNode }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const tags = useStore((s) => s.tags);
    useStore((s) => s.invoices); // refresh check states
    const [name, setName] = useState("");

    const state = (tagId: string) => {
        const list = getInvoices(ids);
        const n = list.filter((i) => i.tags.includes(tagId)).length;
        return n === 0 ? "none" : n === list.length ? "all" : "some";
    };

    return (
        <Popover align="right" width={260} trigger={({ toggle }) => trigger(toggle)}>
            <div className="p-3">
                <p className="mb-2 text-wb-11 font-medium uppercase text-wb-ntrl-6">{t("tag.assign", { n: ids.length })}</p>
                <div className="flex max-h-[220px] flex-col gap-2 overflow-auto">
                    {tags.map((g) => {
                        const st = state(g.id);
                        return (
                            <Checkbox
                                key={g.id}
                                checked={st === "all"}
                                indeterminate={st === "some"}
                                onChange={async () => {
                                    try {
                                        await setTags(ids, g.id, st !== "all");
                                        toast(st !== "all" ? t("tag.added", { tag: g.name, n: ids.length }) : t("tag.removed", { tag: g.name, n: ids.length }));
                                    } catch (err) {
                                        toast(errText(err), "error");
                                    }
                                }}
                                label={
                                    <span className="flex items-center gap-1.5">
                                        <span className="size-2.5 rounded-full" style={{ background: g.color }} />
                                        {g.name}
                                    </span>
                                }
                            />
                        );
                    })}
                </div>
                <form
                    className="mt-3 flex items-center gap-1.5 border-t border-wb-border-sidebar pt-3"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!name.trim()) return;
                        try {
                            const tag = await createTag(name.trim());
                            setName("");
                            await setTags(ids, tag.id, true);
                            toast(t("tag.created", { tag: tag.name }));
                        } catch (err) {
                            toast(errText(err), "error");
                        }
                    }}
                >
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t("tag.new_ph")}
                        className="h-8 min-w-0 flex-1 rounded-md px-2 text-wb-13 shadow-wb-outline outline-none focus:shadow-wb-focus"
                    />
                    <button type="submit" className="flex size-8 cursor-pointer items-center justify-center rounded-md bg-brand text-white hover:bg-brand-hover" aria-label={t("tag.create")}>
                        <Plus className="size-4" />
                    </button>
                </form>
            </div>
        </Popover>
    );
}
