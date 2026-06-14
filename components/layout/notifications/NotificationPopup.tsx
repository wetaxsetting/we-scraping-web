"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

import { ApiCallError } from "@/lib/api/banking";
import { mapNotificationRow } from "@/lib/api/mappers";
import {
    fetchNotifications,
    fetchUnreadCount,
    markAllNotificationsRead,
    markNotificationRead,
} from "@/lib/api/notification";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { useDialog } from "@/components/shared/dialog";
import CommonApprovalDetailsDialog from "@/components/payment/shared/CommonApprovalDetailsDialog";

import NotificationItem from "./NotificationItem";
import NotificationSearch from "./NotificationSearch";
import NotificationTabs from "./NotificationTabs";
import type { NotificationRow, NotificationTab } from "./types";

/*
 * Parse the opaque NOTI_JSON navigation payload safely. The backend stores a
 * JSON object string (e.g. {"POST_SEQ_NO":7,"APPR_DV":"Internal Transfer",
 * "APPR_SEQ_NO":"...","BLTB_CD":"..."}); a malformed / null value degrades to
 * {} so a click never throws.
 */
function parseNotiJson(raw: string | null): Record<string, unknown> {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** Stringify a NOTI_JSON scalar (string or number) → trimmed string, or null. */
function jsonStr(raw: unknown): string | null {
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number") return String(raw);
    return null;
}

/**
 * Identity the common Approval Details popup opens with, extracted from a
 * notification's NOTI_JSON. Legacy `fn_readOneCommNoti` opens
 * `comm_0195_001.act` by **POST_SEQ_NO** (+ BLTB_CD), which both request- and
 * action-path notifications always carry — so POST_SEQ_NO is the robust key.
 * APPR_SEQ_NO is forwarded too when present (request path) so the backend can
 * skip the POST→APPR lookup. Returns null only when NEITHER key is present —
 * the caller then shows a safe message instead of opening (never redirects).
 */
function resolveDetailKey(
    n: NotificationRow,
): { postSeqNo: string | null; bltbCd: string | null; apprSeqNo: string | null } | null {
    const json = parseNotiJson(n.notiJson);
    const postSeqNo = jsonStr(json.POST_SEQ_NO);
    const apprSeqNo = jsonStr(json.APPR_SEQ_NO);
    if (!postSeqNo && !apprSeqNo) return null;
    return {
        postSeqNo,
        bltbCd: jsonStr(json.BLTB_CD) ?? n.bltbCd ?? null,
        apprSeqNo,
    };
}

type DetailKey = NonNullable<ReturnType<typeof resolveDetailKey>>;

/*
 * Notification dropdown — Figma node 12346:43819. Header chrome that owns its
 * own bell trigger + right-docked slide-over panel.
 *
 * Phase 2: fully API-backed (no mock data). The bell badge reads
 * GET /unread-count; the list reads GET /notifications (read_type per tab);
 * a row click marks that notification read then navigates to its link target;
 * "Read All" calls PUT /read-all. Every mutation bumps `refreshKey`, which
 * re-fires BOTH the count and list loaders so the badge and rows stay in sync.
 * Search filters the loaded rows client-side (the Phase-1 list API has no
 * search param); infinite scroll / polling are deliberately out of scope.
 */
export default function NotificationPopup() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<NotificationTab>("unread");
    const [query, setQuery] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [busy, setBusy] = useState(false);
    // Identity (POST_SEQ_NO + BLTB_CD + optional APPR_SEQ_NO) of the
    // notification whose Approval Details popup is open (null = closed). The
    // popup overlays the current page — no navigation.
    const [detailKey, setDetailKey] = useState<DetailKey | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Outside-click + ESC close — identical handling to ProfileMenu so both
    // header dropdowns dismiss the same way.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e: PointerEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Badge — runs on mount (panel closed) and after every mutation so the
    // count is live even before the user opens the panel. Errors degrade to 0
    // (no badge) rather than surfacing a dialog for a background poll.
    const countState = useApiData(() => fetchUnreadCount(), [refreshKey]);
    const unreadCount = countState.data?.total_count ?? 0;

    // List — only fetched while the panel is open; re-fires on tab switch and
    // after a mutation. Stale-while-revalidate (useApiData) keeps the prior
    // rows visible during a refetch so the list never flashes empty.
    const listState = useApiData(
        () =>
            open
                ? fetchNotifications({ readType: tab === "unread" ? "U" : "A" })
                : Promise.resolve(null),
        [open, tab, refreshKey],
    );

    const rows = useMemo<NotificationRow[]>(() => {
        const mapped = (listState.data?.list ?? []).map(mapNotificationRow);
        const q = query.trim().toLowerCase();
        if (!q) return mapped;
        return mapped.filter(
            (n) =>
                n.senderName.toLowerCase().includes(q) ||
                n.title.toLowerCase().includes(q) ||
                n.content.toLowerCase().includes(q),
        );
    }, [listState.data, query]);

    const refresh = () => setRefreshKey((k) => k + 1);

    const showError = (err: unknown) =>
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: err instanceof Error ? err.message : String(err),
            errorCode: err instanceof ApiCallError ? err.code : undefined,
        });

    async function handleRowClick(n: NotificationRow) {
        if (busy) return;
        try {
            setBusy(true);
            // Mark read first (legacy fn_readOneCommNoti calls u001 before the
            // DEL_YN branch), then refresh so the badge + tint update.
            // Already-read rows skip the API call but still open the popup.
            if (!n.read) await markNotificationRead(n.notificationId);
            refresh();

            // Deleted notification — legacy showed WBI1098 then reloaded the
            // list. Show the deleted message and do NOT open Approval Details.
            if (n.deleted) {
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: t("notification.deleted_message"),
                });
                return;
            }

            // Open the Approval Details popup ON THE CURRENT PAGE (legacy
            // fn_readOneCommNoti opens comm_0195_001.act as a layer popup).
            // No router.push — the active top menu (e.g. Banking) is preserved.
            // Re-clicking an already-read row re-opens the same popup because
            // this runs regardless of the prior read state.
            const key = resolveDetailKey(n);
            if (key) {
                setOpen(false); // close the bell panel; the dialog overlays the page
                setDetailKey(key);
            } else {
                // No business key to open details with — safe message, no redirect.
                dialog.open({
                    type: "warning",
                    title: t("dialog.warning"),
                    description: t("notification.no_detail"),
                });
            }
        } catch (err) {
            showError(err);
        } finally {
            setBusy(false);
        }
    }

    async function handleReadAll() {
        if (busy || unreadCount === 0) return;
        try {
            setBusy(true);
            await markAllNotificationsRead();
            refresh();
        } catch (err) {
            showError(err);
        } finally {
            setBusy(false);
        }
    }

    const listLoading = listState.loading && !listState.data;

    return (
        <div ref={wrapperRef} className="relative">
            {/* Bell trigger — opens the panel + carries the live unread badge. */}
            <button
                type="button"
                aria-label={t("nav.notifications")}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="relative flex cursor-pointer items-center justify-center rounded-full p-1 transition-opacity hover:bg-white/10 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/header/ico-bell.svg" alt="" aria-hidden className="size-6" />
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-wb-red-07 px-1 text-wb-10 font-bold leading-none text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label={t("notification.title")}
                    /*
                     * Right-docked panel: `fixed` flush to the viewport right
                     * edge, opening directly below the 48px header and running
                     * to the bottom of the viewport. The list scrolls
                     * internally; outside-click still works because the panel
                     * stays a DOM child of the wrapper.
                     */
                    className="fixed right-0 top-[var(--h-wb-header)] bottom-0 z-50 flex w-[405px] max-w-[calc(100vw-16px)] flex-col overflow-hidden border-l border-wb-border-sidebar bg-white shadow-[0_4px_5px_0_rgba(0,0,0,0.1)] duration-150 animate-in fade-in-0 slide-in-from-top-1"
                >
                    {/* Title + close */}
                    <div className="flex shrink-0 items-center justify-between px-5 py-3">
                        <h2 className="text-wb-18 font-bold leading-normal text-wb-ink">
                            {t("notification.title")}
                        </h2>
                        <button
                            type="button"
                            aria-label={t("notification.close")}
                            onClick={() => setOpen(false)}
                            className="flex cursor-pointer items-center justify-center rounded-md p-1 text-wb-ink transition-colors hover:bg-black/5"
                        >
                            <X className="size-5" strokeWidth={2} />
                        </button>
                    </div>

                    {/* Tabs + Read All */}
                    <div className="flex shrink-0 items-center justify-between border-b border-wb-border-sidebar px-5 py-2.5">
                        <NotificationTabs value={tab} onChange={setTab} />
                        <button
                            type="button"
                            onClick={handleReadAll}
                            disabled={busy || unreadCount === 0}
                            className="flex cursor-pointer items-center rounded-md bg-brand px-2 py-2 text-wb-14 font-medium leading-4 tracking-wb-tight text-white shadow-wb-brand-btn transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {t("notification.read_all")}
                        </button>
                    </div>

                    {/* Search */}
                    <div className="shrink-0 px-5 pb-[13px] pt-[13px]">
                        <NotificationSearch value={query} onChange={setQuery} />
                    </div>

                    {/* List — the only scroll area */}
                    <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
                        {listLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="size-5 animate-spin text-wb-muted" aria-hidden />
                            </div>
                        ) : listState.error ? (
                            <p className="px-5 py-10 text-center text-wb-13 font-medium text-wb-muted">
                                {t("notification.load_error")}
                            </p>
                        ) : rows.length === 0 ? (
                            <p className="px-5 py-10 text-center text-wb-13 font-medium text-wb-muted">
                                {t("notification.empty")}
                            </p>
                        ) : (
                            rows.map((n) => (
                                <NotificationItem key={n.id} notification={n} onClick={handleRowClick} />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Approval Details popup — opens over the current page when an
             *  approval notification is clicked (legacy comm_0195_001 layer).
             *  Portal-rendered, so it sits above whatever page is active; no
             *  navigation occurs. Closing refreshes the badge/list so the
             *  just-read row reflects its new state. */}
            {detailKey && (
                <CommonApprovalDetailsDialog
                    postSeqNo={detailKey.postSeqNo}
                    bltbCd={detailKey.bltbCd}
                    apprSeqNo={detailKey.apprSeqNo}
                    onClose={() => {
                        setDetailKey(null);
                        refresh();
                    }}
                />
            )}
        </div>
    );
}
