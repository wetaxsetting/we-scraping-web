"use client";

import { Info } from "lucide-react";

import Tooltip from "@/components/shared/Tooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BlockedCharsMap, FieldCd } from "@/lib/api/blockedChars";

/**
 * Column-header info-icon tooltip that surfaces the bank-specific
 * blocked-character set for one upload field. Drop-in replacement for
 * the legacy `_v2common.app.addHeaderInfoIcon` (in `add_osmc.js`),
 * built on the shared `<Tooltip>` primitive + the data-driven
 * `useBlockedChars` hook.
 *
 * <p>Renders the lucide `Info` icon at `size-3.5` aligned inline next
 * to the column label. Hovering / focusing the icon opens the shared
 * dark tooltip with the message:
 *
 * <pre>
 *   {fieldName} must not contain
 *   {blockedChars}
 * </pre>
 *
 * <p>The icon ALWAYS renders for the known {@link FieldCd} set so
 * page chrome stays consistent. The tooltip body falls back to
 * {@link DEFAULT_BLOCKED_CHARS} when no bank-specific rule is
 * registered for the {@code (bankCd, pymnType)} pair — mirrors
 * legacy {@code add_osmc.js#addHeaderInfoIcon}'s
 * {@code defaultBlockedChars} table. Server-side
 * {@code SpecialCharValidator} stays the authoritative validator;
 * the defaults here are display-only.
 *
 * @example
 *   const blocked = useBlockedChars(withdrawalBankCd, "INTR");
 *   <th>
 *       Remarks
 *       <BlockedCharsTooltip
 *           fieldCd="RMKS"
 *           fieldNameKey="payment.field.remarks"
 *           blockedChars={blocked}
 *       />
 *   </th>
 *
 * @example  // Inside a column registry's `label`
 *   {
 *       id: "TRAN_USAG",
 *       label: (
 *           <span className="inline-flex items-center gap-1">
 *               {t("payment.column.remarks")}
 *               <BlockedCharsTooltip fieldCd="RMKS" fieldNameKey="payment.field.remarks" blockedChars={blocked} />
 *           </span>
 *       ),
 *       ...
 *   }
 */
/**
 * Field-level fallback character set — surfaces in the tooltip when no
 * bank-specific rule is registered for the field. Mirrors legacy
 * `add_osmc.js`'s `defaultBlockedChars` table verbatim so the popup
 * chrome looks identical regardless of `BLOCKED_CHARS_RULE` seed
 * coverage. The server-side validator never consults these defaults —
 * they are tooltip-only display text.
 */
const DEFAULT_BLOCKED_CHARS: Record<FieldCd, string> = {
    RMKS: "~ ! @ # $ % ^ * = {} [] < >",
    RCPT: "~ ! @ ^ * = {} [] ' \" < >",
    MEMO: "< > ' \" @ $ &",
    BENA: "` ~ ! @ # $ % ^ * = {} [] < >",
    BEAD: "` ~ ! @ # $ % ^ * = {} [] < >",
};

type BlockedCharsTooltipProps = {
    /** Field-code key the rule is registered under. See {@link FieldCd}. */
    fieldCd:       FieldCd;
    /** i18n key for the field name shown inside the tooltip message
     *  (e.g. {@code "payment.field.remarks"}). Resolved through
     *  `useTranslation()`. */
    fieldNameKey:  string;
    /** Output of {@link useBlockedChars}. */
    blockedChars:  BlockedCharsMap;
    /** Optional extra classes on the icon wrapper — usually unset. */
    className?:    string;
};

export default function BlockedCharsTooltip({
    fieldCd,
    fieldNameKey,
    blockedChars,
    className,
}: BlockedCharsTooltipProps) {
    const { t } = useTranslation();

    // Prefer the bank-specific rule from the server; fall back to the
    // legacy field-level default so the icon always appears for known
    // fields. Empty / missing both ways → render nothing (defensive
    // for unknown FieldCd values).
    const chars = blockedChars[fieldCd] || DEFAULT_BLOCKED_CHARS[fieldCd];
    if (!chars) return null;

    const fieldName = t(fieldNameKey);
    // Mirrors legacy `_v2common.app.addHeaderInfoIcon`:
    //   EN  — "{field} must not contain\n{chars}"
    //   KO  — "{field}에는 {chars}를 포함할 수 없습니다."
    //   VI  — "{field} không được chứa\n{chars}"
    // Single i18n key with two interpolations keeps the message
    // translation owned by locales/*.json (one source of truth) instead
    // of a per-locale switch inside the component.
    const message = t("payment.blocked_chars.tooltip", {
        field: fieldName,
        chars,
    });

    // Pin to `"top"` placement — column headers sit at the top of the
    // table region, so the default `"auto"` (which prefers bottom when
    // there's room below) would drop the tooltip ON the data rows and
    // obscure the first row's cells. Top placement mirrors legacy
    // `_v2common.app.addHeaderInfoIcon`'s rendering.
    return (
        <Tooltip
            content={message}
            placement="top"
            className={cn("inline-flex", className)}
        >
            <Info
                className="size-3.5 cursor-help text-wb-ntrl-6"
                aria-hidden
            />
        </Tooltip>
    );
}
