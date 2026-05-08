/**
 * Shared print utility — opens a clean popup window with just title +
 * optional summary line + table, calls `window.print()` on it, and
 * leaves the popup open so the user closes it on their own (some
 * browsers abort the print job if the window is closed too eagerly).
 *
 * The legacy JEX system uses `_v2common.app.setUpPrintTable(...)` for
 * the same purpose — Account Inquiry's `fnsh_0001_001.printAllTable`
 * is the canonical caller. Calling `window.print()` directly on the
 * live DOM is forbidden because it would include the sidebar, top
 * nav, page header buttons, filter row, checkbox column, and
 * pagination in the print output (CLAUDE.md §6c "Print").
 *
 * Usage from a page:
 *
 *     import { printReport, escapeHtml } from "@/lib/print";
 *
 *     const onPrint = () => printReport({
 *         title: t("page.title"),
 *         summary: `${count} rows / Total ${formatAmount(...)}`,
 *         columns: [
 *             { header: t("col.name"), render: (r) => escapeHtml(r.name) },
 *             { header: t("col.amount"), align: "right",
 *               render: (r) => escapeHtml(formatAmount(r.amount, "VND", false)) },
 *         ],
 *         rows: filtered,
 *     });
 *
 * Caller is responsible for escaping any untrusted strings inside
 * their `render` function via the exported {@link escapeHtml} helper.
 * Cells render as raw HTML so multi-line layouts (e.g. bank name +
 * account-number sub-line) and inline tags (e.g. error / muted
 * spans) are supported via the small set of utility classes baked
 * into the print stylesheet — see `BUILTIN_PRINT_CLASSES` below.
 */

/** A single column in a print report. */
export type PrintColumn<T> = {
    /** Column header text (escaped automatically). */
    header: string;
    /** Optional alignment. Defaults to `"left"`. Numeric / amount columns
     *  should use `"right"` to mirror the on-screen table. */
    align?: "left" | "right";
    /**
     * Returns the cell HTML. Plain-text payload should be wrapped in
     * {@link escapeHtml}; the helper does NOT auto-escape so multi-line
     * layouts (e.g. `<strong>name</strong><br><small>account#</small>`)
     * and the built-in `.muted` / `.small` / `.err` utility classes
     * are usable.
     */
    render: (row: T) => string;
};

export type PrintReportOptions<T> = {
    /** Centred page title, e.g. "Account Inquiry (VND)". Auto-escaped. */
    title: string;
    /**
     * Optional one-line summary (count + totals). Auto-escaped — pass a
     * pre-formatted string without HTML. For multi-line summary, supply
     * literal `\n` and the helper preserves them via `white-space: pre-line`.
     */
    summary?: string;
    /** Column definitions; rendered in order. */
    columns: ReadonlyArray<PrintColumn<T>>;
    /** Print source — the caller's filtered/sorted in-memory dataset. */
    rows: ReadonlyArray<T>;
    /** Defaults to `"wecms_print"`. Same name reuses the popup window. */
    windowName?: string;
    /**
     * Page orientation. Defaults to `"landscape"` because every WeCMS
     * report has 5+ columns and prints poorly in portrait.
     */
    orientation?: "landscape" | "portrait";
};

/**
 * Escape an untrusted string for use inside the print HTML. Mirrors the
 * usual `& < > " '` substitution; do not pre-escape — the helper is the
 * single point of escaping in the print pipeline.
 */
export function escapeHtml(raw: string): string {
    return raw.replace(/[&<>"']/g, (c) => {
        switch (c) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            case "'": return "&#39;";
            default: return c;
        }
    });
}

/**
 * Open a clean popup window with the given report content and trigger
 * the browser's print dialog on it. Does nothing on the server (Next.js
 * `typeof window === "undefined"` guard). If the popup is blocked, falls
 * back to `window.print()` on the live page so the user still gets
 * output.
 */
export function printReport<T>(options: PrintReportOptions<T>): void {
    if (typeof window === "undefined") return;
    const w = window.open(
        "",
        options.windowName ?? "wecms_print",
        "width=1024,height=768",
    );
    if (!w) {
        // Popup blocked — fall back to live-page print so the user still
        // gets *some* output. Calls upstream that need a guaranteed
        // clean print should ask the user to allow popups instead.
        window.print();
        return;
    }
    const html = buildPrintHtml(options);
    w.document.open();
    w.document.write(html);
    w.document.close();
    // Trigger print after layout. Don't auto-close: Firefox aborts the
    // print job if the window is closed too eagerly; let the user close
    // it manually after the dialog dismisses.
    w.onload = () => {
        w.focus();
        w.print();
    };
}

const BUILTIN_PRINT_CLASSES = `
    .muted { color: #737373; font-weight: 400; }
    .small { font-size: 12px; }
    .err   { color: #c0392b; font-weight: 500; margin-right: 6px; }
`;

function buildPrintHtml<T>(opts: PrintReportOptions<T>): string {
    const orientation = opts.orientation ?? "landscape";
    const title = escapeHtml(opts.title);
    const summary = opts.summary
        ? `<div class="summary">${escapeHtml(opts.summary)}</div>`
        : "";

    const headerCells = opts.columns
        .map(
            (c) =>
                `<th${c.align === "right" ? ' class="right"' : ""}>${escapeHtml(c.header)}</th>`,
        )
        .join("");

    const bodyRows = opts.rows
        .map((r) => {
            const cells = opts.columns
                .map((c) => {
                    const content = c.render(r);
                    return `<td${c.align === "right" ? ' class="right"' : ""}>${content}</td>`;
                })
                .join("");
            return `<tr>${cells}</tr>`;
        })
        .join("");

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        @page { size: ${orientation}; margin: 10mm; }
        * { box-sizing: border-box; }
        body {
            font-family: Inter, "Noto Sans KR", "Malgun Gothic", sans-serif;
            color: #1b1b1b;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        h1 {
            text-align: center;
            font-size: 18px;
            font-weight: 600;
            margin: 0 0 12px;
        }
        .summary {
            font-size: 13px;
            color: #494949;
            margin: 0 0 16px;
            text-align: right;
            white-space: pre-line;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        thead th {
            text-align: left;
            padding: 10px 8px;
            border-top: 1px solid #1b1b1b;
            border-bottom: 1px solid #1b1b1b;
            font-weight: 600;
            background: #fafafa;
        }
        thead th.right { text-align: right; }
        tbody td {
            padding: 10px 8px;
            border-bottom: 1px solid #e5e5e5;
            vertical-align: top;
        }
        tbody td.right { text-align: right; }
        ${BUILTIN_PRINT_CLASSES}
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${summary}
    <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
    </table>
</body>
</html>`;
}
