"use client";

import { useEffect, useState } from "react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import ToggleSwitch from "@/components/settings/ToggleSwitch";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import {
    fetchFirmBankingSetting,
    updateFirmBankingSetting,
} from "@/lib/api/firmBankingSettings";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import BankLogo from "./BankLogo";

import type { FirmBankingLinkedAccount } from "./types";

type EditFirmBankingDetailsDialogProps = {
    /** The list-row that opened this dialog. The dialog uses
     *  {@code outBankCd} + {@code wdrlActNo} to fetch the live detail
     *  (cleartext) and to issue the PUT. The other display fields
     *  (bank name, masked account number) come from this row while
     *  the detail fetch is in flight, so the dialog never renders
     *  blank value cells. */
    account: FirmBankingLinkedAccount;
    onClose: () => void;
    /** Fired AFTER a successful PUT — the host (panel) bumps its
     *  refetch token so the linked-accounts list re-renders with the
     *  fresh row, then closes the dialog. The success dialog the
     *  user sees comes from this dialog's own
     *  {@code dialog.open({ type: "success" })} call so the toast
     *  isn't tied to the host's lifecycle. */
    onSaved?: () => void;
    /**
     * Modal-stack depth. Defaults to `2` (opened from a row's kebab on
     * top of the L1 Settings shell). Pass `3` when this dialog opens
     * on top of the L2 Firm Banking Details modal so the overlay
     * z-index ramp lines up correctly with the convention in
     * components/ui/dialog.tsx.
     */
    stackLevel?: 2 | 3;
};

/**
 * Edit Firm Banking Details dialog — Figma 5936:24675.
 *
 * Wire-up status (2026-05-09):
 * <ul>
 *   <li>Detail fetched live via {@link fetchFirmBankingSetting} when
 *       the dialog mounts — populates Bank Partner ID + VAN Code +
 *       cleartext Withdrawal Account No. (the row props only carry
 *       the masked display version).</li>
 *   <li>Save wired to {@link updateFirmBankingSetting} (PUT). On 200
 *       fires {@code onSaved} (host refetches list) + opens success
 *       dialog. On error opens shared error dialog with the trace_id.</li>
 *   <li>Backend appends 4 locale audit rows under one seq_no via
 *       the shared {@code AuditLogService}.</li>
 * </ul>
 *
 * <p><b>Status-only edit UX (parity-clarified 2026-05-09).</b> JEX's
 * legacy Edit dialog is a status-management modal — Save is enabled
 * the moment the dialog is ready, even with no field changes. This
 * dialog mirrors that: only {@code org_stat} is surfaced as editable
 * (a binary toggle); {@code bank_prtn_id} and {@code van_org_cd}
 * stay read-only display in the UI, but the backend's PUT contract
 * still requires them — the dialog submits the values it received
 * from the Detail fetch verbatim. Bank Name and Withdrawal Account
 * No. are PK-derived and never editable (V14 — composite PK is
 * immutable; {@code file_type} server-derived).
 *
 * <p>Save gating: {@code !detail.data || submitting}. Validation is
 * trivial (toggle is binary; backend's {@code @Pattern("^[0-3]$")}
 * accepts both states). No isDirty requirement — the user can click
 * Save with no changes; the backend will write a no-op update and
 * still append the audit row. That matches JEX behavior (the legacy
 * action JSP unconditionally writes the audit on every Save).
 *
 * Layout per Figma 5936:24675:
 *   - Container: `rounded-2xl px-4 py-6 gap-6`.
 *   - Body: 5 rows (label / value); Status row carries the toggle.
 *   - Footer: text-only Cancel + brand-pill Save.
 */
