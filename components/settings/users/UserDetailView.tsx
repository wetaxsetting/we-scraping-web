"use client";

import { ChevronDown } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { SettingsUser } from "./types";
import UserAvatarUpload from "./UserAvatarUpload";
import UserFormField from "./UserFormField";

type UserDetailViewProps = {
    user: SettingsUser;
};

/**
 * Read-only Info form for a selected user — Figma 142:23387.
 *
 * Two-column layout inside `p-6 gap-10`:
 *   · Left (flex-1): vertically stacked form fields plus a "Set as
 *                    admin" checkbox aligned to the right of Full Name.
 *   · Right (134 px shrink-0): circular avatar.
 *
 * All inputs are rendered in **disabled / view mode** — the bg flips to
 * `wb-bg-sidebar` (#f5f5f5), the value sits at `text-wb-ntrl-5`, and
 * the field carries `shadow-wb-outline` for the 1 px ring. The Edit
 * button on the panel header is the only affordance that flips out of
 * view mode (wired later — currently a no-op).
 *
 * Field label primitive (`<UserFormField>`) is shared with
 * `<AddUserInfoForm>` so both modes carry identical label typography
 * and required-asterisk colour.
 */
export default function UserDetailView({ user }: UserDetailViewProps) {
    const { t } = useTranslation();
    const isAdmin = user.role === "admin";
    return (
        <div className="custom-scrollbar-y flex min-h-0 flex-1 items-start justify-center gap-10 overflow-y-auto p-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
                {/* Row 1 — Full Name + Set-as-admin checkbox. The checkbox
                   column carries an opacity-0 label spacer so its checkbox
                   row sits on the same baseline as the Full Name input. */}
                <div className="flex w-full items-start gap-4">
                    <UserFormField
                        label={t("settings.users.field.full_name")}
                        required
                        className="min-w-0 flex-1"
                    >
                        <ReadOnlyTextField value={user.name} />
                    </UserFormField>

                    <div className="flex shrink-0 flex-col gap-2 self-stretch">
                        <span aria-hidden className="text-wb-14-tight font-medium text-wb-ntrl-8 opacity-0">
                            {t("settings.users.field.full_name")}
                        </span>
                        <label className="flex flex-1 items-center gap-2">
                            <Checkbox
                                checked={isAdmin}
                                disabled
                                aria-label={t("settings.users.field.set_as_admin")}
                            />
                            <span className="text-wb-14-tight font-medium text-wb-ntrl-6">
                                {t("settings.users.field.set_as_admin")}
                            </span>
                        </label>
                    </div>
                </div>

                <UserFormField
                    label={t("settings.users.field.position")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <ReadOnlyTextField value={user.position} />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.department")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <ReadOnlyTextField value={user.department} />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.telephone")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <div className="flex w-full items-stretch gap-px">
                        {/* Country code chip (disabled) — dial code only, no
                           flag / ISO label, matching the Edit-mode picker
                           (`PhoneCountryPicker`) and legacy JEX `comm_0190_003`. */}
                        <div className="flex h-8 w-[72px] cursor-default items-center gap-1 rounded-l-md bg-wb-bg-sidebar px-2 shadow-wb-outline">
                            <span className="flex-1 text-wb-14-tight font-medium text-wb-ntrl-6">
                                +{normalizeDial(user.phoneCountryCode)}
                            </span>
                            <ChevronDown className="size-4 text-wb-ntrl-6" strokeWidth={2} />
                        </div>
                        <ReadOnlyTextField
                            value={user.phoneNumber}
                            type="tel"
                            className="rounded-l-none rounded-r-md"
                        />
                    </div>
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.email")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <ReadOnlyTextField type="email" value={user.email} />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.id")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <ReadOnlyTextField value={user.loginId} />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.password")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <ReadOnlyTextField type="password" value="************" />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.confirm_password")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <ReadOnlyTextField type="password" value="************" />
                </UserFormField>
            </div>

            {/* Avatar — 134 × 134 portrait. Renders the uploaded photo
               (fetched via the JWT-protected streaming endpoint) when
               present, otherwise an initials disc. Edit interactions
               live in Edit mode only — readOnly here. */}
            <UserAvatarUpload user={user} readOnly />
        </div>
    );
}

type ReadOnlyTextFieldProps = {
    value: string;
    type?: "text" | "email" | "tel" | "password";
    className?: string;
};

function ReadOnlyTextField({ value, type = "text", className }: ReadOnlyTextFieldProps) {
    return (
        <input
            type={type}
            value={value}
            disabled
            readOnly
            className={cn(
                "h-8 w-full min-w-0 cursor-default rounded-md bg-wb-bg-sidebar px-2 text-wb-14-tight font-medium text-wb-ntrl-6 shadow-wb-outline outline-none",
                className,
            )}
        />
    );
}

/** Normalise a raw dial value to its significant digits so the legacy
 *  zero-padded `+0084` / `0084` form renders as the clean `84`, matching
 *  the Edit-mode `PhoneCountryPicker`. */
function normalizeDial(dial: string | undefined | null): string {
    const digits = (dial ?? "").replace(/\D/g, "");
    return digits.replace(/^0+/, "") || digits;
}
