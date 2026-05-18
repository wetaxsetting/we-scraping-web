/**
 * Daily Cash report — dedicated Excel + Print builders.
 *
 * The Daily Cash workbook + print layout don't fit the generic
 * `lib/reportExcel.ts` / `lib/print.ts` helpers because:
 *
 *   - The Excel sheet is 10 columns wide with `B:C` (Account No.) and
 *     `I:J` (Balance) merged on every header / body / total row, plus
 *     a centred bold title, a per-currency `● Total <CCY> : …` block,
 *     and a `Current Accounts` / `Saving Accounts` mini-table embedded
 *     in the header band. The legacy file styles every cell (bold,
 *     centred, borders, `#,##0` number format), so we use
 *     {@link import("xlsx-js-style")} — a drop-in fork of `xlsx` that
 *     honours `.s` (style) on write. The free build of `xlsx` silently
 *     drops it, which is why the shared `lib/reportExcel.ts` writes
 *     unstyled workbooks.
 *   - The Print page mirrors the same multi-section layout with section
 *     totals at the bottom of each ledger.
 *
 * Both helpers are byte-equivalent to the legacy JEX `rept_0009_001`
 * `_excelDownload` and "Smart Print" outputs (see `temp/Daily Cash_…
 * .xlsx` and `temp/dailycash.pdf` for the reference shapes).
 */

import * as xlsx from "xlsx-js-style";

import { formatAmount } from "./currency";
import { escapeHtml } from "./print";

import type {
    DailyCashAccountRow,
    DailyCashSummaryRow,
} from "@/components/banking/reports/daily-cash/types";

/* ─── Shared helpers ─────────────────────────────────────────────────────── */

type Cell = string | number | null;
type Row = Cell[];

const COL_COUNT = 10;

function row10(...cells: Cell[]): Row {
    const out: Row = [...cells];
    while (out.length < COL_COUNT) out.push(null);
    return out;
}

function rowTotal(r: DailyCashSummaryRow): number {
    const n = (s: string) => Number.parseFloat(s || "0") || 0;
    return n(r.cash) + n(r.current) + n(r.savings) + n(r.timeDeposit);
}

/** Empty-data scaffolding — emit one block per canonical currency so
 *  the header band always shows `● Total VND : 0` and `● Total USD : 0.00`
 *  side-by-side rather than collapsing. Shared by the Excel and Print
 *  builders so both surfaces stay byte-identical when there's no data. */
const FALLBACK_SUMMARY_ROWS: ReadonlyArray<DailyCashSummaryRow> = [
    {
        currencyLabel: "VND",
        cash: "0", current: "0", savings: "0", timeDeposit: "0", available: "0",
    },
    {
        currencyLabel: "USD",
        cash: "0", current: "0", savings: "0", timeDeposit: "0", available: "0",
    },
];

/* ─── Style presets (xlsx-js-style `.s` shape) ───────────────────────────── */

/** Black 1px border on all four sides — used for every cell in the
 *  per-currency mini-table and the account ledger. */
const BORDER_ALL = {
    top: { style: "thin", color: { rgb: "000000" } },
    bottom: { style: "thin", color: { rgb: "000000" } },
    left: { style: "thin", color: { rgb: "000000" } },
    right: { style: "thin", color: { rgb: "000000" } },
} as const;

/** Bold centred title — large font. */
const STYLE_TITLE = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center", vertical: "center" },
};

/** Per-currency `● Total VND : …` line — bold. */
const STYLE_TOTAL_LINE = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "left", vertical: "center" },
};

/** Section heading `● Current Accounts` / `● Saving Accounts` — bold. */
const STYLE_SECTION_HEAD = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "left", vertical: "center" },
};

/** Mini-table header (Current Accounts / Saving Accounts) — light-grey
 *  fill + bold + centred + bordered (matches the legacy header band). */
const STYLE_MINI_HEADER = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER_ALL,
    fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } },
};

/** Mini-table value cell (right-aligned amount with borders). */
const STYLE_MINI_VALUE = {
    font: { sz: 11 },
    alignment: { horizontal: "right", vertical: "center" },
    border: BORDER_ALL,
};

/** Ledger header — bold, centred, bordered, light-grey fill. */
const STYLE_LEDGER_HEADER = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER_ALL,
    fill: { patternType: "solid", fgColor: { rgb: "F2F2F2" } },
};