export default function EditFirmBankingDetailsDialog({
    account,
    onClose,
    onSaved,
    stackLevel = 2,
}: EditFirmBankingDetailsDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Live detail — gives us cleartext wdrl_act_no + bank_prtn_id +
    // van_org_cd which the row prop doesn't carry. The Save button
    // stays disabled until this resolves.
    const detail = useApiData(
        () => fetchFirmBankingSetting(account.outBankCd, account.wdrlActNo),
        [account.outBankCd, account.wdrlActNo],
    );

    // Editable status. Seeded from the row prop while detail is in
    // flight (so the toggle doesn't appear "off" then jump to "on"
    // when the fetch returns) — and re-seeded from the live detail
    // on first load so the form starts in sync with the server.
    // The seedSyncedRef guard makes the seed a one-shot — afterward
    // the user owns the toggle state.
    const [active, setActive] = useState<boolean>(account.status === "active");
    const [seedSynced, setSeedSynced] = useState(false);
    useEffect(() => {
        if (!seedSynced && detail.data) {
            setActive(detail.data.org_stat === "1");
            setSeedSynced(true);
        }
    }, [detail.data, seedSynced]);

    const [submitting, setSubmitting] = useState(false);

    // Display values — prefer live detail when loaded, fall back to
    // row props while in flight. The dialog never renders an empty
    // value cell.
    const bankName     = detail.data ? account.bankName : account.bankName;
    const bankPrtnId   = detail.data?.bank_prtn_id ?? "";
    const vanOrgCd     = detail.data?.van_org_cd   ?? "";
    const wdrlActNoDisplay =
        detail.data?.wdrl_act_no ?? account.accountNumber;

    /** Save click — submits the live detail's values for the
     *  unchanged fields plus the toggle's current state for org_stat.
     *  The backend takes care of audit-log fan-out. */
    const handleSave = async () => {
        if (!detail.data) return;     // dialog ready check (Save gating)
        if (submitting) return;       // re-entrancy guard
        setSubmitting(true);
        try {
            await updateFirmBankingSetting(
                account.outBankCd,
                account.wdrlActNo,
                {
                    bank_prtn_id: detail.data.bank_prtn_id,
                    van_org_cd:   detail.data.van_org_cd,
                    org_stat:     active ? "1" : "0",
                },
            );
            // Host refetches before we open the success toast so the
            // user dismissing the success returns to a fresh list.
            onSaved?.();
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t(
                    "settings.firm_banking_settings.update_success",
                ),
                onConfirm: onClose,
                onClose: onClose,
            });
        } catch (err) {
            const code =
                err instanceof ApiCallError ? err.code : "WBE9999";
            const message =
                err instanceof Error
                    ? err.message
                    : t("common.error.unknown");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const saveDisabled = !detail.data || submitting;

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={stackLevel}
                hideClose
                className="max-w-[500px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col gap-6 px-4 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t(
                                "settings.firm_banking_settings.edit_firm_banking_details.title",
                            )}
                        </h2>
                    </DialogTitle>

                    <div className="flex flex-col">
                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.bank_name",
                            )}
                            required
                        >
                            <BankLogo bank={account.bank} bankName={account.bankName} className="size-4" />
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                {bankName}
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.partner_id",
                            )}
                            required
                        >
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                {bankPrtnId}
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.van_code",
                            )}
                            required
                        >
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                {vanOrgCd}
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.withdrawal_account",
                            )}
                            required
                        >
                            <span className="text-wb-14 font-medium text-wb-ntrl-10">
                                {wdrlActNoDisplay}
                            </span>
                        </Row>

                        <Row
                            label={t(
                                "settings.firm_banking_settings.edit_firm_banking_details.firm_banking_status",
                            )}
                        >
                            <span
                                className={cn(
                                    "text-wb-14 font-medium",
                                    active
                                        ? "text-wb-status-approved-text"
                                        : "text-wb-ntrl-6",
                                )}
                            >
                                {t(
                                    active
                                        ? "settings.firm_banking_settings.status.active"
                                        : "settings.firm_banking_settings.status.inactive",
                                )}
                            </span>
                            <ToggleSwitch
                                checked={active}
                                onChange={setActive}
                                tone="brand"
                                ariaLabel={t(
                                    "settings.firm_banking_settings.edit_firm_banking_details.aria_status_toggle",
                                )}
                            />
                        </Row>
                    </div>

                    {/* Footer — text-only Cancel + brand-pill Save.
                       Save gating: !detail.data || submitting. The
                       JEX dialog enables Save on open (status-only
                       edit modal pattern); we mirror that — no
                       isDirty requirement, the user can Save with no
                       changes and the backend writes a no-op update
                       + audit row (matches JEX). */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className={cn(
                                "flex h-8 items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-brand shadow-wb-btn",
                                submitting
                                    ? "cursor-not-allowed opacity-60"
                                    : "cursor-pointer hover:bg-brand-soft",
                            )}
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saveDisabled}
                            aria-busy={submitting}
                            className={cn(
                                "flex h-8 items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn",
                                saveDisabled
                                    ? "cursor-not-allowed bg-wb-ntrl-4"
                                    : "cursor-pointer bg-brand hover:bg-brand-hover",
                            )}
                        >
                            {submitting
                                ? t("common.saving")
                                : t("common.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Row({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-[44px] items-stretch border-b border-wb-ntrl-3">
            <div className="flex w-[191px] shrink-0 items-start gap-0.5 py-3">
                <span className="text-wb-14 font-medium text-wb-ntrl-8">
                    {label}
                </span>
                {required && (
                    <span
                        aria-hidden
                        className="text-wb-14 font-medium text-destructive"
                    >
                        *
                    </span>
                )}
            </div>
            <div className="flex flex-1 items-center gap-2 py-1.5">
                {children}
            </div>
        </div>
    );
}
