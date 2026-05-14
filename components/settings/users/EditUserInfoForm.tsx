"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useDialog } from "@/components/shared/dialog";
import { useTranslation } from "@/lib/i18n";

import EditableTextField from "./EditableTextField";
import type { SettingsUser, UserFormDraft } from "./types";
import type { UserFormHandle } from "./useUserFormHandle";
import UserAvatarUpload from "./UserAvatarUpload";
import UserFormField from "./UserFormField";

type EditUserInfoFormProps = {
    user: SettingsUser;
};

/**
 * Editable Info form for an existing user (Edit mode) — Figma 5300:31189.
 *
 * Same layout + chrome as `<AddUserInfoForm>`, with two differences:
 *
 *   · `loginId` is rendered `disabled` and excluded from the
 *     collected draft (the URI path carries the immutable id).
 *   · Password + confirm-password are OPTIONAL. Empty = "keep
 *     existing hash". When the admin enters a value, both fields must
 *     match — same client-side check as Add.
 *
 * Save / Delete buttons live on the panel toolbar.
 */
const EditUserInfoForm = forwardRef<UserFormHandle, EditUserInfoFormProps>(
    function EditUserInfoForm({ user }, handleRef) {
        const { t } = useTranslation();
        const dialog = useDialog();
        const formRef = useRef<HTMLFormElement>(null);

        useImperativeHandle(handleRef, () => ({
            collect(): UserFormDraft | null {
                const form = formRef.current;
                if (!form) return null;
                const data = new FormData(form);
                const draft: UserFormDraft = {
                    fullName:    String(data.get("fullName")    ?? ""),
                    position:    String(data.get("position")    ?? ""),
                    department:  String(data.get("department")  ?? ""),
                    phoneCode:   String(data.get("phoneCode")   ?? "84"),
                    phoneNumber: String(data.get("phoneNumber") ?? ""),
                    email:       String(data.get("email")       ?? ""),
                    loginId:     user.loginId,
                    password:    String(data.get("password")    ?? ""),
                    setAsAdmin:  data.get("setAsAdmin") === "on",
                };
                const confirm = String(data.get("confirmPassword") ?? "");
                // Password is optional on edit, but if the admin entered
                // one, the confirm has to match.
                if (draft.password.length > 0 && draft.password !== confirm) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t("settings.users.error.confirm_mismatch"),
                    });
                    return null;
                }
                return draft;
            },
        }));

        const isAdmin = user.role === "admin";

        return (
            <form
                ref={formRef}
                onSubmit={(e) => e.preventDefault()}
                className="custom-scrollbar-y flex min-h-0 flex-1 items-start justify-center gap-10 overflow-y-auto p-6"
            >
                <div className="flex min-w-0 flex-1 flex-col gap-6">
                    {/* Row 1 — Full Name + Set-as-admin checkbox. */}
                    <div className="flex w-full items-start gap-4">
                        <UserFormField
                            label={t("settings.users.field.full_name")}
                            required
                            className="min-w-0 flex-1"
                        >
                            <EditableTextField
                                name="fullName"
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
                                    name="setAsAdmin"
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
                            name="position"
                            defaultValue={user.position}
                            placeholder={t("settings.users.placeholder.position")}
                        />
                    </UserFormField>

                    <UserFormField
                        label={t("settings.users.field.department")}
                        required
                        className="w-full max-w-[354px]"
                    >
                        <EditableTextField
                            name="department"
                            defaultValue={user.department}
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
                            <input type="hidden" name="phoneCode" value={user.phoneCountryCode} />
                            <EditableTextField
                                name="phoneNumber"
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
                            name="email"
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
                           per Figma 5300:31189. Not in FormData (no name) — the
                           parent uses the existing `user.loginId`. */}
                        <EditableTextField
                            defaultValue={user.loginId}
                            placeholder={t("settings.users.placeholder.id")}
                            disabled
                        />
                    </UserFormField>

                    <UserFormField
                        label={t("settings.users.field.password")}
                        className="w-full max-w-[354px]"
                    >
                        <EditableTextField
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            placeholder={t("settings.users.placeholder.password_optional")}
                        />
                    </UserFormField>

                    <UserFormField
                        label={t("settings.users.field.confirm_password")}
                        className="w-full max-w-[354px]"
                    >
                        <EditableTextField
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            placeholder={t("settings.users.placeholder.password_optional")}
                        />
                    </UserFormField>
                </div>

                <UserAvatarUpload />
            </form>
        );
    },
);

export default EditUserInfoForm;