/** Ledger body text cell (Bank / Account No. / Currency) — left-aligned. */
const STYLE_LEDGER_TEXT = {
    font: { sz: 11 },
    alignment: { horizontal: "left", vertical: "center" },
    border: BORDER_ALL,
};

/** Ledger body numeric cell — right-aligned with thousand-separator. */
const STYLE_LEDGER_NUM = {
    font: { sz: 11 },
    alignment: { horizontal: "right", vertical: "center" },
    border: BORDER_ALL,
    numFmt: "#,##0",
};

/** Ledger body decimal cell — right-aligned, two-decimal (for USD-style). */
const STYLE_LEDGER_DECIMAL = {
    font: { sz: 11 },
    alignment: { horizontal: "right", vertical: "center" },
    border: BORDER_ALL,
    numFmt: "#,##0.00",
};

/** Ledger "Total (<CCY>)" footer row — bold label, bold value, bordered. */
const STYLE_LEDGER_TOTAL_LABEL = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "left", vertical: "center" },
};

const STYLE_LEDGER_TOTAL_VAL_INT = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "right", vertical: "center" },
    numFmt: "#,##0",
};

const STYLE_LEDGER_TOTAL_VAL_DEC = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "right", vertical: "center" },
    numFmt: "#,##0.00",
};

/** Label cell (As of / Currency, plain). */
const STYLE_LABEL = {
    font: { sz: 11 },
    alignment: { horizontal: "left", vertical: "center" },
};

/** Whether a currency uses two decimals (USD, EUR) or zero (VND, KRW, JPY). */
function isDecimalCcy(ccy: string): boolean {
    const u = ccy.trim().toUpperCase();
    return u === "USD" || u === "EUR";
}

/* ─── Excel ──────────────────────────────────────────────────────────────── */

export type DailyCashExcelOptions = {
    asOfLabel: string;          // "As of : 18-05-2026"
    currencyLabel: string;      // "Currency : All"
    summaryRows: ReadonlyArray<DailyCashSummaryRow>;
    currentAccountRows: ReadonlyArray<DailyCashAccountRow>;
    savingsAccountRows: ReadonlyArray<DailyCashAccountRow>;
    labels: {
        currentAccounts: string;          // "Current Accounts"
        savingsAccounts: string;          // "Saving Accounts"
        sectionCurrentTitle: string;      // " ● Current Accounts"
        sectionSavingsTitle: string;      // " ● Saving Accounts"
        colBank: string;
        colAccountNo: string;
        colCurrency: string;
        colNumDebits: string;
        colNumCredits: string;
        colCredit: string;
        colBalance: string;
    };
    fileName: string;                     // without .xlsx
};

/**
 * Build the Daily Cash workbook and trigger the download. See top of file
 * for the row-by-row layout the legacy `rept_0009_001` `_excelDownload`
 * emits — every row index and merge below is anchored to that target.
 */
