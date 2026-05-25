"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { ApiCallError } from "@/lib/api/banking";
import { checkLoginId } from "@/lib/api/userManagement";
import { useDialog } from "@/components/shared/dialog";
import { useTranslation } from "@/lib/i18n";

import EditableTextField from "./EditableTextField";
import PhoneCountryPicker from "./PhoneCountryPicker";
import type { UserFormDraft } from "./types";
import type { UserFormHandle } from "./useUserFormHandle";
import UserAvatarUpload from "./UserAvatarUpload";
import UserFormField from "./UserFormField";

/**
 * Editable Info form for the "Add a user" mode — Figma 142:17631.
 *
 * Wraps the input grid in a real `<form>` so the parent panel can
 * call `collect()` (via the imperative handle) to read every field
 * with one `FormData` pass at Save time. The form stays uncontrolled
 * — defaultValues only, no per-keystroke state.
 *
 * <p>Save / Cancel buttons live in the panel toolbar; this component
 * only knows how to render and read.
 *
 * <p>Password / confirm-password are validated client-side before
 * the parent fires the API call:
 *   · both must be non-empty
 *   · both must match
 *
 * Length + non-alphanumeric checks live on the backend
 * (`UserCreateRequest` bean validation) — surfacing those as toast
 * errors is fine; pre-empting them on the frontend just duplicates
 * the rule.
 */
const AddUserInfoForm = forwardRef<UserFormHandle>(function AddUserInfoForm(
    _props,
    handleRef,
) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const formRef = useRef<HTMLFormElement>(null);
    const [checking, setChecking] = useState(false);

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
                loginId:     String(data.get("loginId")     ?? ""),
                password:    String(data.get("password")    ?? ""),
                setAsAdmin:  data.get("setAsAdmin") === "on",
            };

            const confirm = String(data.get("confirmPassword") ?? "");
            if (draft.password.length === 0) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.users.error.password_required"),
                });
                return null;
            }
            if (draft.password !== confirm) {
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

    async function onCheckLoginId() {
        const form = formRef.current;
        if (!form) return;
        const loginId = String(new FormData(form).get("loginId") ?? "").trim();
        if (loginId.length === 0) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.users.error.id_required"),
            });
            return;
        }
        setChecking(true);
        try {
            const { available } = await checkLoginId(loginId);
            dialog.open({
                type: available ? "success" : "error",
                title: available ? t("dialog.success") : t("dialog.error"),
                description: available
                    ? t("settings.users.check_id.available")
                    : t("settings.users.check_id.taken"),
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "NETWORK";
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: err instanceof Error ? err.message : "Unknown error",
                errorCode: code,
            });
        } finally {
            setChecking(false);
        }
    }

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
                        placeholder={t("settings.users.placeholder.department")}
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.telephone")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <div className="flex w-full items-stretch gap-px">
                        <PhoneCountryPicker name="phoneCode" defaultValue="84" />
                        <EditableTextField
                            name="phoneNumber"
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
                        name="email"
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
                            name="loginId"
                            placeholder={t("settings.users.placeholder.id")}
                            className="min-w-0 flex-1"
                        />
                        <button
                            type="button"
                            onClick={onCheckLoginId}
                            disabled={checking}
                            className="flex h-8 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-dark shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
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
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t("settings.users.placeholder.password")}
                    />
                </UserFormField>

                <UserFormField
                    label={t("settings.users.field.confirm_password")}
                    required
                    className="w-full max-w-[354px]"
                >
                    <EditableTextField
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t("settings.users.placeholder.password")}
                    />
                </UserFormField>
            </div>

            <UserAvatarUpload />
        </form>
    );
});

export default AddUserInfoForm;
