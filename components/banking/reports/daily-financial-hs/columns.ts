import type { ViewSettingItem } from "@/components/shared/view-setting";

import type { LedgerEntry, LedgerTotals } from "./types";

/**
 * Column registry for the Daily Financial (HS) ledger — the single source of
 * truth the table iterates and the View Setting popover toggles.
 *
 * FIELD_IDs are uppercase stable identifiers (View Setting convention). NOTE:
 * the Memo column uses `MEMO_NOTE`, NOT `MEMO` — `MEMO` is a reserved special
 * FIELD_ID (`VIEW_SETTING_SPECIAL_FIELD_IDS`) that the shared popover hides,
 * and the requirement is that Memo stays user-controllable.
 *
 * Static UI: `entry`/`subtotal`/`total` return pre-formatted display strings
 * straight off the mock — no formatting or arithmetic at render time.
 */

export type ColumnKind = "bank" | "currency" | "input" | "text" | "number";

export type ColumnDescriptor = {
    /** Stable View Setting identifier. */
    fieldId: string;
    /** Korean header line (constant bilingual label). */
    koKey: string;
    /** English header line (also the input placeholder for `input` columns). */
    enKey: string;
    align: "left" | "right";
    kind: ColumnKind;
    /** Literal Tailwind width class (kept literal so JIT picks it up). */
    widthClass: string;
    /** Pixel width — summed for the table's runtime min-width (§7d). */
    widthPx: number;
    /** Body-cell value accessor (input / text / number columns). */
    entry?: (e: LedgerEntry) => string;
    /** SUB TOTAL cell value accessor (numeric columns). */
    subtotal?: (s: LedgerTotals) => string;
    /** TOTAL cell value accessor (numeric columns + the memo figure). */
    total?: (t: LedgerTotals & { memo?: string }) => string;
};

/** FIELD_IDs that participate in the numeric summary group (right of the
 *  SUB TOTAL / TOTAL label). */
export const NUMERIC_FIELD_IDS: ReadonlySet<string> = new Set([
    "BEFORE_BALANCE",
    "RECEIPT",
    "PAYMENT",
    "BALANCE",
]);

const K = "report.daily_financial_hs.col";
const K_KO = "report.daily_financial_hs.col_ko";

// Column widths mirror the legacy sys_scr_option_wecms `size` values for
// rept_0017_001 / table1 (the View Setting DB seed, screenId
// `banking-reports-daily-financial-hs` / `default`, V249): 125 / 78 / 170 /
// 170 / 200 / 200 / 200 / 135 / 135 / 135 / 135 / 285.
export const COLUMN_REGISTRY: readonly ColumnDescriptor[] = [
    {
        fieldId: "BANK",
        koKey: `${K_KO}.bank`,
        enKey: `${K}.bank`,
        align: "left",
        kind: "bank",
        widthClass: "w-[125px]",
        widthPx: 125,
    },
    {
        fieldId: "CURRENCY",
        koKey: `${K_KO}.currency`,
        enKey: `${K}.currency`,
        align: "left",
        kind: "currency",
        widthClass: "w-[78px]",
        widthPx: 78,
    },
    {
        fieldId: "RECEIPT_CODE",
        koKey: `${K_KO}.receipt_code`,
        enKey: `${K}.receipt_code`,
        align: "left",
        kind: "input",
        widthClass: "w-[170px]",
        widthPx: 170,
        entry: (e) => e.receiptCode,
    },
    {
        fieldId: "PAYMENT_CODE",
        koKey: `${K_KO}.payment_code`,
        enKey: `${K}.payment_code`,
        align: "left",
        kind: "input",
        widthClass: "w-[170px]",
        widthPx: 170,
        entry: (e) => e.paymentCode,
    },
    {
        fieldId: "DESCRIPTION_EN",
        koKey: `${K_KO}.description_en`,
        enKey: `${K}.description_en`,
        align: "left",
        kind: "input",
        widthClass: "w-[200px]",
        widthPx: 200,
        entry: (e) => e.descriptionEn,
    },
    {
        fieldId: "DESCRIPTION_KO",
        koKey: `${K_KO}.description_ko`,
        enKey: `${K}.description_ko`,
        align: "left",
        kind: "input",
        widthClass: "w-[200px]",
        widthPx: 200,
        entry: (e) => e.descriptionKo,
    },
    {
        fieldId: "COUNTERPARTY",
        koKey: `${K_KO}.counterparty`,
        enKey: `${K}.counterparty`,
        align: "left",
        kind: "text",
        widthClass: "w-[200px]",
        widthPx: 200,
        entry: (e) => e.counterparty,
    },
    {
        fieldId: "BEFORE_BALANCE",
        koKey: `${K_KO}.before_balance`,
        enKey: `${K}.before_balance`,
        align: "right",
        kind: "number",
        widthClass: "w-[135px]",
        widthPx: 135,
        entry: (e) => e.beforeBalance,
        subtotal: (s) => s.beforeBalance,
        total: (t) => t.beforeBalance,
    },
    {
        fieldId: "RECEIPT",
        koKey: `${K_KO}.receipt`,
        enKey: `${K}.receipt`,
        align: "right",
        kind: "number",
        widthClass: "w-[135px]",
        widthPx: 135,
        entry: (e) => e.receipt,
        subtotal: (s) => s.receipt,
        total: (t) => t.receipt,
    },
    {
        fieldId: "PAYMENT",
        koKey: `${K_KO}.payment`,
        enKey: `${K}.payment`,
        align: "right",
        kind: "number",
        widthClass: "w-[135px]",
        widthPx: 135,
        entry: (e) => e.payment,
        subtotal: (s) => s.payment,
        total: (t) => t.payment,
    },
    {
        fieldId: "BALANCE",
        koKey: `${K_KO}.balance`,
        enKey: `${K}.balance`,
        align: "right",
        kind: "number",
        widthClass: "w-[135px]",
        widthPx: 135,
        entry: (e) => e.balance,
        subtotal: (s) => s.balance,
        total: (t) => t.balance,
    },
    {
        fieldId: "MEMO_NOTE",
        koKey: `${K_KO}.memo`,
        enKey: `${K}.memo`,
        align: "left",
        kind: "input",
        widthClass: "w-[285px]",
        widthPx: 285,
        entry: (e) => e.memo,
        // Only the TOTAL row carries the right-edge memo figure (Figma).
        total: (t) => t.memo ?? "",
    },
];

/** FIELD_ID → English header i18n key, for the popover's row labels. */
export const FIELD_LABEL_KEY: Readonly<Record<string, string>> = Object.fromEntries(
    COLUMN_REGISTRY.map((c) => [c.fieldId, c.enKey]),
);

/**
 * Default View Setting items — all 12 columns visible, in registry order.
 * Client-side default (no backend seed); this is what Reset restores to.
 */
export const DEFAULT_VIEW_SETTING_ITEMS: readonly ViewSettingItem[] =
    COLUMN_REGISTRY.map((c, i): ViewSettingItem => ({
        field_id: c.fieldId,
        // Fallback label only — the popover resolves the real label via getLabel.
        field_nm: c.fieldId,
        disp_ord: i + 1,
        disp_yn: "Y",
        use_yn: "Y",
        size: `${c.widthPx}px`,
        sort_yn: "N",
    }));
