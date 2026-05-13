"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { createBankCredential } from "@/lib/api/bankCredentials";
import { useTranslation } from "@/lib/i18n";

/**
 * "Add credential" dialog. The bank dropdown is intentionally narrow
 * (Vietcombank only) for the spike — extending this set means adding
 * the new NAPAS code + an NXISAS module name + getting a test login
 * for the bank. See plan §"Out of scope for the spike".
 */
type Props = {
    onClose: () => void;
    onCreated: () => Promise<void> | void;
};

const SUPPORTED_BANKS: Array<{ value: string; labelKey: string }> = [
    {
        value: "VCB",
        labelKey: "banking.credentials.bank.vcb",
    },
];

export function AddCredentialDialog({ onClose, onCreated }: Props) {
    const { t } = useTranslation();
    const [bankCd, setBankCd] = useState(SUPPORTED_BANKS[0].value);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            await createBankCredential({ bank_cd: bankCd, username, password });
            await onCreated();
        } catch (err) {
            if (err instanceof ApiCallError) setError(`[${err.code}] ${err.message}`);
            else if (err instanceof Error) setError(err.message);
            else setError(t("banking.credentials.unknown_error"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[480px]">
                <DialogTitle>
                    {t("banking.credentials.add_dialog.title")}
                </DialogTitle>
                <form className="space-y-4 mt-2" onSubmit={handleSubmit}>
                    <div className="space-y-1">
                        <label className="block text-section-title">
                            {t("banking.credentials.add_dialog.bank")}
                        </label>
                        <select
                            className="w-full h-9 rounded border border-gray-300 px-2 text-input"
                            value={bankCd}
                            onChange={(e) => setBankCd(e.target.value)}
                        >
                            {SUPPORTED_BANKS.map((b) => (
                                <option key={b.value} value={b.value}>
                                    {t(b.labelKey)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-section-title">
                            {t("banking.credentials.add_dialog.username")}
                        </label>
                        <input
                            type="text"
                            className="w-full h-9 rounded border border-gray-300 px-2 text-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="off"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-section-title">
                            {t("banking.credentials.add_dialog.password")}
                        </label>
                        <input
                            type="password"
                            className="w-full h-9 rounded border border-gray-300 px-2 text-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                        />
                    </div>
                    {error && (
                        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-body text-red-700">
                            {error}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            className="h-9 px-4 rounded border border-gray-300 text-button"
                            onClick={onClose}
                            disabled={submitting}
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="submit"
                            className="h-9 px-4 rounded bg-brand text-white text-button"
                            disabled={submitting}
                        >
                            {submitting
                                ? t("banking.credentials.add_dialog.saving")
                                : t("banking.credentials.add_dialog.save")}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