export function exportDailyCashExcel(opts: DailyCashExcelOptions): void {
    if (typeof window === "undefined") return;

    const aoa: Row[] = [];
    const merges: xlsx.Range[] = [];
    /** Style overrides — `{ "A1": styleObj }` map applied after
     *  {@link xlsx.utils.aoa_to_sheet}. */
    const styles: Record<string, object> = {};
    /** Row indices that need a taller height — applied to `ws["!rows"]`
     *  after the sheet is built. Header rows (mini-table + ledger) sit
     *  at ~22pt so the bold-on-grey band reads as a proper header band
     *  rather than collapsing to the default ~15pt body height. */
    const tallRowIdxs: number[] = [];

    /* Row 0 (Excel row 1) — Title centred across A:J. */
    aoa.push(row10("Daily Cash"));
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } });
    styles[xlsx.utils.encode_cell({ r: 0, c: 0 })] = STYLE_TITLE;

    // Rows 1, 2 — spacer (legacy layout: title block sits on rows 1–3).
    aoa.push(row10());
    aoa.push(row10());

    // Row 3 (Excel row 4) — As of (A), Currency (C).
    const metaRowIdx = aoa.length;
    aoa.push(row10(opts.asOfLabel, null, opts.currencyLabel));
    styles[xlsx.utils.encode_cell({ r: metaRowIdx, c: 0 })] = STYLE_LABEL;
    styles[xlsx.utils.encode_cell({ r: metaRowIdx, c: 2 })] = STYLE_LABEL;

    // Row 4 — spacer.
    aoa.push(row10());

    /* Per-currency summary band — bold "● Total <CCY> : …" + mini-table.
       If the backend ships no rows AND the client-side rollup also came
       back empty (no accounts at all), fall back to zeroed VND + USD
       blocks so the export always renders the legacy header band
       rather than collapsing to a bare title + section. The user
       expectation is "if not just show zero", covering both the local
       currency (VND) and the canonical FCY (USD). */
    const summaryRowsForExport = opts.summaryRows.length > 0
        ? opts.summaryRows
        : FALLBACK_SUMMARY_ROWS;
    for (const r of summaryRowsForExport) {
        const ccy = r.currencyLabel;
        const total = rowTotal(r);
        const totalDisplay = formatAmount(String(total), ccy, false);

        // "● Total <CCY> : <amount>"
        const totalRowIdx = aoa.length;
        aoa.push(row10(`● Total ${ccy} : ${totalDisplay}`));
        styles[xlsx.utils.encode_cell({ r: totalRowIdx, c: 0 })] = STYLE_TOTAL_LINE;

        // Mini-table header row: A:B = Current Accounts, C:D = Saving Accounts.
        // Legacy parity — header label is "Saving Accounts" (no `s`), not
        // "Savings Accounts" — see `temp/Daily Cash_…xlsx` row 8.
        const miniHeaderIdx = aoa.length;
        aoa.push(row10("Current Accounts", null, "Saving Accounts"));
        merges.push({ s: { r: miniHeaderIdx, c: 0 }, e: { r: miniHeaderIdx, c: 1 } });
        merges.push({ s: { r: miniHeaderIdx, c: 2 }, e: { r: miniHeaderIdx, c: 3 } });
        // Style EVERY cell in the merge range (anchor + tail) so Excel
        // renders the full border around the merged box, not just the
        // anchor's edge.
        for (const c of [0, 1, 2, 3]) {
            styles[xlsx.utils.encode_cell({ r: miniHeaderIdx, c })] = STYLE_MINI_HEADER;
        }
        tallRowIdxs.push(miniHeaderIdx);

        // Mini-table value row: A current total, C savings total (raw numbers).
        const miniValIdx = aoa.length;
        const currentNum = Number.parseFloat(r.current || "0") || 0;
        const savingsNum = Number.parseFloat(r.savings || "0") || 0;
        aoa.push(row10(currentNum, null, savingsNum));
        merges.push({ s: { r: miniValIdx, c: 0 }, e: { r: miniValIdx, c: 1 } });
        merges.push({ s: { r: miniValIdx, c: 2 }, e: { r: miniValIdx, c: 3 } });
        const valStyle = isDecimalCcy(ccy) ? STYLE_LEDGER_DECIMAL : STYLE_MINI_VALUE;
        // Same merge-fill rule — style every cell so borders render
        // all the way around the merged value box.
        for (const c of [0, 1, 2, 3]) {
            styles[xlsx.utils.encode_cell({ r: miniValIdx, c })] = valStyle;
        }

        // Spacer.
        aoa.push(row10());
    }

    /* ─── Section: Current Accounts ──────────────────────────────────── */
    pushSection({
        aoa,
        merges,
        styles,
        tallRowIdxs,
        title: opts.labels.sectionCurrentTitle,
        rows: opts.currentAccountRows,
        labels: opts.labels,
    });

    /* ─── Section: Saving Accounts (only if rows present) ───────────── */
    if (opts.savingsAccountRows.length > 0) {
        pushSection({
            aoa,
            merges,
            styles,
            tallRowIdxs,
            title: opts.labels.sectionSavingsTitle,
            rows: opts.savingsAccountRows,
            labels: opts.labels,
        });
    }

    const ws = xlsx.utils.aoa_to_sheet(aoa);
    ws["!merges"] = merges;

    // Per-row heights — header bands (mini-table + ledger) get ~22pt so
    // the bold-on-grey header reads with breathing room rather than
    // collapsing to the default ~15pt body height.
    const rowsHeights: { hpt: number }[] = [];
    for (const idx of tallRowIdxs) {
        while (rowsHeights.length <= idx) rowsHeights.push({ hpt: 15 });
        rowsHeights[idx] = { hpt: 22 };
    }
    if (rowsHeights.length > 0) ws["!rows"] = rowsHeights;

    // Column widths (mirrors the legacy file character widths).
    ws["!cols"] = [
        { wch: 14 }, // A — Bank / labels
        { wch: 12 }, // B — Account No. (start)
        { wch: 12 }, // C — Account No. (end, merged with B)
        { wch: 12 }, // D — Currency
        { wch: 16 }, // E — No. of Debits
        { wch: 20 }, // F — Withdrawal Amount
        { wch: 16 }, // G — No. of Credits
        { wch: 16 }, // H — Credit
        { wch: 16 }, // I — Balance (start)
        { wch: 4 },  // J — Balance (end, merged with I) — narrow spacer
    ];

    // Apply cell-level styles. `xlsx-js-style` honours `.s` on write.
    for (const [addr, style] of Object.entries(styles)) {
        const cell = ws[addr];
        if (cell) {
            cell.s = style;
        } else {
            // Cell may be null/blank (header for an empty merge); create
            // an empty cell with the style so the border still renders.
            ws[addr] = { t: "s", v: "", s: style } as unknown as xlsx.CellObject;
        }
    }

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Daily Cash");

    xlsx.writeFile(wb, `${opts.fileName}.xlsx`);
}

