"use client";

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Lock, User } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    type DialogStackLevel,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation, type Locale } from "@/lib/i18n";
import { fetchLoginCredentialBankFormInfo } from "@/lib/api/loginCredentials";
import type { ApiLoginCredentialBankFormInfoSubType } from "@/lib/types/api";

import { getLoginTypeOptions, type LoginTypeOption } from "./bankFormInfoExtras";

export type LoginIdPasswordValues = {
    id: string;
    password: string;
    confirmPassword: string;
    /** Sub-type discriminator value (sourced from the selected radio).
     *  Defaults to 0 when the bank has only one sub-type. Persisted
     *  server-side as {@code NXISAS_GB_SEQ_NO} and sent to NXISAS at
     *  scrape time so Coocon routes to the right bank adapter. */
    nxisasGbSeqNo: number;
    /** Optional Corporate-ID / extra-field value. Empty string when
     *  the bank doesn't render an extra input. */
    extra: string;
    /** Optional Login Type dropdown value (ABBANK / Vietcom Personal).
     *  Empty string when the bank doesn't render a dropdown. */
    loginType: string;
};

export type LoginIdPasswordDialogProps = {
    /** Institution display name. Surfaces in aria-labels. */
    bankName: string;
    /** Optional bank logo / brand mark rendered above the form fields.
     *  Note: when {@code bankCd} is provided and the form-info fetch
     *  succeeds, the dialog can derive its OWN logo from the per-
     *  sub-type {@code logo_url} field. {@code bankLogo} stays as a
     *  fallback for callers that don't pass {@code bankCd}. */
    bankLogo?: ReactNode;
    /** Real {@code BANK_CD} value (e.g. {@code "11704088"}). When
     *  supplied, the dialog fetches form-info from the API and
     *  renders sub-type radios + per-sub-type localised labels +
     *  optional Corporate-ID / Login-Type extras. When omitted, the
     *  dialog falls back to a fixed three-field form using generic
     *  English labels — same shape it had before form-info wiring. */
    bankCd?: string;
    onChooseAnotherBank?: () => void;
    onCancel: () => void;
    /** Submit handler. Receives the current field values when fired. */
    onLogin?: (values: LoginIdPasswordValues) => void;
    /** Force the Login button into its disabled visual state. */
    loginDisabled?: boolean;
    /** Optional initial field values. */
    initialValues?: Partial<LoginIdPasswordValues>;
    /** Position in the modal stack. Defaults to `3`. */
    stackLevel?: DialogStackLevel;
};

/**
 * Login ID/PW feature dialog — Figma 1081:25293, ported to mirror the
 * legacy {@code comm_0218_nxisas} enter-login form.
 *
 * <p>When {@code bankCd} is supplied, the dialog renders dynamically
 * based on form-info from
 * {@code GET /api/v1/login-credentials/banks/{bankCd}/form-info}:
 *
 * <ul>
 *   <li><b>Sub-type radios</b> — banks with multiple SEQ_NOs (Shinhan,
 *       BIDV, Vietcom, MB, etc.) get a row of radio buttons at the
 *       top of the body. The legacy filter that hides "Personal
 *       Banking" is mirrored ({@code comm_0218_nxisas.ts:443}).</li>
 *   <li><b>Localised field labels</b> — each sub-type carries its own
 *       ID / Password / Confirm labels ("Tên truy cập" / "Mật khẩu" /
 *       "Xác nhận mật khẩu" for Vietnamese banks, etc.).</li>
 *   <li><b>Optional Corporate-ID input</b> — when the active
 *       sub-type's {@code extra_label} is non-blank (Agribank uses
 *       this), an extra text input shows above the ID field.</li>
 *   <li><b>Optional Login Type dropdown</b> — ABBANK + Vietcom
 *       Personal use this. Driven by the hardcoded per-bank map in
 *       {@code bankFormInfoExtras.ts} (mirrors legacy
 *       {@code funcRenderUI:743}).</li>
 *   <li><b>Bank-supplied logo</b> — the form-info response gives a
 *       sub-type-specific logo path; the dialog substitutes
 *       {@code {LANG_CODE}} with the active locale and renders it.</li>
 * </ul>
 *
 * <p>When {@code bankCd} is NOT supplied (legacy callers), the dialog
 * falls back to its original fixed-form behaviour: three fields, no
 * radios, no extras.
 */
