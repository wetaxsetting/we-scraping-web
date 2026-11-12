"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, FileCode2, FilePlus2, FileText, KeyRound, Loader2, MailWarning, type LucideIcon } from "lucide-react";

import { Popover } from "@/components/shared/Popover";
import { useDialog } from "@/components/shared/dialog";
import {
    getUnreadCount,
    listNotifications,
    markAllNotificationsRead,
    markNotificationsRead,
    NOTIFICATION_PAGE_SIZE,
    notificationTarget,
    type Notification,
    type NotificationFilter,
    type NotificationType,
} from "@/lib/api/weinvoice/notifications";
import { useStore } from "@/lib/api/weinvoice/store";
import { setActiveTaxId } from "@/lib/api/weinvoice/sync";
import { humanizeIso, type TFunc } from "@/lib/datetime";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Badge poll interval while the tab is visible (approved layout: 60 s). */
export const UNREAD_POLL_MS = 60_000;

const FILTERS: NotificationFilter[] = ["mst", "all", "action"];
const ICONS: Record<NotificationType, LucideIcon> = {
    NEW_INVOICES: FilePlus2,
    XML_READY: FileCode2,
    PDF_READY: FileText,
    GDT_LOGIN_ERROR: KeyRound,
    MAILBOX_ERROR: MailWarning,
};

/** "99+" above 99; null (no badge) at 0. */
export function badgeText(n: number): string | null {
    if (n <= 0) return null;
    return n > 99 ? "99+" : String(n);
}

function title(n: Notification, t: TFunc): string {
    const count = n.count ?? 0;
    switch (n.type) {
        case "NEW_INVOICES":
            return t(n.direction === "mua" ? "notif.new_purchase" : n.direction === "ban" ? "notif.new_sales" : "notif.new_invoices", { n: count });
        case "XML_READY":
            return t("notif.xml_ready", { n: count });
        case "PDF_READY": {
            const parts = [
                n.fromProvider ? t("notif.pdf_from_provider", { n: n.fromProvider }) : "",
                n.fromEmail ? t("notif.pdf_from_email", { n: n.fromEmail }) : "",
            ].filter(Boolean);
            const head = t("notif.pdf_ready", { n: count });
            return parts.length ? `${head} · ${parts.join(", ")}` : head;
        }
        case "GDT_LOGIN_ERROR":
            return t("notif.gdt_login_error");
        case "MAILBOX_ERROR":
            return t("notif.mailbox_error");
        default:
            return n.message ?? n.type;
    }
}

function detail(n: Notification, t: TFunc): string {
    const months = n.type === "NEW_INVOICES" ? n.months : [];
    const what = months.length
        ? months
              .map((ym) => {
                  const [y, m] = ym.split("-");
                  return y && m ? t("notif.month", { m: Number(m), y }) : ym;
              })
              .join(", ")
        : n.type === "MAILBOX_ERROR"
          ? (n.address ?? n.companyName ?? "")
          : (n.companyName ?? "");
    const cta = n.type === "GDT_LOGIN_ERROR" ? t("notif.cta.password") : n.type === "MAILBOX_ERROR" ? t("notif.cta.mailbox") : t("notif.cta.view");
    return [n.companyMst ?? "", what, cta].filter(Boolean).join(" · ");
}

type PanelState = { items: Notification[]; total: number; page: number; status: "idle" | "loading" | "ready" | "error"; more: boolean };
const EMPTY: PanelState = { items: [], total: 0, page: 0, status: "idle", more: false };

