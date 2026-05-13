"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

type Props = {
    prompt: string | null;
    onSubmit: (value: string) => Promise<void> | void;
    onCancel: () => void;
};

/**
 * OTP entry dialog. The {@code prompt} comes verbatim from the NXISAS
 * gateway (e.g. "Please enter the OTP sent to your registered phone")
 * — the gateway already localises in some adapters, so the frontend
 * surfaces it as-is rather than translating.
 */
export function OtpDialog({ prompt, onSubmit, onCancel }: Props) {
    const { t } = useTranslation();
    const [value, setValue] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit(value.trim());
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onCancel()}>
            <DialogContent className="max-w-[420px]">
                <DialogTitle>
                    {t("banking.credentials.otp.title")}
                </DialogTitle>
                <form className="space-y-4 mt-2" onSubmit={handleSubmit}>
                    {prompt && <p className="text-body text-gray-700">{prompt}</p>}
                    <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        className="w-full h-10 rounded border border-gray-300 px-2 text-input tracking-widest text-center"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        disabled={submitting}
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            className="h-9 px-4 rounded border border-gray-300 text-button"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="submit"
                            className="h-9 px-4 rounded bg-brand text-white text-button"
                            disabled={submitting || !value.trim()}
                        >
                            {submitting
                                ? t("banking.credentials.otp.submitting")
                                : t("banking.credentials.otp.submit")}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
