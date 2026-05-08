"use client";

import { ChevronDown, Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "@/lib/i18n";

import EditableTextField from "./EditableTextField";
import UserAvatarUpload from "./UserAvatarUpload";
import UserFormField from "./UserFormField";

/**
 * Editable Info form for the "Add a user" mode — Figma 142:17631.
 *
 * Two-column layout (mirrors `<UserDetailView>`):
 *   · Left (flex-1): Full Name + Set-as-admin row, then Position,
 *     Department, Telephone, Email, ID + Check-availability,
 *     Password, Confirm password.
 *   · Right (134 px shrink-0): `<UserAvatarUpload>` dotted upload disc.
 *
 * Differences from the view-mode form:
 *   · Inputs are editable (white bg, `text-wb-ink`) instead of disabled
 *     (`wb-bg-sidebar`, `text-wb-ntrl-5`).
 *   · Adds two fields not present in view mode (Position, Department).
 *   · ID has a "Check availability" outline button on the right.
 *   · Set-as-admin checkbox is interactive (uncontrolled, defaults
 *     unchecked per Figma).
 *   · Password fields render `type="password"` for native masking
 *     instead of literal asterisks.
 *
 * Static UI: every input is uncontrolled — values are reset when the
 * panel unmounts (i.e. when the user clicks Cancel / a row / or
 * navigates away). Save is a no-op; the parent toolbar owns the
 * Cancel/Save buttons and just toggles `isAddingUser` for now.
 */
export default function AddUserInfoForm() {
    const { t } = useTranslation();
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
                            <Checkbox aria-label={t("settings.users.field.set_as_admin")} />
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
                        {/* Country code trigger — static UI button. The chevron
                           keeps the dropdown affordance visible until the real
                           country picker lands. */}
                        <button
                            type="button"
                            className="flex h-8 w-[85px] cursor-pointer items-center gap-1 rounded-l-md bg-white px-2 shadow-wb-outline"
                        >
                            <Search className="size-4 text-wb-ntrl-6" strokeWidth={1.8} />
                            <span className="flex-1 text-left text-wb-14-tight font-medium text-wb-ink">
                                +84
                            </span>
                            <ChevronDown className="size-4 text-wb-ntrl-6" strokeWidth={2} />
                        </button>
                        <EditableTextField
                            type="tel"
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
                        placeholder={t("settings.users.placeholder.email")}
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.id")}
                    required
                    className="w-full max-w-[464px]"
                >
                    <div className="flex items-stretch gap-2">
                        <EditableTextField
                            placeholder={t("settings.users.placeholder.id")}
                            className="min-w-0 flex-1"
                        />
                        <button
                            type="button"
                            className="flex h-8 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-dark shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("settings.users.check_availability")}
                        </button>
                    </div>
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
