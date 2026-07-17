"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import EllipsisTooltip from "@/components/shared/EllipsisTooltip";
import { formatLocalDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import { resolveVanMessage } from "@/lib/i18n/dictionaryVan";
import {
    resolveScrapingResultMessage,
    type TFunc,
} from "@/lib/i18n/scrapingResultCodes";
import { modalStack } from "@/lib/modalStack";

import { composeEInvoiceNo, parseReqData } from "./instCode";
import { resolveFirmBankingServiceName } from "./serviceName";
import type {
    FirmBankingHistoryRow,
    FirmBankingServiceType,
} from "./types";

/**
 * Anchored detail popover for a Firm Banking History row — Figma 6270:25829
 * (Firm Banking Transaction), 6557:27160 (Scraping Transfer), 6557:27216
 * (Vietnam GDT Inquiry), 6557:27273 (Vietnam Business Inquiry).
 *
 * <p>Behaves as a dropdown / popover anchored to the clicked
 * `View Details` trigger, NOT as a centered modal. Mirrors the
 * {@code <ViewSettingPopover>} pattern: portal-mounted to
 * {@code document.body} so the table's scroll container can't clip it,
 * position computed from the trigger's {@link DOMRect}, no backdrop
 * overlay, and the table behind the popover stays interactive.
 *
 * <p>Lifecycle:
 *   - ESC closes — only when this popover sits at the top of the shared
 *     {@link modalStack}, so pressing ESC inside Settings closes the popover
 *     first (and a second ESC still closes Settings).
 *   - Outside-click closes — listener is deferred one tick so the click that
 *     opened the popover doesn't immediately re-close it.
 *   - Scroll closes — the popover's position becomes stale once the trigger
 *     moves out from under it; cheaper to dismiss than to track.
 *   - Clicking another `View Details` triggers outside-click → onClose, then
 *     the new click sets fresh state and the popover re-mounts (the panel
 *     uses `key={row.id}` so the copy/copied flag resets).
 *
 * <p>Phase 3 wiring: the popover now reads its content from the row's
 * actual wire fields ({@code rsltCd}, {@code rsltMsg}, {@code job},
 * {@code reqData}, {@code vanOrgCd}) instead of the static
 * placeholder map. Per-leg shape decisions (Tax ID for {@code B},
 * e-Invoice No. for {@code G}, VAN Code for {@code F}) mirror the
 * legacy {@code comm_0221_001.ts:429-638} {@code fnDetails} branches.
 */

type DetailRow = { label: string; value: string };

type FirmBankingHistoryDetailPopoverProps = {
    /** DOMRect of the clicked `View Details` button — anchor for positioning. */
    anchorRect: DOMRect;
    /** Full row payload — all popover content derives from here. */
    row: FirmBankingHistoryRow;
    onClose: () => void;
};

const POPUP_MAX_HEIGHT = 360;
/** Fixed popup width — every leg renders at this width. Long values
 *  in the right-hand value column truncate with ellipsis rather than
 *  expanding the card. Matches the Figma narrow-variant width
 *  (≈388 px). */
const POPUP_WIDTH = 388;
const OFFSET = 4;

/** Title key per leg — matches the static i18n bundle. */
const TITLE_KEY: Record<FirmBankingServiceType, string> = {
    firm_banking_transaction:
        "settings.firm_banking_history.detail.firm_banking_transaction.title",
    scraping_transfer:
        "settings.firm_banking_history.detail.scraping_transfer.title",
    vietnam_gdt_inquiry:
        "settings.firm_banking_history.detail.vietnam_gdt_inquiry.title",
    vietnam_business_inquiry:
        "settings.firm_banking_history.detail.vietnam_business_inquiry.title",
};

/**
 * Build the per-leg label/value list for the popover. Mirrors legacy
 * {@code comm_0221_001.ts:429-638} {@code fnDetails} branches:
 *
 * <ul>
 *   <li>{@code F} (firm banking) — date/time, service name, withdrawal
 *       inst code, VAN code, sequence no., response code, response
 *       message <b>localized via DICTIONARY_VAN</b>.</li>
 *   <li>{@code S} (scraping) — date/time, service name, withdrawal inst
 *       code, sequence no., response code, response message.</li>
 *   <li>{@code G} (GDT e-Invoice) — date/time, service name,
 *       e-Invoice No. (decoded from {@code req_data}), response code,
 *       response message.</li>
 *   <li>{@code B} (business) — date/time, service name, Tax ID
 *       (decoded from {@code req_data.search}), response code, response
 *       message.</li>
 * </ul>
 *
 * <p><b>Per-leg result-message localization.</b>
 * <ul>
 *   <li><b>F-leg</b> rows resolve through {@link resolveVanMessage}
 *       against the {@code DICTIONARY_VAN} XML port (4-char VAN
 *       gateway codes). Legacy parity with
 *       {@code jexjs.getCode("DICTIONARY_VAN", RSLT_CD)}
 *       (comm_0221_001.ts:440-442).</li>
 *   <li><b>S / G / B legs</b> resolve through
 *       {@link resolveScrapingResultMessage} against the 18-code
 *       scraping registry. Legacy parity with the inline
 *       {@code resultMap[RSLT_CD]} at comm_0221_001.ts:459-481.</li>
 * </ul>
 * Fallback chain (both resolvers): localized i18n message → row's
 * {@code rsltMsg} → raw {@code rsltCd} (S/G/B) or "Failed" label
 * (F) → empty string. Never blank.
 */
function buildDetailRows(
    row: FirmBankingHistoryRow,
    formattedDateTime: string,
    locale: Locale,
    failedLabel: string,
    t: TFunc,
): DetailRow[] {
    const dateTime: DetailRow = {
        label: "settings.firm_banking_history.detail.field.date_time",
        value: formattedDateTime,
    };
    // Service-name display — same lookup chain as the table cell:
    //   1. Server-resolved i18n key via Spring TranTp / FirmBankingServiceNameResolver
    //   2. Raw svc_nm from the wire
    //   3. The row's job string as a last resort
    // Never blank. Frontend never holds a hardcoded SERVICE_NAME_MAP.
    // Service Name with legacy `getServiceName` parity (numeric "20x : "
    // prefix for mapped firm-banking codes) — same resolver as the list cell.
    const localizedServiceName = resolveFirmBankingServiceName(
        row.serviceNameKey,
        row.serviceName,
        row.serviceName || row.job || "",
        t,
    );
    const serviceName: DetailRow = {
        label: "settings.firm_banking_history.detail.field.service_name",
        value: localizedServiceName,
    };
    const responseCode: DetailRow = {
        label: "settings.firm_banking_history.detail.field.response_code",
        // Legacy `comm_0221_001.ts:606` displays "9999" when the response
        // code is empty.
        value: row.rsltCd || "9999",
    };
    // Per-leg resolver dispatch — see Javadoc above. For S/G/B legs, an
    // empty response code falls back to "Data Not Found" (legacy j024,
    // comm_0221_001.ts:618-619) rather than the F-leg "Failed" label.
    const resolvedMsg =
        row.serviceType === "firm_banking_transaction"
            ? resolveVanMessage(row.rsltCd, row.rsltMsg, locale, failedLabel)
            : resolveScrapingResultMessage(
                row.rsltCd,
                row.rsltMsg,
                t,
                t("common.no_data_found"),
            );
    const responseMessage: DetailRow = {
        label: "settings.firm_banking_history.detail.field.response_message",
        value: resolvedMsg,
    };

    if (row.serviceType === "firm_banking_transaction") {
        return [
            dateTime,
            serviceName,
            {
                label: "settings.firm_banking_history.detail.field.withdrawal_inst_code",
                value: row.instCode || "",
            },
            {
                label: "settings.firm_banking_history.detail.field.van_code",
                value: row.vanOrgCd ?? "",
            },
            {
                label: "settings.firm_banking_history.detail.field.sequence_no",
                value: row.seqNo || "",
            },
            responseCode,
            responseMessage,
        ];
    }

    if (row.serviceType === "scraping_transfer") {
        return [
            dateTime,
            serviceName,
            {
                label: "settings.firm_banking_history.detail.field.withdrawal_inst_code",
                value: row.instCode || "",
            },
            {
                label: "settings.firm_banking_history.detail.field.sequence_no",
                value: row.seqNo || "",
            },
            responseCode,
            responseMessage,
        ];
    }

    if (row.serviceType === "vietnam_gdt_inquiry") {
        // Legacy comm_0221_001.js:330 builds the e-Invoice No. as
        // `${numericSymbol}${invoiceSymbol}-${invoiceNo}`. Fall back to
        // the raw req_data string if parsing fails. Shared with the list
        // table cell via `composeEInvoiceNo`.
        const composed =
            composeEInvoiceNo(parseReqData(row.reqData)) || (row.reqData ?? "");
        return [
            dateTime,
            serviceName,
            {
                label: "settings.firm_banking_history.detail.field.einvoice_no",
                value: composed,
            },
            responseCode,
            responseMessage,
        ];
    }

    if (row.serviceType === "vietnam_business_inquiry") {
        const parsed = parseReqData(row.reqData);
        const taxId = String(parsed?.search ?? row.reqData ?? "");
        return [
            dateTime,
            serviceName,
            {
                label: "settings.firm_banking_history.detail.field.tax_id",
                value: taxId,
            },
            responseCode,
            responseMessage,
        ];
    }

    // Defensive default — show the universal subset.
    return [dateTime, serviceName, responseCode, responseMessage];
}

export default function FirmBankingHistoryDetailPopover({
    anchorRect,
    row,
    onClose,
}: FirmBankingHistoryDetailPopoverProps) {
    const { t, locale } = useTranslation();
    const [copied, setCopied] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const titleKey = TITLE_KEY[row.serviceType];

    // Format the row's date + time for the popover header. `tarn_dtm` is
    // VN local wall-clock (the view already applied `kr_to_vn_time` to
    // the F leg), so format per the active language with NO timezone
    // shift — locale-aware date (EN DD-MMM-YYYY / KO YYYY-MM-DD / VI
    // DD-MM-YYYY) plus HH:mm:ss.
    const formattedDateTime = useMemo(() => {
        const { date, time } = formatLocalDtmByLanguage(row.tarnDtm, locale);
        if (!date) return "";
        return time ? `${date} ${time}` : date;
    }, [row.tarnDtm, locale]);

    // Failed-label fallback for the F-leg dictionary resolver — mirrors
    // legacy `comm_0221_001.ts:442` `multiLanguagesObj['comm_0221_001_j004']`.
    const failedLabel = t("settings.firm_banking_history.result.failed");
    const detailRows = useMemo(
        () => buildDetailRows(row, formattedDateTime, locale, failedLabel, t),
        [row, formattedDateTime, locale, failedLabel, t],
    );

    // Anchor the popover's RIGHT edge to the trigger's right edge.
    // The card is FIXED-WIDTH (POPUP_WIDTH below) — long values inside
    // any detail row truncate with ellipsis instead of pushing the
    // card wider, so the layout stays visually stable across legs and
    // across dynamic gateway responses (mirrors the user request to
    // "keep the existing popup width fixed; do not auto-expand on long
    // text"). On viewports narrower than POPUP_WIDTH + 16 px the
    // `max-w-[calc(100vw-32px)]` clamp keeps the card on-screen.
    const style = useMemo<React.CSSProperties>(() => {
        if (typeof window === "undefined") return {};
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const right = Math.max(8, vw - anchorRect.right);

        const belowTop = anchorRect.bottom + OFFSET;
        const aboveBottom = anchorRect.top - OFFSET;
        if (belowTop + POPUP_MAX_HEIGHT < vh) {
            return { top: belowTop, right };
        }
        return { bottom: vh - aboveBottom, right };
    }, [anchorRect]);

    // Modal stack — keeps the SettingsModal's ESC handler from also closing
    // Settings on the same keystroke that closes this popover.
    const stackIdRef = useRef<number | null>(null);
    useEffect(() => {
        const id = modalStack.push();
        stackIdRef.current = id;
        return () => {
            modalStack.pop(id);
            stackIdRef.current = null;
        };
    }, []);

    // ESC closes — only when at the top of the modal stack.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            if (stackIdRef.current === null) return;
            if (!modalStack.isTop(stackIdRef.current)) return;
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // Outside-click closes. Defer one tick so the click that opened the
    // popover doesn't immediately re-close it (the click bubbles to
    // document AFTER React has mounted us, which is too late for the
    // listener-not-yet-registered guard).
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const id = window.setTimeout(() => {
            document.addEventListener("mousedown", onDocClick);
        }, 0);
        return () => {
            window.clearTimeout(id);
            document.removeEventListener("mousedown", onDocClick);
        };
    }, [onClose]);

    // Scroll closes — once the trigger moves out from under the popover the
    // anchored position is stale. Capture-phase listener so scrolling inside
    // the table (or any nested overflow container) also fires.
    useEffect(() => {
        const onScroll = () => onClose();
        window.addEventListener("scroll", onScroll, true);
        return () => window.removeEventListener("scroll", onScroll, true);
    }, [onClose]);

    const handleCopy = async () => {
        const lines = [
            t(titleKey),
            ...detailRows.map((r) => `${t(r.label)}: ${r.value}`),
        ];
        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard permission denied or unavailable — silent no-op so the
            // static UI does not throw an error dialog.
        }
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            ref={popoverRef}
            role="dialog"
            aria-label={t(titleKey)}
            style={style}
            // Compact info card per Figma 6270:25829 (rounded-[16px],
            // three-stop drop shadow). Padding + gaps run a notch tighter
            // than the Figma frames per the user request to make the
            // popover feel more compact while preserving readability.
            //
            // FIXED WIDTH (`w-[388px]`) — long values in any detail row
            // truncate with ellipsis instead of expanding the card.
            // `max-w-[calc(100vw-32px)]` is a viewport-clamp safety net
            // for unusually narrow viewports where 388 px would clip;
            // never wider than the fixed value.
            //
            // z-[60] sits above Settings' L1 overlay (z-50) without competing
            // with the primitive `<Dialog>` stack levels (z-[60]/[61]) —
            // this popover doesn't render an overlay, so a single z-[60] is
            // enough and stays clear of any future stacked dialog.
            className="fixed z-[60] flex w-[388px] max-w-[calc(100vw-32px)] flex-col gap-3 rounded-[16px] bg-white p-3 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.22),0px_1px_2px_0px_rgba(0,0,0,0.06),0px_4px_20px_0px_rgba(0,0,0,0.15)]"
        >
            <div className="text-wb-14 font-medium tracking-wb-tight text-wb-dark">
                {t(titleKey)}
            </div>

            <div className="flex flex-col gap-1.5">
                {detailRows.map((r) => (
                    <div key={r.label} className="flex items-center gap-1">
                        <span className="w-[200px] shrink-0 text-wb-13 font-medium text-wb-ntrl-8 opacity-70">
                            {t(r.label)}
                        </span>
                        {/*
                         * Value column is truncating-fixed and shows a
                         * Figma-styled custom tooltip (Figma node
                         * 9198:8036) on hover when the value is too
                         * long for the cell width:
                         *
                         *   - `flex-1`   — claims remaining row width
                         *                  (label is shrink-0 200 px;
                         *                  container is fixed 388 px).
                         *   - `min-w-0`  — allows shrink inside the flex
                         *                  parent (default min-w-content
                         *                  would block truncation).
                         *   - <EllipsisTooltip> — owns the truncation
                         *                  (`truncate` utility) AND the
                         *                  custom hover tooltip; never
                         *                  uses the browser-default
                         *                  `title` attribute. Tooltip
                         *                  shows full text on hover when
                         *                  truncated; renders nothing
                         *                  for fitting values.
                         *
                         * Copy button still copies the full original
                         * value to clipboard (sources from `r.value`,
                         * not the truncated DOM text).
                         */}
                        <div className="min-w-0 flex-1 text-right">
                            <EllipsisTooltip
                                text={r.value || "—"}
                                className="text-wb-13 font-medium text-wb-ink"
                            />
                        </div>
                    </div>
                ))}

                <div className="flex items-center justify-end pt-0.5">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex cursor-pointer items-center gap-1 text-wb-13 font-medium text-wb-ink hover:opacity-70"
                    >
                        <span>
                            {copied
                                ? t("settings.firm_banking_history.detail.copied")
                                : t("settings.firm_banking_history.detail.copy")}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/common/ico-copy.svg"
                            alt=""
                            aria-hidden
                            className="size-4"
                        />
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
