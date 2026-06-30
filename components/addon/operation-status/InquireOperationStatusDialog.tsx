"use client";

import { useState } from "react";
import { Check, CircleX, Search } from "lucide-react";

import {
    OPERATION_STATUS_ACTIVE_CODES,
    type OperationStatusCode,
} from "./types";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDialog } from "@/components/shared/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { ApiCallError } from "@/lib/api/banking";
import { createOperationStatus, inquireOperationStatus } from "@/lib/api/addon";
import { formatLocalDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Tax-status presentation — mirrors the parent page's
 *  {@code OperationStatusCell} (legacy `aosv_0001_001.ts`) so the popup
 *  pill and the table cell read identical: green for the three active
 *  codes, red for every other known (inactive) status, muted neutral for
 *  an unrecognised GDT string. */
function isActiveStatus(statusCd: string): boolean {
    return OPERATION_STATUS_ACTIVE_CODES.has(statusCd as OperationStatusCode);
}

function statusTone(statusCd: string): string {
    if (statusCd === "unknown") return "text-wb-ink";
    return isActiveStatus(statusCd)
        ? "text-wb-status-approved-text"
        : "text-wb-status-rejected-text";
}

/** Background tint for the status banner — pairs with the text tone
 *  from {@link statusTone}. Soft green for active, soft red for inactive,
 *  soft neutral for an unrecognised status. */
function statusBannerBg(statusCd: string): string {
    if (statusCd === "unknown") return "bg-wb-bg-sidebar";
    return isActiveStatus(statusCd)
        ? "bg-wb-status-approved-bg"
        : "bg-wb-status-rejected-bg";
}

/** Mask Tax ID input as the user types — strips every non-digit,
 *  inserts the hyphen after the 10th digit, and caps at 13 digits
 *  (10 main + 3 branch). Mirrors the legacy {@code aosv_0001_002}
 *  regex contract ({@code ^\d{10}(-\d{3})?$}).
 *  Examples:
 *    "3234364446"      → "3234364446"
 *    "32343644465"     → "3234364446-5"
 *    "3234364446545"   → "3234364446-545"
 *    "abc-3234-364"    → "3234364"
 *    "32343644-46-545" → "3234364446-545"   (re-flows the hyphen) */
function formatTaxCodeInput(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    if (digits.length <= 10) return digits;
    return digits.slice(0, 10) + "-" + digits.slice(10);
}

/**
 * Format the GDT {@code yyyyMMddHHmmss} timestamp locale-aware as
 * {@code <date>, HH:mm:ss}. The GDT {@code search_datetime} is a
 * provider-supplied wall-clock (Vietnam local already — no UTC
 * semantics, same as the Coocon exchange-rate "Inquired on" stamp), so
 * it is formatted in place with no TZ shift. The date follows the active
 * language (EN {@code DD-MMM-YYYY} / KO {@code YYYY-MM-DD} /
 * VI {@code DD-MM-YYYY}). Returns the raw value on parse failure so we
 * never blank the row out. */
function formatLastUpdate(raw: string | undefined, locale: Locale): string {
    if (!raw) return "";
    const { date, time } = formatLocalDtmByLanguage(raw, locale);
    if (!date) return raw.trim();
    return time ? `${date}, ${time}` : date;
}

type InquireOperationStatusDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Fires after a successful Save so the parent can re-fetch the list. */
    onSaved?: () => void;
};

/**
 * "Inquire Operation Status" popup — Figma 12346:109158, legacy
 * {@code aosv_0001_002_r001}. User enters a Tax ID, clicks "Get
 * Business Info", and the OSMC → GDT bridge returns the customer
 * name + address. Save persists the row into {@code OPRT_STTS_INFO}
 * via {@code POST /api/v1/addon/operation-status} (create-only —
 * duplicate Tax IDs are rejected); Close discards.
 *
 * <p>Validation matches the backend regex (10 digits, optional
 * {@code -NNN}); on bridge failure the orange warning text stays
 * visible and the read-only fields stay blank.
 */
