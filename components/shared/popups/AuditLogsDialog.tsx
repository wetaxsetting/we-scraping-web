"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";

/**
 * Generic Audit Logs row.
 *
 * Hosts pre-translate the `activity` string before passing rows in —
 * the shared dialog renders it as plain text. Date/time stays split
 * into two strings (date + time) so the Figma's two-line stack reads
 * the same regardless of the source data's locale formatting.
 */
export type AuditLogRow = {
    id: string;
    /**
     * Raw `reg_dtm` wire timestamp (`yyyyMMddHHmmss`). The audit tables
     * (`AUDIT_LOGS_INFM.REG_DTM`) are written as **UTC instants** by
     * `AuditLogService` (`OffsetDateTime.now(UTC)`), so when present the
     * dialog shifts this to the display zone (Asia/Ho_Chi_Minh) and
     * renders it per the active language. Preferred over the pre-split
     * `date`/`time` below — those stay as a fallback for any caller that
     * hasn't been migrated to the raw value.
     */
    dtm?: string;
    /** Date label rendered on line 1 of the Date/Time cell — already
     *  formatted (e.g. "09-12-2024"). Fallback when `dtm` is absent. */
    date: string;
    /** Time label rendered on line 2 of the Date/Time cell — already
     *  formatted (e.g. "15:13:24"). Fallback when `dtm` is absent. */
    time: string;
    /** Display name of the actor. */
    user: string;
    /** Activity label — already translated by the host. */
    activity: string;
    /** Activity-details label — already translated by the host. */
    details: string;
};

export type AuditLogsDialogProps = {
    /** Dialog title — already translated. */
    title: string;
    /** Optional subtitle below the title — already translated. Hidden when omitted. */
    description?: string;
    rows: AuditLogRow[];
    onClose: () => void;
    /** Column header overrides — defaults match the WeCMS audit-logs vocabulary
     *  (Date/Time · User · Activity · Activity Details). Rare callers can swap
     *  individual labels without re-implementing the dialog. */
    columnLabels?: Partial<{
        datetime: string;
        user: string;
        activity: string;
        details: string;
    }>;
};

const DEFAULT_COL_KEYS = {
    datetime: "settings.bank_account.audit_logs.col.datetime",
    user: "settings.bank_account.audit_logs.col.user",
    activity: "settings.bank_account.audit_logs.col.activity",
    details: "settings.bank_account.audit_logs.col.details",
} as const;

/**
 * Audit Logs feature dialog — Figma 166:25291 (Bank Account) /
 * 3435:22565 (Login Credentials).
 *
 * Shared by every Settings popup that exposes a per-row audit history
 * (Bank Account, Login Credentials, future User / Permission flows).
 * The two original panel-local copies — `bank-account/AuditLogsDialog`
 * and `login-credentials/AuditLogsDialog` — were byte-identical except
 * for the page-specific title / description / activity vocabulary;
 * this component owns the chrome, hosts pass title / description /
 * pre-translated rows.
 *
 * Modal frame: `max-w-[860px]`, definite `h-[70vh]` (bounded by
 * `max-h-[calc(100vh-80px)]` / `min-h-[360px]` for responsiveness),
 * `rounded-[16px]`, `stackLevel={2}` (sits above the L1 Settings shell
 * with the lighter overlay dim). The standard top-right X close icon
 * is provided by the shared <DialogContent> primitive — closing it
 * dismisses only this dialog. Inner flex-column stack: header
 * (`shrink-0`, `px-6 pt-6 pb-4`, gap-1.5), a table area (`flex-1
 * min-h-0`, `px-6`) whose scroll container carries NO horizontal
 * padding — so the vertical scrollbar sits flush on the table's right
 * edge (no gap, matching the normal page `DataTableShell`) — with a
 * sticky `<thead>` that stays visible while only the rows scroll, and a
 * footer (`shrink-0`, `px-6 py-4` right-aligned single outlined Close
 * button). The modal body is `overflow-hidden`; the table scroll box is
 * the ONLY `overflow-y-auto` element. The definite modal height is what
 * lets the inner scroll resolve so the title/subtitle and footer stay
 * fixed. Static UI: Close / X / ESC dismiss.
 */
