"use client";

import { ChevronDown, Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";

import EditableTextField from "./EditableTextField";
import type { SettingsUser } from "./types";
import UserAvatarUpload from "./UserAvatarUpload";
import UserFormField from "./UserFormField";

type EditUserInfoFormProps = {
    user: SettingsUser;
};

/**
 * Editable Info form for an existing user (Edit mode) — Figma 5300:31189.
 *
 * Mirrors `<AddUserInfoForm>` field-for-field (Full Name + Set-as-admin
 * row, Position, Department, Telephone, Email, ID + Check-availability,
 * Password, Confirm password) so both modes share the same layout,
 * spacing, input chrome, and required-asterisk vocabulary.
 *
 * Differences from `<AddUserInfoForm>`:
 *   · Inputs render with `defaultValue` populated from `user` (Full
 *     Name, country code, phone number, email, login id) — uncontrolled
 *     so the form resets via component unmount when the user clicks
 *     Cancel / a different row / etc.
 *   · The login `ID` field is `disabled` — the immutable login key
 *     can't be changed after creation (matches Figma 5300:31189 + the
 *     general WeCMS contract). Password fields stay editable so an
 *     admin can rotate them.
 *   · "Set as admin" defaults to `checked` for admin users.
 *   · Avatar slot uses `<UserAvatarEditable>` (portrait + delete
 *     button) instead of the upload-disc affordance.
 *
 * Save / Delete are no-ops in this static pass — the parent toolbar
 * owns those buttons and just toggles `isEditing` for now.
 */
export default function EditUserInfoForm({ user }: EditUserInfoFormProps) {
    const { t } = useTranslation();
    const isAdmin = user.role === "admin";
    return (
        <div className="custom-scrollbar-y flex min-h-0 flex-1 items-start justify-center gap-10 overflow-y-auto p-6">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
                {/* Row 1 — Full Name + Set-as-admin checkbox. */}
                <div className="flex w-full items-start gap-4">
                    <UserFormField
                        label={t("settings.users.field.full_name")}
                        required
                        className="min-w-0 flex-1"
                    >
                        <EditableTextField
                            defaultValue={user.name}
                            placeholder={t("settings.users.placeholder.full_name")}
                            leadingIcon={
                                <Search
                                    className="size-4 shrink-0 text-wb-ntrl-6"
                                    strokeWidth={1.8}
                                />
                            }
                        />
                    </UserFormField>

                    <div className="flex shrink-0 flex-col gap-2 self-stretch">
                        <span aria-hidden className="text-wb-14-tight font-medium text-wb-ntrl-8 opacity-0">
                            {t("settings.users.field.full_name")}
                        </span>
                        <label className="flex flex-1 items-center gap-2">
                            <Checkbox
                                defaultChecked={isAdmin}
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
                    <EditableTextField
                        placeholder={t("settings.users.placeholder.position")}
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.department")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <EditableTextField
                        placeholder={t("settings.users.placeholder.department")}
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.telephone")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <div className="flex w-full items-stretch gap-px">
                        <button
                            type="button"
                            className="flex h-8 w-[85px] cursor-pointer items-center gap-1 rounded-l-md bg-white px-2 shadow-wb-outline"
                        >
                            <Search className="size-4 text-wb-ntrl-6" strokeWidth={1.8} />
                            <span className="flex-1 text-left text-wb-14-tight font-medium text-wb-ink">
                                +{user.phoneCountryCode}
                            </span>
                            <ChevronDown className="size-4 text-wb-ntrl-6" strokeWidth={2} />
                        </button>
                        <EditableTextField
                            type="tel"
                            defaultValue={user.phoneNumber}
                            placeholder={t("settings.users.placeholder.phone")}
                            className="rounded-l-none rounded-r-md"
                        />
                    </div>
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.email")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <EditableTextField
                        type="email"
                        defaultValue={user.email}
                        placeholder={t("settings.users.placeholder.email")}
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.id")}
                    required
                    className="w-full max-w-[354px]"
                >
                    {/* ID is the immutable login key — disabled in edit mode
                       per Figma 5300:31189. */}
                    <EditableTextField
                        defaultValue={user.loginId}
                        placeholder={t("settings.users.placeholder.id")}
                        disabled
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.password")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <EditableTextField
                        type="password"
                        placeholder={t("settings.users.placeholder.password")}
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.confirm_password")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <EditableTextField
                        type="password"
                        placeholder={t("settings.users.placeholder.password")}
                    />
                </UserFormField>
            </div>

            <UserAvatarUpload />
        </div>
    );
}
