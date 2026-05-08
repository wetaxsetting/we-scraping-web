"use client";

import { UploadCloud } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

/**
 * Dotted upload disc shown on the right side of the Add-user form —
 * Figma 142:17631.
 *
 * 134 × 134 circle with a dashed brand-blue border, a centred
 * cloud-up-arrow glyph, and two short copy lines ("Drag & drop" /
 * "or browse"). Static UI only — no drag handlers, no file input.
 * The "browse" word is brand-blue to flag it as the click affordance
 * once the upload pipeline lands.
 */
export default function UserAvatarUpload() {
    const { t } = useTranslation();
    return (
        <div
            className="flex size-[134px] shrink-0 flex-col items-center justify-center rounded-full border border-dashed border-brand bg-white text-center"
            aria-label={t("settings.users.upload.aria")}
        >
            <UploadCloud className="size-7 text-brand" strokeWidth={1.5} />
            <p className="mt-2 text-wb-13 font-medium leading-tight text-wb-ink">
                {t("settings.users.upload.drag_drop")}
            </p>
            <p className="text-wb-13 font-medium leading-tight text-wb-ink">
                {t("settings.users.upload.or")}{" "}
                <span className="cursor-pointer text-brand">
                    {t("settings.users.upload.browse")}
                </span>
            </p>
        </div>
    );
}