export default function AuditLogsDialog({
    title,
    description,
    rows,
    onClose,
    columnLabels,
}: AuditLogsDialogProps) {
    const { t, locale } = useTranslation();
    const cols = {
        datetime: columnLabels?.datetime ?? t(DEFAULT_COL_KEYS.datetime),
        user: columnLabels?.user ?? t(DEFAULT_COL_KEYS.user),
        activity: columnLabels?.activity ?? t(DEFAULT_COL_KEYS.activity),
        details: columnLabels?.details ?? t(DEFAULT_COL_KEYS.details),
    };

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                // Definite (fixed) bounded height — NOT max-height alone.
                // The inner table region is `flex-1 min-h-0 overflow-y-auto`;
                // for that scroll region to resolve, the flex-column modal
                // needs a determinate height. With `max-h` only, the
                // `fixed` + `-translate-y-1/2` DialogContent lets the table's
                // natural height push the whole panel taller (Chromium flex
                // gotcha), so the sticky header + footer scroll with the body.
                // `h-[70vh]` fixes the height so only the rows scroll; the
                // `max-h`/`min-h` bounds keep it responsive on short/tall
                // viewports (375 → 1440).
                className="flex h-[70vh] max-h-[calc(100vh-80px)] min-h-[360px] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl"
            >
                {/* Header — title + optional subtitle stacked with 6 px gap. */}
                <div className="flex shrink-0 flex-col items-start justify-center gap-1.5 px-6 pb-4 pt-6">
                    <DialogTitle asChild>
                        <h2 className="whitespace-nowrap text-wb-16 font-semibold text-wb-dark">
                            {title}
                        </h2>
                    </DialogTitle>
                    {description && (
                        <DialogDescription asChild>
                            <p className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                                {description}
                            </p>
                        </DialogDescription>
                    )}
                </div>

                {/* Table area — mirrors the normal page table
                   (`DataTableShell`, CLAUDE.md §7a). The horizontal inset
                   (`px-6`) lives on THIS wrapper; the scroll container
                   itself carries NO horizontal padding, so the vertical
                   scrollbar sits flush on the table's right edge — no gap
                   between the last column and the scrollbar, and no extra
                   padding wedged between them. The scroll box holds the
                   whole table (so its width includes the scrollbar) and
                   is the ONLY `overflow-y-auto` element — the modal body
                   itself is `overflow-hidden`. The sticky `<thead>` keeps
                   the column labels visible while only the rows move. */}
                <div className="flex min-h-0 flex-1 flex-col px-6">
                    <div className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto">
                        <table className="w-full table-fixed border-collapse">
                            <AuditColgroup />
                            <thead>
                                <tr className="h-[var(--h-wb-table-head)]">
                                    <HeaderCell>{cols.datetime}</HeaderCell>
                                    <HeaderCell>{cols.user}</HeaderCell>
                                    <HeaderCell>{cols.activity}</HeaderCell>
                                    <HeaderCell>{cols.details}</HeaderCell>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <AuditLogTableRow key={row.id} row={row} locale={locale} />
                                ))}
                            </tbody>
                        </table>
                        {rows.length === 0 && (
                            <div className="flex items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
                                {t("common.no_data")}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer — px-6 py-4, right-aligned single Close button. */}
                <div className="flex shrink-0 items-center justify-end px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {t("common.close")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Shared column template — rendered in both the fixed header table and
 *  the scrollable body table so their columns stay aligned across the
 *  header/body split. */
function AuditColgroup() {
    return (
        <colgroup>
            <col className="w-[121px]" />
            <col className="w-[105px]" />
            <col className="w-[214px]" />
            <col />
        </colgroup>
    );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
    // Sticky column header — pinned to the top of the scroll container
    // (the `<thead>` scrolls with the single table, `sticky top-0` keeps
    // it visible). Each `<th>` carries its own opaque bg + bottom border
    // so it occludes rows passing underneath; with `border-collapse` a
    // border on the parent `<tr>` would be dropped during scroll.
    return (
        <th className="sticky top-0 z-10 whitespace-nowrap border-b border-wb-table-border bg-wb-bg-sidebar px-3 py-3 text-left align-middle text-wb-13 font-semibold tracking-wb-tight text-wb-dark">
            {children}
        </th>
    );
}

function AuditLogTableRow({ row, locale }: { row: AuditLogRow; locale: Locale }) {
    // Prefer the raw UTC `dtm` (shift to VN + locale-aware) when the host
    // supplies it; fall back to the host's pre-split date/time strings.
    const { date, time } = row.dtm
        ? formatUtcDtmByLanguage(row.dtm, locale)
        : { date: row.date, time: row.time };
    return (
        <tr className="h-16 border-b border-wb-table-border">
            {/* Date/Time — two-line stack: date in ink, time in muted
               ntrl-6 (#737373). */}
            <td className="px-3 py-3 align-middle">
                <div className="flex flex-col gap-1">
                    <span className="block text-wb-13 font-medium text-wb-ink">
                        {date}
                    </span>
                    <span className="block text-wb-13 font-medium text-wb-ntrl-6">
                        {time}
                    </span>
                </div>
            </td>
            <td className="px-3 py-3 align-middle">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.user}
                </span>
            </td>
            <td className="px-3 py-3 align-middle">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.activity}
                </span>
            </td>
            <td className="px-3 py-3 align-middle">
                <span className="block truncate text-wb-13 font-medium text-wb-ink">
                    {row.details}
                </span>
            </td>
        </tr>
    );
}
