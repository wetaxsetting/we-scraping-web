import { cn } from "@/lib/utils";

/**
 * Canonical WeCMS "information" glyph — the filled grey circled-i shown
 * next to a label that carries a hover tooltip. This is the SINGLE source
 * of truth for the info-icon shape / size / colour so every info icon in
 * the app is visually identical.
 *
 * <p>Renders the PO-approved asset {@code /assets/common/ico-info.svg}
 * (16 × 16, fill #828282) — the design already used by the "Match to
 * Payment Transaction" modal. Do NOT substitute a lucide glyph
 * ({@code Info} / {@code CircleHelp} / {@code HelpCircle}) or a
 * per-screen inline SVG — import this component instead so the icon stays
 * consistent everywhere.
 *
 * <p>Consumers:
 * <ul>
 *   <li>{@link BlockedCharsTooltip} — every payment / approval table
 *       header info icon (Recipient Name, Remarks, …).</li>
 *   <li>Bank Transaction Sync + Update e-Invoice "Auto" tooltips.</li>
 *   <li>"Matching remarks" info icons (Suggested Bank Transaction popup +
 *       the Match-to-Payment-Transaction / Smart Organizer modal).</li>
 * </ul>
 *
 * <p>This component renders ONLY the glyph. Wrap it in the shared
 * {@link Tooltip} primitive to attach the hover message.
 *
 * <p>Visual contract:
 * <ul>
 *   <li>Glyph — filled circled-i ({@code /assets/common/ico-info.svg})</li>
 *   <li>Size — {@code size-4} (16 px)</li>
 *   <li>Colour — asset fill #828282 (= {@code wb-muted})</li>
 *   <li>Cursor — {@code cursor-help}</li>
 * </ul>
 *
 * @param className optional extra classes (e.g. spacing). Merged AFTER the
 *        base so callers can tune layout, but the glyph's size stays fixed
 *        unless deliberately overridden.
 */
export default function InfoIcon({ className }: { className?: string }) {
    return (
        <img
            src="/assets/common/ico-info.svg"
            alt=""
            aria-hidden
            className={cn("size-4 shrink-0 cursor-help", className)}
        />
    );
}
