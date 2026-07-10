"use client";

import InfoIcon from "@/components/shared/InfoIcon";
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
 * <p>The icon renders ONLY when the blocked-chars API returns a real
 * configured rule for the field on the selected withdrawal bank
 * (audit task-44508, P2). There is no hardcoded fallback set — a
 * field with no active {@code BLOCKED_CHARS_RULE} row shows no icon,
 * so the tooltip can never display a character set that diverges from
 * what the server-side {@code SpecialCharValidator} actually enforces.
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

    // Render ONLY when the server returned a real configured rule for
    // this field. No hardcoded fallback (audit task-44508, P2) — an
    // unconfigured field shows no icon, so the tooltip can never diverge
    // from what SpecialCharValidator actually enforces.
    const raw = blockedChars[fieldCd];
    if (!raw) return null;

    // The API returns the raw concatenated blocked-char set (no spaces).
    // The task-44508 formula requires a single space between each
    // character — space-separate here so the tooltip matches the
    // backend upload message (SpecialCharValidator.spaceSeparated).
    const chars = Array.from(raw).join(" ");

    const fieldName = t(fieldNameKey);
    // Canonical task-44508 formula — single line, colon separator:
    //   EN  — "{field} must not contain: {chars}"
    //   KO  — "{field}에는 {chars}를 포함할 수 없습니다."
    //   VI  — "{field} không được chứa: {chars}"
    // The message translation is owned by locales/*.json (one source of
    // truth). `chars` already carries a single space between each
    // character (the DB stores the raw set; the tooltip renders it
    // verbatim). React auto-escapes the string, so <, >, &, quotes, and
    // backslashes display safely.
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
            <InfoIcon />
        </Tooltip>
    );
}