/* Section emitter shared by Current Accounts + Saving Accounts. */
function pushSection(args: {
    aoa: Row[];
    merges: xlsx.Range[];
    styles: Record<string, object>;
    tallRowIdxs: number[];
    title: string;
    rows: ReadonlyArray<DailyCashAccountRow>;
    labels: DailyCashExcelOptions["labels"];
}): void {
    const { aoa, merges, styles, tallRowIdxs, title, rows, labels } = args;

    // Section title row — bold, merged A:J.
    const sectionRowIdx = aoa.length;
    aoa.push(row10(title));
    merges.push({
        s: { r: sectionRowIdx, c: 0 },
        e: { r: sectionRowIdx, c: COL_COUNT - 1 },
    });
    styles[xlsx.utils.encode_cell({ r: sectionRowIdx, c: 0 })] = STYLE_SECTION_HEAD;

    // Spacer.
    aoa.push(row10());

    // Header row — 8 visible columns; B:C and I:J merged.
    const headerRowIdx = aoa.length;
    aoa.push(row10(
        labels.colBank,
        labels.colAccountNo, null,           // B:C
        labels.colCurrency,
        labels.colNumDebits,
        "Withdrawal Amount",                 // legacy label
        labels.colNumCredits,
        labels.colCredit,
        labels.colBalance, null,             // I:J
    ));
    merges.push({ s: { r: headerRowIdx, c: 1 }, e: { r: headerRowIdx, c: 2 } });
    merges.push({ s: { r: headerRowIdx, c: 8 }, e: { r: headerRowIdx, c: 9 } });
    // Style every header cell (including the merge tail cell C / J so
    // the bottom/right border lines up against the merged range edge).
    for (const c of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        styles[xlsx.utils.encode_cell({ r: headerRowIdx, c })] = STYLE_LEDGER_HEADER;
    }
    tallRowIdxs.push(headerRowIdx);

    // Body rows — merge B:C and I:J on each row.
    for (const r of rows) {
        const rIdx = aoa.length;
        const debitNum = Number.parseFloat(r.debit || "0") || 0;
        const creditNum = Number.parseFloat(r.credit || "0") || 0;
        const balanceNum = Number.parseFloat(r.balance || "0") || 0;
        const numDebits = Number(r.numDebits ?? 0);
        const numCredits = Number(r.numCredits ?? 0);
        const numStyle = isDecimalCcy(r.currency) ? STYLE_LEDGER_DECIMAL : STYLE_LEDGER_NUM;
        aoa.push(row10(
            r.bank,
            r.accountNo, null,           // B:C
            r.currency,
            numDebits,
            debitNum,
            numCredits,
            creditNum,
            balanceNum, null,            // I:J
        ));
        merges.push({ s: { r: rIdx, c: 1 }, e: { r: rIdx, c: 2 } });
        merges.push({ s: { r: rIdx, c: 8 }, e: { r: rIdx, c: 9 } });
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 0 })] = STYLE_LEDGER_TEXT;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 1 })] = STYLE_LEDGER_TEXT;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 2 })] = STYLE_LEDGER_TEXT;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 3 })] = STYLE_LEDGER_TEXT;
        // Integer count columns (E, G) always render with no decimals.
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 4 })] = STYLE_LEDGER_NUM;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 5 })] = numStyle;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 6 })] = STYLE_LEDGER_NUM;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 7 })] = numStyle;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 8 })] = numStyle;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 9 })] = numStyle;
    }

    // Per-currency total rows at the end of the section (no borders, bold).
    const totalsByCcy = new Map<string, number>();
    for (const r of rows) {
        const ccy = (r.currency || "VND").trim().toUpperCase();
        const bal = Number.parseFloat(r.balance || "0") || 0;
        totalsByCcy.set(ccy, (totalsByCcy.get(ccy) ?? 0) + bal);
    }
    for (const [ccy, total] of totalsByCcy.entries()) {
        const rIdx = aoa.length;
        aoa.push(row10(`Total (${ccy})`, null, null, null, null, null, null, null, total, null));
        merges.push({ s: { r: rIdx, c: 8 }, e: { r: rIdx, c: 9 } });
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 0 })] = STYLE_LEDGER_TOTAL_LABEL;
        const valStyle = isDecimalCcy(ccy)
            ? STYLE_LEDGER_TOTAL_VAL_DEC
            : STYLE_LEDGER_TOTAL_VAL_INT;
        styles[xlsx.utils.encode_cell({ r: rIdx, c: 8 })] = valStyle;
    }

    // Trailing spacer between sections.
    aoa.push(row10());
}