export default function NotificationBell({ className }: { className?: string }) {
    const { t } = useTranslation();
    const { toast } = useDialog();
    const router = useRouter();
    const activeTaxId = useStore((s) => s.activeTaxId);

    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState<NotificationFilter>("mst");
    const [panel, setPanel] = useState<PanelState>(EMPTY);
    /** Ignores answers to a request superseded by a newer one (filter switch, reopen). */
    const seq = useRef(0);

    const refreshCount = useCallback(() => {
        getUnreadCount()
            .then(setUnread)
            .catch(() => undefined); // keep the last count; the next poll retries
    }, []);

    // Badge: load now, then every 60 s while the tab is visible; catch up when it becomes visible again.
    useEffect(() => {
        refreshCount();
        const timer = window.setInterval(() => {
            if (!document.hidden) refreshCount();
        }, UNREAD_POLL_MS);
        const onVisible = () => {
            if (!document.hidden) refreshCount();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [refreshCount]);

    const load = (f: NotificationFilter, page: number) => {
        const my = ++seq.current;
        setPanel((p) => (page === 0 ? { ...EMPTY, status: "loading" } : { ...p, status: "loading" }));
        listNotifications({ filter: f, companyMst: activeTaxId || undefined, page, size: NOTIFICATION_PAGE_SIZE })
            .then((r) => {
                if (my !== seq.current) return;
                setPanel((p) => {
                    const items = page === 0 ? r.items : [...p.items, ...r.items];
                    return { items, total: r.totalCount, page, status: "ready", more: items.length < r.totalCount && r.items.length > 0 };
                });
            })
            .catch(() => {
                if (my === seq.current) setPanel((p) => ({ ...p, status: "error" }));
            });
    };

    const onOpenChange = (o: boolean) => {
        setOpen(o);
        if (o) {
            load(filter, 0);
            refreshCount();
        }
    };

    const pickFilter = (f: NotificationFilter) => {
        if (f === filter && panel.status !== "error") return;
        setFilter(f);
        load(f, 0);
    };

    const markAll = async () => {
        const mst = filter === "mst" ? activeTaxId || undefined : undefined;
        try {
            await markAllNotificationsRead(mst);
            setPanel((p) => ({ ...p, items: p.items.map((n) => (!mst || n.companyMst === mst ? { ...n, read: true } : n)) }));
        } catch {
            toast(t("notif.read_all_failed"), "error");
        }
        refreshCount();
    };

    const openItem = (n: Notification) => {
        if (!n.read) {
            setPanel((p) => ({ ...p, items: p.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
            setUnread((u) => Math.max(0, u - 1));
            // Not awaited: navigation never waits for the read call; the badge is re-read when it settles.
            markNotificationsRead([n.id])
                .catch(() => undefined)
                .finally(refreshCount);
        }
        const target = notificationTarget(n);
        if (target.companyMst && target.companyMst !== activeTaxId) {
            setActiveTaxId(target.companyMst);
            toast(t("header.switched", { mst: target.companyMst }), "info");
        }
        setOpen(false);
        router.push(target.href);
    };

    const badge = badgeText(unread);
    const hasUnread = panel.items.some((n) => !n.read);

    return (
        <Popover
            align="right"
            width={400}
            className="max-w-[calc(100vw-24px)]"
            rootClassName={className}
            open={open}
            onOpenChange={onOpenChange}
            trigger={({ toggle }) => (
                <button
                    type="button"
                    onClick={toggle}
                    className="relative flex size-8 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10"
                    aria-label={badge ? `${t("header.notifications")} — ${t("notif.unread_badge", { n: unread })}` : t("header.notifications")}
                    aria-expanded={open}
                >
                    <Bell className="size-5" />
                    {badge && (
                        <span
                            data-testid="notif-badge"
                            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-wb-error px-1 text-wb-10 font-semibold text-white ring-2 ring-brand"
                        >
                            {badge}
                        </span>
                    )}
                </button>
            )}
        >
            <div className="flex max-h-[min(560px,calc(100vh-80px))] flex-col">
                <div className="flex items-center justify-between gap-2 border-b border-wb-border-sidebar px-4 pt-3 pb-2">
                    <p className="text-wb-15 font-semibold text-wb-ink">{t("notif.title")}</p>
                    <button
                        type="button"
                        onClick={markAll}
                        disabled={!hasUnread && unread === 0}
                        className="cursor-pointer text-wb-12 font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-wb-ntrl-6 disabled:no-underline"
                    >
                        {t("notif.mark_all_read")}
                    </button>
                </div>
                <div className="flex flex-wrap gap-1.5 border-b border-wb-border-sidebar px-4 py-2" role="group" aria-label={t("notif.title")}>
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            aria-pressed={filter === f}
                            onClick={() => pickFilter(f)}
                            className={cn(
                                "h-7 cursor-pointer rounded-full px-3 text-wb-12 font-medium transition-colors",
                                filter === f ? "bg-brand text-white" : "bg-wb-bg-sidebar text-wb-ink hover:bg-brand-soft",
                            )}
                        >
                            {t(`notif.filter.${f}`)}
                        </button>
                    ))}
                </div>

                <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
                    {panel.status === "error" && panel.items.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                            <p className="text-wb-13 text-wb-ntrl-7">{t("notif.load_failed")}</p>
                            <button type="button" onClick={() => load(filter, 0)} className="cursor-pointer text-wb-13 font-medium text-brand hover:underline">
                                {t("common.retry")}
                            </button>
                        </div>
                    ) : panel.status === "loading" && panel.items.length === 0 ? (
                        <div role="status" className="flex items-center justify-center gap-2 px-4 py-8 text-wb-13 text-wb-ntrl-6">
                            <Loader2 className="size-4 animate-spin" />
                            {t("common.loading")}
                        </div>
                    ) : panel.status === "ready" && panel.items.length === 0 ? (
                        <p className="px-4 py-8 text-center text-wb-13 text-wb-ntrl-6">{t("notif.empty")}</p>
                    ) : (
                        <ul>
                            {panel.items.map((n) => {
                                const Icon = ICONS[n.type] ?? Bell;
                                return (
                                    <li key={n.id}>
                                        <button
                                            type="button"
                                            onClick={() => openItem(n)}
                                            data-unread={!n.read || undefined}
                                            className={cn(
                                                "flex w-full cursor-pointer items-start gap-3 border-b border-wb-border-sidebar px-4 py-2.5 text-left hover:bg-wb-bg-sidebar",
                                                !n.read && "bg-brand-soft",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                                                    n.action ? "bg-wb-status-rejected-bg text-wb-status-rejected-text" : "bg-brand-softer text-brand",
                                                )}
                                            >
                                                <Icon className="size-4" />
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                <span className={cn("text-wb-13 text-wb-ink", !n.read ? "font-semibold" : "font-medium")}>{title(n, t)}</span>
                                                <span className="truncate text-wb-12 text-wb-ntrl-6">{detail(n, t)}</span>
                                                {n.action && n.message && <span className="truncate text-wb-12 text-wb-status-rejected-text">{n.message}</span>}
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end gap-1.5">
                                                <span className="text-wb-11 whitespace-nowrap text-wb-ntrl-6">{humanizeIso(n.at, t)}</span>
                                                {!n.read && <span className="size-2 rounded-full bg-brand" aria-hidden />}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {panel.status === "error" && panel.items.length > 0 && <p className="px-4 py-2 text-center text-wb-12 text-wb-status-rejected-text">{t("notif.load_failed")}</p>}
                </div>

                {panel.more && (
                    <div className="border-t border-wb-border-sidebar">
                        <button
                            type="button"
                            onClick={() => load(filter, panel.page + 1)}
                            disabled={panel.status === "loading"}
                            className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 text-wb-13 font-medium text-brand hover:bg-wb-bg-sidebar disabled:cursor-wait"
                        >
                            {panel.status === "loading" && <Loader2 className="size-4 animate-spin" />}
                            {t("notif.load_more")}
                        </button>
                    </div>
                )}
            </div>
        </Popover>
    );
}
