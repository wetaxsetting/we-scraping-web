"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

type Props = {
    /** Base64-encoded image bytes from the bank adapter. Render as
     *  {@code data:image/{format};base64,{image}}. */
    image: string | null;
    /** Image MIME suffix — {@code "png"} for most banks, {@code "svg+xml"}
     *  for VIETNAM_GDT. Defaults to "png" when null. */
    format: string | null;
    onSubmit: (value: string) => Promise<void> | void;
    onCancel: () => void;
};

/**
 * CAPTCHA challenge dialog. Mirrors the legacy nxisas_v2.js:1537-1544
 * — shows the bank-supplied CAPTCHA image (PNG base64 for most
 * banks, SVG for VIETNAM_GDT) and collects the user's typed text.
 * Same wire shape as the OTP dialog ({@code {"value": "..."}}); the
 * Coocon job discriminator is {@code CAPTCHA}, set by the API path.
 */
export function CaptchaDialog({ image, format, onSubmit, onCancel }: Props) {
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

    const mime = format ?? "png";
    const dataUrl = image ? `data:image/${mime};base64,${image}` : null;

    return (
        <Dialog open onOpenChange={(open) => !open && !submitting && onCancel()}>
            <DialogContent
                stackLevel={4}
                aria-describedby={undefined}
                className="max-w-[420px]"
            >
                <DialogTitle>
                    {t("banking.credentials.captcha.title")}
                </DialogTitle>
                <form className="space-y-4 mt-2" onSubmit={handleSubmit}>
                    <p className="text-body text-gray-700">
                        {t("banking.credentials.captcha.prompt")}
                    </p>
                    {dataUrl ? (
                        <div className="flex justify-center bg-gray-50 border border-gray-200 rounded p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={dataUrl}
                                alt="CAPTCHA"
                                className="max-h-24 object-contain"
                            />
                        </div>
                    ) : (
                        <p className="text-body text-gray-500 italic">
                            {t("banking.credentials.captcha.no_image")}
                        </p>
                    )}
                    <input
                        type="text"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full h-10 rounded border border-gray-300 px-2 text-input tracking-widest text-center uppercase"
                        placeholder={t("banking.credentials.captcha.input_placeholder")}
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
                            className="h-9 px-4 rounded bg-brand text-white text-button disabled:bg-gray-300"
                            disabled={submitting || !value.trim() || !dataUrl}
                        >
                            {submitting
                                ? t("banking.credentials.captcha.submitting")
                                : t("banking.credentials.captcha.submit")}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
