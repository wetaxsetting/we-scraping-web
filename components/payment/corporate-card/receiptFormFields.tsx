import { cn } from "@/lib/utils";

/* ============================================================================
 *  Shared field styling + label row for the corporate-card receipt dialogs.
 *
 *  "New Receipt" (create form — {@code NewReceiptDialog}) and "Receipt Detail"
 *  (read-only view — {@code ReceiptDetailDialog}) render the exact same field
 *  visuals; the treatment lives here once so both popups stay pixel-consistent
 *  and neither duplicates the CSS. Mirrors the two Figma field treatments.
 * ========================================================================== */

/* · flatField  — text fields with a 1px flat border (#d4d4d4 / ntrl-4):
 *   Name (manual) / Tax ID / Amount / Purpose / Description. */
export const FLAT_FIELD =
    "h-9 w-full rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-14 font-medium text-wb-ink placeholder:text-wb-ntrl-5 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/40";

/* · raisedField — dropdown-style controls with the elevated button shadow:
 *   Date / Payment Method. */
export const RAISED_FIELD =
    "h-9 w-full rounded-md bg-white px-3 text-wb-14 font-medium text-wb-ink shadow-wb-btn placeholder:text-wb-ntrl-5 focus:outline-none focus:ring-1 focus:ring-brand/40";

/* · readOnlyField — flat field echoing a locked value (New Receipt Tax ID in
 *   Contacts mode; every field in Receipt Detail). */
export const READONLY_FIELD = cn(FLAT_FIELD, "bg-wb-bg-card text-wb-ntrl-6");

/* · readOnlyMultiline — multi-line read-only variant (Receipt Detail
 *   Description). Same tokens as the flat field, rendered as a content-height
 *   block so it grows to fit the text (starting at the flat field's h-9 when
 *   short) and never shows an internal scrollbar — the modal body scrolls
 *   instead. */
export const READONLY_MULTILINE =
    "min-h-9 w-full whitespace-pre-line break-words rounded-md border border-wb-ntrl-4 bg-wb-bg-card px-3 py-2 text-wb-14 font-medium leading-5 text-wb-ntrl-6";

/* ── Label + input row ─────────────────────────────────────────── */

export function Field({
    label,
    required,
    children,
}: {
    label:      string;
    required?:  boolean;
    children:   React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-2">
            <span className="flex items-center gap-0.5 text-wb-14 font-medium text-wb-ntrl-8">
                {label}
                {required && <span aria-hidden className="text-wb-status-rejected-text">*</span>}
            </span>
            {children}
        </label>
    );
}
