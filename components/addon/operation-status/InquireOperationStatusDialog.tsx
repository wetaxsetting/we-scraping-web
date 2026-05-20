"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";

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
import { ApiCallError } from "@/lib/api/banking";
import { inquireOperationStatus } from "@/lib/api/addon";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Maps the canonical 3-state code into a Tailwind colour tone for the
 *  pill / check glyph — mirrors {@code OperationStatusCell} on the
 *  parent page so the popup pill and the table cell read identical. */
function statusTone(statusCd: string): string {
    if (statusCd === "active_certificate_issued") return "text-wb-status-approved-text";
    if (statusCd === "suspended") return "text-wb-status-pending-text";
    return "text-wb-muted";
}

/** Background tint for the status banner — pairs with the text tone
 *  from {@link statusTone}. Soft green for active, soft amber for
 *  suspended, soft neutral for not-registered. */
function statusBannerBg(statusCd: string): string {
    if (statusCd === "active_certificate_issued") return "bg-wb-status-approved-bg";
    if (statusCd === "suspended") return "bg-wb-status-pending-bg";
    return "bg-wb-bg-sidebar";
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

/** Format the GDT {@code yyyyMMddHHmmss} timestamp as
 *  {@code DD-MM-YYYY, HH:mm} (matches the Figma pill).
 *  Returns the raw value on parse failure so we never blank the row
 *  out — the user can still read the upstream string. */
function formatLastUpdate(raw: string | undefined): string {
    if (!raw) return "";
    const trimmed = raw.trim();
    if (!/^\d{14}$/.test(trimmed)) return trimmed;
    const year = trimmed.slice(0, 4);
    const month = trimmed.slice(4, 6);
    const day = trimmed.slice(6, 8);
    const hour = trimmed.slice(8, 10);
    const min = trimmed.slice(10, 12);
    return `${day}-${month}-${year}, ${hour}:${min}`;
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
 * (separate endpoint, deferred); Close discards.
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
    const { t } = useTranslation();
    const dialog = useDialog();

    const [taxCode, setTaxCode] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [address, setAddress] = useState("");
    const [statusCd, setStatusCd] = useState("");
    const [searchDatetime, setSearchDatetime] = useState("");
    const [busy, setBusy] = useState(false);
    const [hasResult, setHasResult] = useState(false);

    const reset = () => {
        setTaxCode("");
        setCompanyName("");
        setAddress("");
        setStatusCd("");
        setSearchDatetime("");
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
            setHasResult(true);
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const msg = err instanceof Error ? err.message : t("common.error.unknown");
            setCompanyName("");
            setAddress("");
            setStatusCd("");
            setSearchDatetime("");
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

    const handleSave = () => {
        // Save persists the inquired row. The dedicated upsert endpoint
        // is out of scope for this MR — refresh the list so the user
        // sees the newest server state (the bulk Update path is the
        // sanctioned way to write the cache for now).
        onSaved?.();
        handleClose();
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
                    <DialogTitle>{t("operation.inquire.title")}</DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("operation.inquire.title")}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-4">
                    {/* Tax ID + Get Business Info CTA */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-wb-13 font-medium text-wb-ntrl-8">
                            {t("operation.inquire.tax_id")}{" "}
                            <span className="text-wb-red-07">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={taxCode}
                                onChange={(e) => setTaxCode(formatTaxCodeInput(e.target.value))}
                                placeholder="0000000000-(000)"
                                maxLength={14}
                                inputMode="numeric"
                                disabled={busy}
                                className="flex h-9 flex-1 rounded-md border border-wb-border-sidebar bg-white px-3 text-wb-13 text-wb-ink placeholder:text-wb-ntrl-6 focus:outline-none focus:ring-2 focus:ring-brand/30"
                            />
                            <button
                                type="button"
                                onClick={handleGetBusinessInfo}
                                disabled={busy || taxCode.trim().length === 0}
                                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-wb-border-sidebar bg-white px-3 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Search className="size-4" />
                                {t("operation.inquire.get_business_info")}
                            </button>
                        </div>
                        {!hasResult && (
                            <p className="text-wb-12 font-medium text-[#d97706]">
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
                                <Check aria-hidden className="size-[18px]" strokeWidth={2.5} />
                                <span>{t(`operation.status.${statusCd}`)}</span>
                            </span>
                            {searchDatetime && (
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-wb-12 font-medium text-wb-muted">
                                        {t("operation.inquire.last_update")}
                                    </span>
                                    <span className="text-wb-13 font-medium text-wb-ink">
                                        {formatLastUpdate(searchDatetime)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customer Name (read-only after lookup) */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-wb-13 font-medium text-wb-ntrl-8">
                            {t("operation.inquire.customer_name")}
                        </label>
                        <input
                            type="text"
                            value={companyName}
                            readOnly
                            className="flex h-9 rounded-md border border-wb-border-sidebar bg-wb-bg-sidebar px-3 text-wb-13 text-wb-ink"
                        />
                    </div>

                    {/* Address (read-only after lookup) */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-wb-13 font-medium text-wb-ntrl-8">
                            {t("operation.inquire.address")}
                        </label>
                        <textarea
                            value={address}
                            readOnly
                            rows={3}
                            className="flex rounded-md border border-wb-border-sidebar bg-wb-bg-sidebar px-3 py-2 text-wb-13 text-wb-ink resize-none"
                        />
                    </div>
                </DialogBody>

                <DialogFooter>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                    >
                        {t("dialog.close")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                        className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-wb-ntrl-4 disabled:shadow-none"
                    >
                        {t("dialog.save")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
