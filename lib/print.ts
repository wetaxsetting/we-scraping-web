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
 * Write a self-contained HTML document into a hidden iframe and trigger the
 * browser print dialog on it — the shared mechanism behind {@link printReport}
 * and {@link printApprovalForm}. Mirrors the legacy
 * `comm_0195_001.ts:193-222` iframe-print approach (`setupPrintExpenseApproval`
 * → `contentWindow.print()`). Does nothing on the server. The iframe is removed
 * after the dialog dismisses.
 */
function printHtmlInIframe(html: string): void {
    if (typeof window === "undefined") return;

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

/**
 * Print the given report content in a hidden iframe so no new window
 * opens. Does nothing on the server (`typeof window === "undefined"`
 * guard). The iframe is removed after the print dialog dismisses.
 */
export function printReport<T>(options: PrintReportOptions<T>): void {
    if (typeof window === "undefined") return;
    printHtmlInIframe(buildPrintHtml(options));
}

/**
 * Print a caller-built, self-contained HTML document in a hidden iframe.
 * For documents that are NOT the standard title + summary + table report
 * shape — e.g. the "View e-Invoice Details" legal VAT-invoice form, which
 * mirrors the legacy `einv_0002_002` standalone print page. The caller owns
 * the full `<!DOCTYPE html>…</html>` string (and MUST escape untrusted
 * values via {@link escapeHtml}); this helper only handles the iframe
 * lifecycle + `window.print()`. Does nothing on the server.
 */
export function printHtmlDocument(html: string): void {
    if (typeof window === "undefined") return;
    printHtmlInIframe(html);
}

/**
 * Print a live DOM element by cloning it into a hidden iframe **with the
 * app's own stylesheets**, so the printed output is byte-for-byte the element
 * as rendered on screen (same Tailwind classes, fonts, borders, tables). Used
 * to print the "View e-Invoice Details" modal's invoice document — the exact
 * same `<InvoiceDocument>` DOM the modal shows, with no separate print layout.
 *
 * <p>Copies every {@code <style>} + {@code <link rel="stylesheet">} from the
 * current document head into the iframe, appends an A4 print rule + exact
 * color-adjust, then prints the element's <b>inner</b> HTML. Uses
 * {@code innerHTML} (not {@code outerHTML}) deliberately: the caller's capture
 * wrapper is positioned off-screen ({@code position:fixed; left:-100000px}) so
 * it never affects the modal layout — copying that wrapper verbatim would push
 * the invoice off the printed page (blank output). Its single child (the
 * {@code <InvoiceDocument>}) carries the real, on-page styling. Does nothing on
 * the server / when the element is missing.
 */
export function printElement(el: HTMLElement | null | undefined): void {
    if (typeof window === "undefined" || !el) return;
    const styles = collectDocumentStyles();
    // Render at the invoice's fixed design width (so its internal layout is
    // identical to the modal and nothing reflows), then `zoom` it down to the
    // A4 printable width. Without a fixed width the hidden 0×0 print iframe lays
    // the invoice out unconstrained and it overflows the page — the right edge
    // (border + "Số:") gets clipped. `zoom` (unlike `transform: scale`) shrinks
    // the layout box too, so the scaled invoice actually fits the page. A4
    // portrait at 10mm margins ⇒ ~190mm ≈ 718px printable; 718/1080 ≈ 0.66.
    const DESIGN_WIDTH = 1080;
    const PRINTABLE_PX = 718; // A4 portrait, 10mm margins, 96dpi
    const zoom = PRINTABLE_PX / DESIGN_WIDTH;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">${styles}
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  #wecms-print-root { width: ${DESIGN_WIDTH}px; zoom: ${zoom}; }
</style>
</head><body><div id="wecms-print-root">${el.innerHTML}</div></body></html>`;
    printHtmlInIframe(html);
}

/**
 * Serialize every stylesheet the app currently has applied, so a print/preview
 * iframe renders with the exact same styling. Covers all three ways Next.js /
 * Tailwind can ship CSS: {@code <link rel="stylesheet">}, inline {@code <style>}
 * tags, and {@code document.adoptedStyleSheets} (constructable stylesheets —
 * used by Turbopack dev; a plain `<style>`/`<link>` query would miss these and
 * the invoice would print unstyled). Cross-origin sheets whose rules can't be
 * read are skipped (the {@code <link>} tag copy still loads them by URL).
 */
function collectDocumentStyles(): string {
    const parts: string[] = [];
    document
        .querySelectorAll('link[rel="stylesheet"], style')
        .forEach((n) => parts.push(n.outerHTML));
    try {
        for (const sheet of document.adoptedStyleSheets ?? []) {
            let css = "";
            for (const rule of sheet.cssRules) css += `${rule.cssText}\n`;
            if (css) parts.push(`<style>${css}</style>`);
        }
    } catch {
        // Some sheets' cssRules are unreadable (cross-origin) — ignore; the
        // <link> copies above still cover those.
    }
    return parts.join("\n");
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

/* ============================================================================
 *  Printed Approval Form — refactor of legacy `printed_approval_form01`
 *  (`comm_0195_001.ts setUpDataForPrint`, lines 1472-2182). The legacy popup's
 *  Print action builds a self-contained approval document (approver line with
 *  name + status verb + date, document metadata, subject + description, and a
 *  per-type transaction table) and prints it in a hidden iframe. This is the
 *  shared-popup equivalent — same iframe-print mechanism via
 *  {@link printHtmlInIframe}, same in-memory data, no fresh fetch.
 * ========================================================================== */

/** One approver stamp box on the printed form (legacy `REC3` row), rendered as
 *  three stacked cells: name / status verb / acted-at date — mirrors legacy
 *  `<ul id="apprv_payroll">` (`comm_0195_001.ts:1493-1509`). */
export type ApprovalPrintApprover = {
    name:       string;
    /** Status verb only, e.g. "has approved on" / "is pending" (NO date). */
    statusText: string;
    /** Acted-at date (empty for pending / waiting). */
    actedAt:    string;
};

/** A transaction-table column on the printed approval form. `render` returns
 *  plain text (escaped automatically — unlike {@link PrintColumn}). */
export type ApprovalPrintColumn<T> = {
    header: string;
    align?: "left" | "right";
    render: (row: T) => string;
};

export type ApprovalPrintOptions<T> = {
    /** Centred document heading, e.g. "Approval Details (Corporate Card Payment)". */
    formTitle:           string;
    /** Localised "Document No." label + value. */
    documentNoLabel:     string;
    documentNo?:         string;
    /** Localised "Requestor" label + value. */
    requestorLabel:      string;
    requestor?:          string;
    /** Localised "Subject" label + the approval title. */
    subjectLabel:        string;
    subject:             string;
    /** Localised "Requested Date" label + value. */
    requestedDateLabel:  string;
    requestedDate?:      string;
    /** Localised "Scheduled Date" label + value. */
    scheduledDateLabel:  string;
    scheduledDate?:      string;
    /** Localised "Description" label + the approval content. */
    descriptionLabel:    string;
    content?:            string;
    /** One-line total summary above the table, e.g.
     *  "VND: Total 1 transaction(s) / 550.000". */
    summary?:            string;
    /** Footer line below the table, e.g. "Number of transaction(s) / 2 Transactions". */
    transactionsFooter?: string;
    /** Approver stamp boxes (in order). */
    approvers:           ReadonlyArray<ApprovalPrintApprover>;
    /** Transaction-table columns (per payment type). */
    columns:             ReadonlyArray<ApprovalPrintColumn<T>>;
    /** Transaction rows — the dialog's in-memory dataset. */
    rows:                ReadonlyArray<T>;
    orientation?:        "landscape" | "portrait";
};

/**
 * Print a legacy-style approval form. Builds the self-contained HTML document
 * and prints it via the shared hidden-iframe path. All caller-supplied strings
 * are escaped here — pass plain text.
 */
export function printApprovalForm<T>(options: ApprovalPrintOptions<T>): void {
    if (typeof window === "undefined") return;
    printHtmlInIframe(buildApprovalFormHtml(options));
}

function buildApprovalFormHtml<T>(opts: ApprovalPrintOptions<T>): string {
    const orientation = opts.orientation ?? "landscape";

    // Stamp row — legacy `printed_approval_form01` header: an (empty) company
    // logo box on the left + the approver stamp boxes on the right. Each stamp
    // box is three stacked cells (name / verb / date).
    const approverItems = opts.approvers
        .map(
            (a) => `<li>
                <span class="appr-name">${escapeHtml(a.name)}</span>
                <span class="appr-status">${escapeHtml(a.statusText)}</span>
                <span class="appr-date">${escapeHtml(a.actedAt)}</span>
            </li>`,
        )
        .join("");
    const approverBlock = `<div class="stamp-row">
        <div class="company-logo"></div>
        ${opts.approvers.length > 0 ? `<ul class="approvers">${approverItems}</ul>` : "<div></div>"}
    </div>`;

    const metaCell = (label: string, value?: string) =>
        `<div class="meta-item"><span class="meta-label">${escapeHtml(label)}</span>`
        + `<strong>${escapeHtml(value ?? "")}</strong></div>`;

    const headerCells = opts.columns
        .map((c) => `<th${c.align === "right" ? ' class="right"' : ""}>${escapeHtml(c.header)}</th>`)
        .join("");
    const bodyRows = opts.rows
        .map((r) => {
            const cells = opts.columns
                .map((c) => `<td${c.align === "right" ? ' class="right"' : ""}>${escapeHtml(c.render(r))}</td>`)
                .join("");
            return `<tr>${cells}</tr>`;
        })
        .join("");
    const txnTable = opts.columns.length > 0
        ? `<table class="txn"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
        : "";

    const summary = opts.summary
        ? `<div class="summary">${escapeHtml(opts.summary)}</div>`
        : "";
    const txnFooter = opts.transactionsFooter
        ? `<div class="txn-footer">${escapeHtml(opts.transactionsFooter)}</div>`
        : "";

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${escapeHtml(opts.formTitle)}</title>
    <style>
        @page { size: ${orientation}; margin: 10mm; }
        * { box-sizing: border-box; }
        body {
            font-family: Inter, "Noto Sans KR", "Malgun Gothic", sans-serif;
            color: #1b1b1b; margin: 0; padding: 0; font-size: 12px;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .stamp-row {
            display: flex; justify-content: space-between; align-items: flex-start;
            gap: 8px; margin: 0 0 16px;
        }
        .company-logo { width: 150px; height: 150px; border: 1px solid #c8c8c8; }
        .approvers {
            list-style: none; display: flex; justify-content: flex-end;
            gap: 8px; margin: 0; padding: 0;
        }
        .approvers li {
            border: 1px solid #1b1b1b; min-width: 110px; text-align: center;
        }
        .approvers .appr-name {
            display: block; border-bottom: 1px solid #1b1b1b;
            padding: 6px 8px; font-weight: 600; background: #f0f0f0;
        }
        .approvers .appr-status { display: block; padding: 14px 8px; min-height: 36px; }
        .approvers .appr-date {
            display: block; border-top: 1px solid #1b1b1b; padding: 6px 8px;
        }
        h1 { text-align: center; font-size: 18px; font-weight: 600; margin: 0 0 16px; }
        .txn-footer { margin-top: 10px; font-size: 13px; font-weight: 600; }
        .meta { display: flex; justify-content: space-between; gap: 24px; margin: 0 0 10px; }
        .meta-item { font-size: 13px; }
        .meta-label { color: #494949; margin-right: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        table.info td { border: 1px solid #1b1b1b; padding: 8px 10px; vertical-align: top; }
        table.info td.label { font-weight: 600; background: #f0f0f0; width: 120px; white-space: nowrap; }
        .summary { font-size: 13px; font-weight: 600; margin: 16px 0 8px; text-align: right; }
        table.txn { margin-top: 4px; }
        table.txn th, table.txn td { border: 1px solid #1b1b1b; padding: 8px 10px; text-align: left; vertical-align: top; }
        table.txn thead th { background: #e9e9e9; font-weight: 600; }
        table.txn th.right, table.txn td.right { text-align: right; }
        ${BUILTIN_PRINT_CLASSES}
    </style>
</head>
<body>
    ${approverBlock}
    <h1>${escapeHtml(opts.formTitle)}</h1>
    <div class="meta">
        ${metaCell(opts.documentNoLabel, opts.documentNo)}
        ${metaCell(opts.requestorLabel, opts.requestor)}
    </div>
    <table class="info">
        <tbody>
            <tr>
                <td class="label">${escapeHtml(opts.subjectLabel)}</td>
                <td>${escapeHtml(opts.subject)}</td>
                <td class="label">${escapeHtml(opts.requestedDateLabel)}</td>
                <td>${escapeHtml(opts.requestedDate ?? "")}</td>
                <td class="label">${escapeHtml(opts.scheduledDateLabel)}</td>
                <td>${escapeHtml(opts.scheduledDate ?? "")}</td>
            </tr>
            <tr>
                <td class="label">${escapeHtml(opts.descriptionLabel)}</td>
                <td colspan="5">${escapeHtml(opts.content ?? "")}</td>
            </tr>
        </tbody>
    </table>
    ${summary}
    ${txnTable}
    ${txnFooter}
</body>
</html>`;
}