export default function InquireOperationStatusDialog({
    open,
    onOpenChange,
    onSaved,
}: InquireOperationStatusDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    const [taxCode, setTaxCode] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [address, setAddress] = useState("");
    const [statusCd, setStatusCd] = useState("");
    const [searchDatetime, setSearchDatetime] = useState("");
    // Raw GDT fields the Save endpoint persists verbatim (legacy
    // aosv_0001_002_c001 required-field set). Not shown in the UI, but
    // stashed from the Inquire response so Save can re-send them.
    const [companyStatus, setCompanyStatus] = useState("");
    const [representativeName, setRepresentativeName] = useState("");
    const [busy, setBusy] = useState(false);
    const [hasResult, setHasResult] = useState(false);

    /* Sticky mirror of `busy` — keeps the Tax ID input, the Get
     * Business Info button, and the footer Save / Close buttons in
     * their busy state across the minimum-visibility window so a fast
     * GDT response doesn't flicker the chrome enabled → disabled →
     * enabled. The functional guard (`busy`) is still checked at
     * handler entry so a duplicate request can never queue, even
     * before the sticky flag flips. */
    const stickyBusy = useStickyLoading(busy);

    const reset = () => {
        setTaxCode("");
        setCompanyName("");
        setAddress("");
        setStatusCd("");
        setSearchDatetime("");
        setCompanyStatus("");
        setRepresentativeName("");
        setHasResult(false);
        setBusy(false);
    };

    const handleClose = () => {
        reset();
        onOpenChange(false);
    };

    const handleGetBusinessInfo = async () => {
        const trimmed = taxCode.trim();
        if (!/^\d{10}(-\d{3})?$/.test(trimmed)) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("operation.inquire.invalid_tax_code"),
                errorCode: "WBE_VALIDATION",
            });
            return;
        }
        setBusy(true);
        try {
            const res = await inquireOperationStatus(trimmed);
            setCompanyName(res.company_nm ?? "");
            setAddress(res.office_add ?? "");
            setStatusCd(res.status_cd ?? "");
            setSearchDatetime(res.search_datetime ?? "");
            setCompanyStatus(res.company_status ?? "");
            setRepresentativeName(res.representative_first_name ?? "");
            setHasResult(true);
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const msg = err instanceof Error ? err.message : t("common.error.unknown");
            setCompanyName("");
            setAddress("");
            setStatusCd("");
            setSearchDatetime("");
            setCompanyStatus("");
            setRepresentativeName("");
            setHasResult(false);
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: msg,
                errorCode: code,
            });
        } finally {
            setBusy(false);
        }
    };

    const handleSave = async () => {
        if (busy) return; // guard against double-submit while a save is in flight
        // Persist the inquired registration into OPRT_STTS_INFO (legacy
        // aosv_0001_002_c001). Create-only: a duplicate (BIZ_KEY, TAXCODE)
        // comes back as WBE_OPERATION_STATUS_DUPLICATE and keeps the popup
        // open so the user can adjust. On success the parent re-fetches.
        setBusy(true);
        try {
            await createOperationStatus({
                tax_code: taxCode.trim(),
                company_nm: companyName,
                company_status: companyStatus,
                office_add: address,
                search_datetime: searchDatetime,
                representative_first_name: representativeName,
            });
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("operation.inquire.save_success"),
            });
            onSaved?.();
            handleClose();
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const msg = err instanceof Error ? err.message : t("common.error.unknown");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: msg,
                errorCode: code,
            });
        } finally {
            setBusy(false);
        }
    };

    const canSave = hasResult && companyName.length > 0;

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
            <DialogContent
                className="max-w-[520px]"
                aria-describedby={undefined}
                // Lock against accidental dismissal while a system error
                // dialog is layered on top (clicking the system dialog's
                // OK button must not bubble down and close this popup).
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <DialogHeader>
                    <DialogTitle className="text-wb-16">{t("operation.inquire.title")}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("operation.inquire.title")}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-4">
                    {/* Tax ID + Get Business Info CTA */}
                    <div className="flex flex-col gap-2">
                        <label className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                            <span>{t("operation.inquire.tax_id")}</span>
                            <span aria-hidden className="text-wb-red-07">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={taxCode}
                                onChange={(e) => setTaxCode(formatTaxCodeInput(e.target.value))}
                                placeholder="0000000000-(000)"
                                maxLength={14}
                                inputMode="numeric"
                                disabled={stickyBusy}
                                className="flex h-8 flex-1 rounded-md border border-wb-ntrl-4 bg-white px-2 text-wb-14 font-medium leading-4 text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <button
                                type="button"
                                onClick={handleGetBusinessInfo}
                                disabled={stickyBusy || taxCode.trim().length === 0}
                                aria-busy={stickyBusy || undefined}
                                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Search className="size-4" />
                                {t("operation.inquire.get_business_info")}
                            </button>
                        </div>
                        {!hasResult && (
                            <p className="text-wb-12 font-medium text-wb-status-pending-text">
                                {t("operation.inquire.hint")}
                            </p>
                        )}
                    </div>

                    {/* Status + Last Update banner — appears only after a
                     *  successful lookup. Pill colour mirrors the table's
                     *  OperationStatusCell so the popup and the row read
                     *  identical (Figma 12346:109158 inquire popup). */}
                    {hasResult && statusCd && (
                        <div
                            className={cn(
                                "flex items-center justify-between rounded-md px-3 py-2.5",
                                statusBannerBg(statusCd),
                            )}
                        >
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1 text-wb-13 font-medium",
                                    statusTone(statusCd),
                                )}
                            >
                                {statusCd !== "unknown" &&
                                    (isActiveStatus(statusCd) ? (
                                        <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
                                    ) : (
                                        <CircleX aria-hidden className="size-[18px]" strokeWidth={2.5} />
                                    ))}
                                <span>
                                    {statusCd === "unknown"
                                        ? companyStatus
                                        : t(`operation.status.${statusCd}`)}
                                </span>
                            </span>
                            {searchDatetime && (
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-wb-12 font-medium text-wb-muted">
                                        {t("operation.inquire.last_update")}
                                    </span>
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {formatLastUpdate(searchDatetime, locale)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customer Name (read-only after lookup) */}
                    <div className="flex flex-col gap-2">
                        <label className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                            {t("operation.inquire.customer_name")}
                        </label>
                        <input
                            type="text"
                            value={companyName}
                            readOnly
                            className="flex h-8 rounded-md border border-wb-ntrl-4 bg-wb-ntrl-2 px-2 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
                        />
                    </div>

                    {/* Address (read-only after lookup) */}
                    <div className="flex flex-col gap-2">
                        <label className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                            {t("operation.inquire.address")}
                        </label>
                        <textarea
                            value={address}
                            readOnly
                            rows={3}
                            className="flex resize-none rounded-md border border-wb-ntrl-4 bg-wb-ntrl-2 px-2 py-2 text-wb-14 font-medium leading-5 text-wb-ntrl-8"
                        />
                    </div>
                </DialogBody>

                <DialogFooter className="border-t-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={stickyBusy}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {t("dialog.close")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave || stickyBusy}
                        aria-busy={stickyBusy || undefined}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-wb-ntrl-4 disabled:shadow-none"
                    >
                        {t("dialog.save")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