/** `YYYYMMDDhhmm` timestamp suffix — matches the legacy filename pattern
 *  `Daily Cash_202605181031.xlsx`. */
export function reportTimestampSuffix(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}${m}${day}${hh}${mm}`;
}

/* ─── Print ──────────────────────────────────────────────────────────────── */

export type DailyCashPrintOptions = {
    title: string;                  // "Daily Cash"
    asOfLabel: string;              // "As of : 18-05-2026"
    currencyLabel: string;          // "Currency : All"
    summaryRows: ReadonlyArray<DailyCashSummaryRow>;
    currentAccountRows: ReadonlyArray<DailyCashAccountRow>;
    savingsAccountRows: ReadonlyArray<DailyCashAccountRow>;
    labels: {
        currentAccounts: string;
        savingsAccounts: string;
        totalLabel: (ccy: string) => string;   // "Total (VND)"
        colBank: string;
        colAccountNo: string;
        colCurrency: string;
        colNumDebits: string;
        colDebit: string;
        colNumCredits: string;
        colCredit: string;
        colBalance: string;
    };
};

/** Open the print popup with the Daily Cash layout and trigger the browser
 *  print dialog. Mirrors the legacy "Smart Print" PDF (see
 *  `temp/dailycash.pdf`). Popup blocked → falls back to `window.print()`. */
export function printDailyCashReport(opts: DailyCashPrintOptions): void {
    if (typeof window === "undefined") return;
    const w = window.open("", "wecms_print_daily_cash", "width=1024,height=768");
    if (!w) {
        window.print();
        return;
    }
    const html = buildPrintHtml(opts);
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => {
        w.focus();
        w.print();
    };
}

function buildPrintHtml(opts: DailyCashPrintOptions): string {
    const title = escapeHtml(opts.title);
    /* Mirror the Excel fallback (see `exportDailyCashExcel`) — when the
       backend ships no summary rows, render zeroed VND + USD blocks so
       the print page always shows the legacy header band. */
    const summaryRowsForPrint = opts.summaryRows.length > 0
        ? opts.summaryRows
        : FALLBACK_SUMMARY_ROWS;
    const summaryBlocks = summaryRowsForPrint
        .map((r) => buildSummaryBlock(r, opts.labels))
        .join("");
    const currentSection = buildLedgerSection({
        rows: opts.currentAccountRows,
        labels: opts.labels,
    });
    const savingsSection = opts.savingsAccountRows.length > 0
        ? buildLedgerSection({
            rows: opts.savingsAccountRows,
            labels: opts.labels,
        })
        : "";

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body {
            font-family: Inter, "Noto Sans KR", "Malgun Gothic", sans-serif;
            color: #1b1b1b;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 12px;
        }
        h1 {
            text-align: center;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 16px;
        }
        .meta-row {
            display: flex;
            gap: 24px;
            margin: 0 0 16px;
            font-size: 12px;
        }
        .meta-row b { font-weight: 600; }
        .meta-row .label { color: #1b1b1b; }
        .summary-block { margin: 0 0 16px; }
        .summary-block .ccy-total {
            font-size: 12px;
            color: #494949;
            margin: 0 0 4px;
        }
        .summary-block .ccy-total .marker { color: #2b6cb0; margin-right: 4px; }
        .summary-block table {
            width: 100%;
            border-collapse: collapse;
        }
        .summary-block th,
        .summary-block td {
            border: 1px solid #cfcfcf;
            padding: 6px 8px;
            font-size: 12px;
            text-align: right;
        }
        .summary-block th {
            background: #f5f5f5;
            font-weight: 600;
            text-align: center;
        }
        .section-title {
            font-size: 13px;
            font-weight: 600;
            margin: 16px 0 6px;
        }
        table.ledger {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
        }
        table.ledger th,
        table.ledger td {
            border: 1px solid #cfcfcf;
            padding: 6px 8px;
            font-size: 12px;
            vertical-align: middle;
        }
        table.ledger thead th {
            background: #f5f5f5;
            font-weight: 600;
            text-align: left;
        }
        table.ledger thead th.right { text-align: right; }
        table.ledger tbody td.right { text-align: right; }
        table.ledger tfoot td {
            font-weight: 600;
            background: #fafafa;
        }
        table.ledger tfoot td.right { text-align: right; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="meta-row">
        <span class="label">${escapeHtml(opts.asOfLabel)}</span>
        <span class="label">${escapeHtml(opts.currencyLabel)}</span>
    </div>
    ${summaryBlocks}
    <div class="section-title">${escapeHtml(opts.labels.currentAccounts)}</div>
    ${currentSection}
    ${savingsSection
        ? `<div class="section-title">${escapeHtml(opts.labels.savingsAccounts)}</div>${savingsSection}`
        : ""}
</body>
</html>`;
}

