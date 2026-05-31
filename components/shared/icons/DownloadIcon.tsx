/**
 * DownloadIcon — shared download glyph for Payment list-row download actions.
 *
 * Renders the Figma `ico_arrow-down` asset (node 2033:26577) — a filled
 * file-with-download-arrow glyph — as an `<img>`, per CLAUDE.md §8a: a named
 * Figma icon ships as a committed SVG under `public/assets/` and is referenced
 * via `<img>`, never inlined as `<svg>` and never substituted with a lucide /
 * Heroicons / FontAwesome glyph.
 *
 * Single source of truth for the per-row download icon across all five Payment
 * modules (Internal Transfer, Vendor, Expense, Payroll, Overseas). Both shared
 * batch-list tables — `<PaymentScheduledBatchListPage>` and
 * `<PaymentResultBatchListPage>` — consume this component, so the asset, size,
 * stroke weight, and color stay identical everywhere. Default size is `size-6`
 * (24 px), filling the `size-6` action button so the glyph reads at the Figma
 * size on every Payment list page.
 */
export default function DownloadIcon({ className = "size-6" }: { className?: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src="/assets/common/ico-download-file.svg"
            alt=""
            aria-hidden
            className={className}
        />
    );
}
