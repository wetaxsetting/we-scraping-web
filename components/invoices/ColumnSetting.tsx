"use client";

import { ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Columns3, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { LabeledCheckbox as Checkbox } from "@/components/shared/LabeledCheckbox";
import { useDialog } from "@/components/shared/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn, storage } from "@/lib/utils";

/**
 * View Setting — port of wecms-web components/shared/view-setting/ViewSettingPopover:
 * show/hide columns, reorder (first / up / down / last on the selected row),
 * Reset to default, Save / Cancel. Edits are a draft until Save.
 * Persistence: localStorage now; real build → USER_SCR_OPTION (per user + screenId), like WeCMS.
 */
export type ViewColumn<K extends string> = { key: K; visible: boolean };

export function useViewSetting<K extends string>(screenId: string, defaults: ViewColumn<K>[]) {
    const storageKey = `weinvoice.viewsetting.${screenId}`;
    const [cols, setCols] = useState<ViewColumn<K>[]>(defaults);
    useEffect(() => {
        const saved = storage.get<ViewColumn<K>[] | null>(storageKey, null);
        if (saved && Array.isArray(saved)) {
            // keep only known keys, append columns added after the user saved
            const known = new Set(defaults.map((d) => d.key));
            const merged = saved.filter((s) => known.has(s.key));
            defaults.forEach((d) => {
                if (!merged.some((m) => m.key === d.key)) merged.push({ ...d, visible: false });
            });
            setCols(merged);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey]);
    return {
        cols,
        save: (next: ViewColumn<K>[]) => {
            setCols(next);
            storage.set(storageKey, next);
        },
        reset: () => {
            setCols(defaults);
            storage.remove(storageKey);
        },
    };
}

const POPUP_W = 340;

export function ViewSettingButton<K extends string>({
    cols,
    defaults,
    locked = [],
    label,
    onSave,
    onReset,
}: {
    cols: ViewColumn<K>[];
    defaults: ViewColumn<K>[];
    locked?: K[];
    label: (key: K) => string;
    onSave: (next: ViewColumn<K>[]) => void;
    onReset: () => void;
}) {
    const { t } = useTranslation();
    const { confirm, toast } = useDialog();
    const btn = useRef<HTMLButtonElement>(null);
    const pop = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(cols);
    const [sel, setSel] = useState<K | null>(null);
    const [rect, setRect] = useState<DOMRect | null>(null);

    const openPopover = () => {
        setDraft(cols);
        setSel(null);
        setRect(btn.current?.getBoundingClientRect() ?? null);
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        const onDoc = (e: MouseEvent) => {
            const tgt = e.target as Node;
            // ignore clicks inside the popover, on the trigger, or inside a confirm dialog
            if (pop.current?.contains(tgt) || btn.current?.contains(tgt) || (tgt as HTMLElement).closest?.("[role=dialog]")) return;
            setOpen(false);
        };
        const id = setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
        window.addEventListener("keydown", onKey);
        return () => {
            clearTimeout(id);
            document.removeEventListener("mousedown", onDoc);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const style = useMemo<React.CSSProperties>(() => {
        if (!rect || typeof window === "undefined") return {};
        let left = rect.right - POPUP_W;
        left = Math.max(8, Math.min(left, window.innerWidth - POPUP_W - 8));
        return { top: rect.bottom + 6, left, width: POPUP_W };
    }, [rect]);

    const isLocked = (k: K) => locked.includes(k);
    const move = (dir: "first" | "prev" | "next" | "last") => {
        if (!sel) return;
        const idx = draft.findIndex((c) => c.key === sel);
        const dest = dir === "first" ? 0 : dir === "prev" ? Math.max(0, idx - 1) : dir === "next" ? Math.min(draft.length - 1, idx + 1) : draft.length - 1;
        if (idx < 0 || dest === idx) return;
        const next = draft.slice();
        const [it] = next.splice(idx, 1);
        next.splice(dest, 0, it);
        setDraft(next);
    };
    const canMove = !!sel;
    const shown = draft.filter((c) => c.visible).length;
    const dirty = JSON.stringify(draft) !== JSON.stringify(cols);

    return (
        <>
            <Button size="md" ref={btn} variant="neutral" icon={<Columns3 />} onClick={() => (open ? setOpen(false) : openPopover())}>
                {t("vs.button")}
            </Button>
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div ref={pop} style={style} className="wb-fade-in fixed z-40 flex max-h-[min(520px,calc(100vh-120px))] flex-col rounded-[10px] bg-white shadow-wb-popup">
                        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-3 py-2">
                            <span className="text-wb-14 font-medium leading-8 text-black">
                                {t("vs.title")} <span className="text-wb-12 font-normal text-wb-ntrl-6">({shown}/{draft.length})</span>
                            </span>
                            <div className="flex items-center gap-1">
                                {([
                                    ["first", <ChevronsUp key="a" />],
                                    ["prev", <ChevronUp key="b" />],
                                    ["next", <ChevronDown key="c" />],
                                    ["last", <ChevronsDown key="d" />],
                                ] as const).map(([d, icon]) => (
                                    <button
                                        key={d}
                                        type="button"
                                        title={t(`vs.${d}`)}
                                        aria-label={t(`vs.${d}`)}
                                        disabled={!canMove}
                                        onClick={() => move(d)}
                                        className={cn("flex size-7 items-center justify-center rounded-md bg-white text-wb-ntrl-10 shadow-wb-btn [&_svg]:size-4", canMove ? "cursor-pointer hover:bg-wb-bg-active" : "cursor-not-allowed opacity-40")}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="shrink-0 px-3 pt-2 text-wb-12 text-wb-ntrl-6">{t("vs.hint")}</p>
                        <div role="listbox" className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1">
                            {draft.map((c) => (
                                <div
                                    key={c.key}
                                    role="option"
                                    tabIndex={0}
                                    aria-selected={sel === c.key}
                                    onClick={() => setSel(c.key)}
                                    onKeyDown={(e) => {
                                        if (e.key === "ArrowUp") { e.preventDefault(); move("prev"); }
                                        if (e.key === "ArrowDown") { e.preventDefault(); move("next"); }
                                    }}
                                    className={cn("flex cursor-pointer items-center gap-2 rounded-[5px] px-2.5 py-2", sel === c.key ? "bg-brand-softer" : "hover:bg-wb-bg-active")}
                                >
                                    <Checkbox
                                        checked={c.visible}
                                        disabled={isLocked(c.key)}
                                        onChange={(v) => setDraft((d) => d.map((x) => (x.key === c.key ? { ...x, visible: v } : x)))}
                                    />
                                    <span className="flex-1 text-wb-14-tight font-medium text-wb-ntrl-8">{label(c.key)}</span>
                                    {isLocked(c.key) && <span className="text-wb-11 text-wb-ntrl-5">{t("vs.locked")}</span>}
                                </div>
                            ))}
                        </div>
                        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-black/10 p-3">
                            <button
                                type="button"
                                onClick={async () => {
                                    if (await confirm({ title: t("vs.reset"), message: t("vs.reset_confirm") })) {
                                        onReset();
                                        setDraft(defaults);
                                        setOpen(false);
                                        toast(t("vs.reset_done"));
                                    }
                                }}
                                className="mr-auto flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-wb-14 font-medium text-wb-ntrl-10 shadow-wb-btn"
                            >
                                <RotateCcw className="size-4" /> {t("vs.reset")}
                            </button>
                            <button
                                type="button"
                                disabled={!dirty}
                                onClick={() => {
                                    onSave(draft);
                                    setOpen(false);
                                    toast(t("vs.saved"));
                                }}
                                className="flex h-8 cursor-pointer items-center rounded-md bg-brand px-3 text-wb-14 font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {t("common.save")}
                            </button>
                            <button type="button" onClick={() => setOpen(false)} className="flex h-8 cursor-pointer items-center rounded-md bg-white px-3 text-wb-14 font-medium text-wb-ntrl-10 shadow-wb-btn">
                                {t("common.cancel")}
                            </button>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}