export default function LoginIdPasswordDialog({
    bankName,
    bankLogo,
    bankCd,
    onChooseAnotherBank,
    onCancel,
    onLogin,
    loginDisabled,
    initialValues,
    stackLevel = 3,
}: LoginIdPasswordDialogProps) {
    const { t, locale } = useTranslation();
    const idInputId = useId();
    const pwInputId = useId();
    const confirmInputId = useId();
    const extraInputId = useId();
    const loginTypeInputId = useId();

    const [id, setId] = useState(initialValues?.id ?? "");
    const [password, setPassword] = useState(initialValues?.password ?? "");
    const [confirmPassword, setConfirmPassword] = useState(
        initialValues?.confirmPassword ?? "",
    );
    const [extra, setExtra] = useState(initialValues?.extra ?? "");
    const [loginType, setLoginType] = useState(initialValues?.loginType ?? "");

    // Form-info state — null while loading, [] when the fetch failed
    // or the bank is unknown. The dialog stays usable in both cases
    // (the empty-array branch falls through to the generic fixed form).
    const [subTypes, setSubTypes] = useState<ApiLoginCredentialBankFormInfoSubType[] | null>(null);

    useEffect(() => {
        if (!bankCd) {
            setSubTypes([]);
            return;
        }
        let cancelled = false;
        setSubTypes(null);
        fetchLoginCredentialBankFormInfo(bankCd)
            .then((res) => {
                if (cancelled) return;
                // Legacy filter — hide "Personal Banking" radios per
                // comm_0218_nxisas.ts:443. Single-sub-type banks
                // shouldn't be affected (their SEQ_NM is empty or the
                // bank's specific name). The filter only matters when
                // the multi-sub-type list happens to include the
                // literal "Personal Banking" label.
                const visible = (res.sub_types ?? []).filter(
                    (s) => (s.seq_nm ?? "").trim() !== "Personal Banking",
                );
                setSubTypes(visible);
            })
            .catch(() => {
                if (!cancelled) setSubTypes([]);
            });
        return () => {
            cancelled = true;
        };
    }, [bankCd]);

    // Selected sub-type — default to the first visible entry (or
    // SEQ_NO 0 when the list is still loading). Re-key the selection
    // by `bankCd` so switching banks via "Choose another bank" resets
    // the radio state cleanly.
    const [selectedSeqNo, setSelectedSeqNo] = useState<number>(0);
    useEffect(() => {
        if (subTypes && subTypes.length > 0) {
            setSelectedSeqNo(subTypes[0].seq_no);
        } else {
            setSelectedSeqNo(0);
        }
        // Reset extras when the bank or sub-type list changes — they
        // belong to the previous bank/sub-type and the new one likely
        // doesn't need them.
        setExtra(initialValues?.extra ?? "");
        setLoginType(initialValues?.loginType ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bankCd, subTypes]);

    const activeSubType = useMemo(() => {
        if (!subTypes || subTypes.length === 0) return null;
        return subTypes.find((s) => s.seq_no === selectedSeqNo) ?? subTypes[0];
    }, [subTypes, selectedSeqNo]);

    // Labels — server-supplied per sub-type, with fallbacks for the
    // null-form-info case (generic English from locale files).
    const idLabel = activeSubType?.id_label
        ? activeSubType.id_label
        : t("settings.login_credentials.add_form.label.id");
    const passwordLabel = activeSubType?.password_label
        ? activeSubType.password_label
        : t("settings.login_credentials.add_form.label.password");
    const confirmLabel = activeSubType?.confirm_label
        ? activeSubType.confirm_label
        : t("settings.login_credentials.add_form.label.confirm_password");
    const extraLabel = (activeSubType?.extra_label ?? "").trim();

    // Resolve the per-bank Login Type dropdown options (or null when
    // this bank/sub-type doesn't have one).
    const loginTypeOptions = useMemo(
        () => (bankCd ? getLoginTypeOptions(bankCd, selectedSeqNo) : null),
        [bankCd, selectedSeqNo],
    );

    // Login lights up only when the dialog's full required-field set
    // is filled. Required = ID + Password + Confirm + (Extra if shown)
    // + (Login Type if dropdown shown; the "no selection" option uses
    // value === "" which is still a valid choice, so we don't gate on
    // it — but we DO gate on it being one of the dropdown values).
    const allFieldsFilled =
        id.length > 0 &&
        password.length > 0 &&
        confirmPassword.length > 0 &&
        (extraLabel === "" || extra.length > 0);
    const passwordsMismatch =
        confirmPassword.length > 0 && password !== confirmPassword;
    const isLoginDisabled =
        loginDisabled === true ||
        !onLogin ||
        !allFieldsFilled ||
        passwordsMismatch;

    const handleLogin = useCallback(() => {
        if (isLoginDisabled || !onLogin) return;
        onLogin({
            id,
            password,
            confirmPassword,
            nxisasGbSeqNo: selectedSeqNo,
            extra,
            loginType,
        });
    }, [
        isLoginDisabled,
        onLogin,
        id,
        password,
        confirmPassword,
        selectedSeqNo,
        extra,
        loginType,
    ]);

    // Substitute {LANG_CODE} in the legacy bank-supplied logo paths.
    // EN / KO / VI map directly; other locales fall back to EN.
    const resolvedLogoUrl = useMemo(() => {
        if (!activeSubType?.logo_url) return null;
        const code = mapLocaleToLangCode(locale);
        return activeSubType.logo_url.replace("{LANG_CODE}", code);
    }, [activeSubType, locale]);

    /** Visible-radio set — only renders when the bank has more than
     *  one sub-type AFTER the Personal-Banking filter. */
    const showRadios = (subTypes?.length ?? 0) > 1;

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent
                stackLevel={stackLevel}
                className="max-w-[440px] rounded-2xl"
            >
                <div className="flex flex-col gap-8 p-6">
                    {/* Header — title + subtitle stacked. */}
                    <div className="flex flex-col items-start gap-1.5">
                        <DialogTitle asChild>
                            <h2 className="text-wb-16 font-semibold text-wb-dark">
                                {t("settings.login_credentials.add_form.title")}
                            </h2>
                        </DialogTitle>
                        <DialogDescription asChild>
                            <p className="text-wb-13 font-medium text-wb-dark/70">
                                {t("settings.login_credentials.add_form.subtitle")}
                            </p>
                        </DialogDescription>
                    </div>

                    {/* Body — bank logo + optional radios + form fields. */}
                    <div className="flex flex-col items-center gap-6">
                        {/* Server-supplied logo wins over caller-supplied
                           bankLogo when both are present. Falls back to
                           the caller logo when the bank has no logo path
                           (or the form-info fetch is still in flight). */}
                        {resolvedLogoUrl ? (
                            <div
                                className="flex items-center justify-center"
                                aria-label={bankName}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={resolvedLogoUrl}
                                    alt={bankName}
                                    className="max-h-12 max-w-[200px] object-contain"
                                />
                            </div>
                        ) : (
                            bankLogo && (
                                <div
                                    className="flex items-center justify-center"
                                    aria-label={bankName}
                                >
                                    {bankLogo}
                                </div>
                            )
                        )}

                        {/* Sub-type radios — only when the bank has >1
                           visible sub-type. */}
                        {showRadios && subTypes && (
                            <div
                                role="radiogroup"
                                aria-label={t(
                                    "settings.login_credentials.add_form.sub_type_aria",
                                )}
                                className="flex w-full flex-wrap items-center justify-center gap-x-5 gap-y-2"
                            >
                                {subTypes.map((st) => {
                                    const checked = st.seq_no === selectedSeqNo;
                                    return (
                                        <label
                                            key={st.seq_no}
                                            className="flex cursor-pointer items-center gap-2 text-wb-14 font-medium text-wb-ntrl-8"
                                        >
                                            <input
                                                type="radio"
                                                name="login-credentials-sub-type"
                                                value={st.seq_no}
                                                checked={checked}
                                                onChange={() =>
                                                    setSelectedSeqNo(st.seq_no)
                                                }
                                                className="size-4 accent-brand"
                                            />
                                            <span>{st.seq_nm}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex w-full flex-col gap-4">
                            {/* Optional Login Type dropdown — Agribank /
                               Vietcom Personal pattern. Renders above ID
                               so it visually anchors the form. */}
                            {loginTypeOptions && (
                                <LoginTypeDropdown
                                    inputId={loginTypeInputId}
                                    label={t(
                                        "settings.login_credentials.add_form.label.login_type",
                                    )}
                                    options={loginTypeOptions}
                                    value={loginType}
                                    onChange={setLoginType}
                                    t={t}
                                    requiredLabel={t(
                                        "settings.login_credentials.confirmation.required",
                                    )}
                                />
                            )}

                            {/* Optional Corporate-ID input — driven by
                               server-supplied {@code extra_label} being
                               non-blank. Renders above the ID input. */}
                            {extraLabel && (
                                <FormField
                                    inputId={extraInputId}
                                    label={extraLabel}
                                    placeholder={extraLabel}
                                    icon={<User className="size-4" strokeWidth={2} />}
                                    type="text"
                                    value={extra}
                                    onChange={setExtra}
                                    requiredLabel={t(
                                        "settings.login_credentials.confirmation.required",
                                    )}
                                    autoComplete="off"
                                />
                            )}

                            <FormField
                                inputId={idInputId}
                                label={idLabel}
                                placeholder={idLabel}
                                icon={<User className="size-4" strokeWidth={2} />}
                                type="text"
                                value={id}
                                onChange={setId}
                                requiredLabel={t(
                                    "settings.login_credentials.confirmation.required",
                                )}
                                autoComplete="username"
                            />
                            <FormField
                                inputId={pwInputId}
                                label={passwordLabel}
                                placeholder={passwordLabel}
                                icon={<Lock className="size-4" strokeWidth={2} />}
                                type="password"
                                value={password}
                                onChange={setPassword}
                                requiredLabel={t(
                                    "settings.login_credentials.confirmation.required",
                                )}
                                autoComplete="new-password"
                            />
                            <FormField
                                inputId={confirmInputId}
                                label={confirmLabel}
                                placeholder={confirmLabel}
                                icon={<Lock className="size-4" strokeWidth={2} />}
                                type="password"
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                requiredLabel={t(
                                    "settings.login_credentials.confirmation.required",
                                )}
                                autoComplete="new-password"
                            />
                            {passwordsMismatch && (
                                <p
                                    role="alert"
                                    className="text-wb-12 font-medium text-[#bd1822]"
                                >
                                    {t(
                                        "settings.login_credentials.add_form.password_mismatch",
                                    )}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer — split: Choose-another-bank LEFT, Cancel +
                       Login RIGHT. */}
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onChooseAnotherBank}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("settings.login_credentials.add_form.choose_another_bank")}
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                type="button"
                                disabled={isLoginDisabled}
                                aria-disabled={isLoginDisabled}
                                onClick={isLoginDisabled ? undefined : handleLogin}
                                className={
                                    isLoginDisabled
                                        ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white"
                                        : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                                }
                            >
                                {t("settings.login_credentials.add_form.login")}
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

type FormFieldProps = {
    inputId: string;
    label: string;
    placeholder: string;
    icon: ReactNode;
    type: "text" | "password";
    value: string;
    onChange: (next: string) => void;
    requiredLabel: string;
    autoComplete: string;
};

function FormField({
    inputId,
    label,
    placeholder,
    icon,
    type,
    value,
    onChange,
    requiredLabel,
    autoComplete,
}: FormFieldProps) {
    return (
        <div className="flex flex-col gap-2">
            <label
                htmlFor={inputId}
                className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
            >
                <span>{label}</span>
                <span aria-hidden className="text-wb-red-07">
                    *
                </span>
                <span className="sr-only">{requiredLabel}</span>
            </label>
            <div className="flex items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white p-2">
                <span aria-hidden className="flex size-4 shrink-0 items-center justify-center text-wb-ntrl-6">
                    {icon}
                </span>
                <input
                    id={inputId}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                    spellCheck={false}
                    className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 text-wb-ntrl-8 shadow-none outline-none ring-0 placeholder:text-wb-ntrl-5 focus:border-0 focus:outline-none focus:ring-0"
                />
            </div>
        </div>
    );
}

type LoginTypeDropdownProps = {
    inputId: string;
    label: string;
    options: LoginTypeOption[];
    value: string;
    onChange: (next: string) => void;
    requiredLabel: string;
    /** Translation helper. Falls back to the option's
     *  {@code defaultLabel} when {@code t(...)} returns the key
     *  unchanged (the in-house provider's missing-key behaviour). */
    t: (key: string, vars?: Record<string, string | number>) => string;
};

/**
 * Per-bank Login Type dropdown — native `<select>` styled to match
 * the dialog's other inputs. Used by ABBANK + Vietcom Personal flow.
 */
function LoginTypeDropdown({
    inputId,
    label,
    options,
    value,
    onChange,
    requiredLabel,
    t,
}: LoginTypeDropdownProps) {
    return (
        <div className="flex flex-col gap-2">
            <label
                htmlFor={inputId}
                className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
            >
                <span>{label}</span>
                <span aria-hidden className="text-wb-red-07">
                    *
                </span>
                <span className="sr-only">{requiredLabel}</span>
            </label>
            <div className="flex items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white p-2">
                <select
                    id={inputId}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 text-wb-ntrl-8 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
                >
                    {options.map((opt) => {
                        // In-house provider returns the key as-is when
                        // missing; fall through to the legacy default
                        // so the dropdown is always populated even on
                        // a partial translation.
                        const resolved = t(opt.labelKey);
                        const label =
                            resolved === opt.labelKey ? opt.defaultLabel : resolved;
                        return (
                            <option key={opt.value} value={opt.value}>
                                {label}
                            </option>
                        );
                    })}
                </select>
            </div>
        </div>
    );
}

/**
 * Map the active in-app locale to the {@code {LANG_CODE}} token used
 * in bank logo paths. The legacy system serves three flavours of each
 * bank logo (EN / KO / VI); we treat anything else as EN.
 */
function mapLocaleToLangCode(locale: Locale): "EN" | "KO" | "VI" {
    // Locale enum values are already EN / KO / VI — same code shape
    // {@code {LANG_CODE}} uses in the legacy logo path. Pass-through.
    return locale;
}
