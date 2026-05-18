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

/** A multi-table print section. Each section renders its own bold title,
 *  thead, tbody, and optional footer rows (e.g. `Total(VND)` / `Total(USD)`).
 *  Sections share the same orientation + popup window. */
export type PrintSection<T> = {
    /** Bold section title (e.g. `"Current Accounts"`). Optional — omit for
     *  the report's body-level title block. Auto-escaped. */
    title?: string;
    /** Column definitions for this section. */
    columns: ReadonlyArray<PrintColumn<T>>;
    /** Print source — the caller's filtered/sorted in-memory dataset for
     *  this section. */
    rows: ReadonlyArray<T>;
    /** Optional footer rows rendered after the body — used for per-currency
     *  `Total(CCY)` rows. Each footer row is a positional array keyed
     *  against {@link columns}; cells render as raw HTML (escape upstream). */
    footers?: ReadonlyArray<ReadonlyArray<{ html: string; align?: "left" | "right" }>>;
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
    /** Column definitions; rendered in order. Ignored when {@link sections}
     *  is supplied. */
    columns?: ReadonlyArray<PrintColumn<T>>;
    /** Print source — the caller's filtered/sorted in-memory dataset.
     *  Ignored when {@link sections} is supplied. */
    rows?: ReadonlyArray<T>;
    /**
     * Multi-section print mode. When supplied, the helper renders each
     * section's title + table + optional footer rows in order. Use this
     * for reports that compose several blocks on one page (e.g. Daily
     * Financial's Financial Status header + Current Accounts ledger +
     * Saving Accounts ledger). `columns` / `rows` are ignored when this
     * is non-empty.
     */
    sections?: ReadonlyArray<PrintSection<unknown>>;
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
 * Print the given report content in a hidden iframe so no new window
 * opens. Does nothing on the server (`typeof window === "undefined"`
 * guard). The iframe is removed after the print dialog dismisses.
 */
export function printReport<T>(options: PrintReportOptions<T>): void {
    if (typeof window === "undefined") return;
    const html = buildPrintHtml(options);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) {
        document.body.removeChild(iframe);
        return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Give the browser one tick to finish layout before printing.
    // After the dialog closes, remove the iframe.
    const cw = iframe.contentWindow!;
    cw.onload = () => {
        cw.focus();
        cw.print();
        // Small delay so the print dialog has time to appear before we
        // detach the document. 500 ms is sufficient on all tested browsers.
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
        }, 500);
    };
}

const BUILTIN_PRINT_CLASSES = `
    .muted { color: #737373; font-weight: 400; }
    .small { font-size: 12px; }
    .err   { color: #c0392b; font-weight: 500; margin-right: 6px; }
`;

function renderSection<T>(section: PrintSection<T>): string {
    const sectionTitle = section.title
        ? `<h2 class="section-title">${escapeHtml(section.title)}</h2>`
        : "";

    const headerCells = section.columns
        .map(
            (c) =>
                `<th${c.align === "right" ? ' class="right"' : ""}>${escapeHtml(c.header)}</th>`,
        )
        .join("");

    const bodyRows = section.rows
        .map((r) => {
            const cells = section.columns
                .map((c) => {
                    const content = c.render(r);
                    return `<td${c.align === "right" ? ' class="right"' : ""}>${content}</td>`;
                })
                .join("");
            return `<tr>${cells}</tr>`;
        })
        .join("");

    const footerRows = (section.footers ?? [])
        .map((row) => {
            const cells = row
                .map(
                    (c) =>
                        `<td${c.align === "right" ? ' class="right"' : ""}>${c.html}</td>`,
                )
                .join("");
            return `<tr class="totals">${cells}</tr>`;
        })
        .join("");

    return `${sectionTitle}<table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}${footerRows}</tbody>
    </table>`;
}

function buildPrintHtml<T>(opts: PrintReportOptions<T>): string {
    const orientation = opts.orientation ?? "landscape";
    const title = escapeHtml(opts.title);
    const summary = opts.summary
        ? `<div class="summary">${escapeHtml(opts.summary)}</div>`
        : "";

    const sections: ReadonlyArray<PrintSection<unknown>> =
        opts.sections && opts.sections.length > 0
            ? opts.sections
            : [{
                columns: (opts.columns ?? []) as ReadonlyArray<PrintColumn<unknown>>,
                rows: (opts.rows ?? []) as ReadonlyArray<unknown>,
            }];

    const body = sections.map(renderSection).join('<div class="section-gap"></div>');

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
            white-space: pre-line;
        }
        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin: 0 0 8px;
            padding-left: 8px;
            border-left: 3px solid #76C3FD;
        }
        .section-gap { height: 14px; }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-bottom: 4px;
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
        tbody tr.totals td {
            font-weight: 600;
            background: #f5f5f5;
            border-top: 1px solid #1b1b1b;
        }
        ${BUILTIN_PRINT_CLASSES}
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${summary}
    ${body}
</body>
</html>`;
}