function buildSummaryBlock(
    r: DailyCashSummaryRow,
    labels: DailyCashPrintOptions["labels"],
): string {
    const ccy = r.currencyLabel;
    const total = rowTotal(r);
    const totalDisplay = formatAmount(String(total), ccy, false);
    const currentDisplay = formatAmount(r.current, ccy, true);
    const savingsDisplay = formatAmount(r.savings, ccy, true);
    return `
        <div class="summary-block">
            <div class="ccy-total"><span class="marker">●</span>${escapeHtml(`Total ${ccy} : ${totalDisplay}`)}</div>
            <table>
                <thead>
                    <tr>
                        <th>${escapeHtml(labels.currentAccounts)}</th>
                        <th>${escapeHtml(labels.savingsAccounts)}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(currentDisplay)}</td>
                        <td>${escapeHtml(savingsDisplay)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function buildLedgerSection(args: {
    rows: ReadonlyArray<DailyCashAccountRow>;
    labels: DailyCashPrintOptions["labels"];
}): string {
    const { rows, labels } = args;
    const headerCells = [
        { label: labels.colBank, align: "left" as const },
        { label: labels.colAccountNo, align: "left" as const },
        { label: labels.colCurrency, align: "left" as const },
        { label: labels.colNumDebits, align: "right" as const },
        { label: labels.colDebit, align: "right" as const },
        { label: labels.colNumCredits, align: "right" as const },
        { label: labels.colCredit, align: "right" as const },
        { label: labels.colBalance, align: "right" as const },
    ];

    const thead = headerCells
        .map(
            (c) =>
                `<th${c.align === "right" ? ' class="right"' : ""}>${escapeHtml(c.label)}</th>`,
        )
        .join("");

    const tbody = rows
        .map(
            (r) => `<tr>
                <td>${escapeHtml(r.bank)}</td>
                <td>${escapeHtml(r.accountNo)}</td>
                <td>${escapeHtml(r.currency)}</td>
                <td class="right">${escapeHtml(String(r.numDebits ?? 0))}</td>
                <td class="right">${escapeHtml(formatAmount(r.debit, r.currency, true))}</td>
                <td class="right">${escapeHtml(String(r.numCredits ?? 0))}</td>
                <td class="right">${escapeHtml(formatAmount(r.credit, r.currency, true))}</td>
                <td class="right">${escapeHtml(formatAmount(r.balance, r.currency, true))}</td>
            </tr>`,
        )
        .join("");

    const totalsByCcy = new Map<string, number>();
    for (const r of rows) {
        const ccy = (r.currency || "VND").trim().toUpperCase();
        const bal = Number.parseFloat(r.balance || "0") || 0;
        totalsByCcy.set(ccy, (totalsByCcy.get(ccy) ?? 0) + bal);
    }
    const tfoot = Array.from(totalsByCcy.entries())
        .map(
            ([ccy, total]) => `<tr>
                <td colspan="7">${escapeHtml(labels.totalLabel(ccy))}</td>
                <td class="right">${escapeHtml(formatAmount(String(total), ccy, true))}</td>
            </tr>`,
        )
        .join("");

    return `<table class="ledger">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
        ${tfoot ? `<tfoot>${tfoot}</tfoot>` : ""}
    </table>`;
}
