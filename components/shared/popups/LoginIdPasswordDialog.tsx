"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
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
import { BANK_CD_TO_LOGO_PATH, BANK_CD_TO_HERO_LOGO_PATH } from "./selectBankBanks";

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

    // Labels — always sourced from the in-app locale files, matching
    // the legacy `comm_0218_nxisas.funcRenderUI` behaviour. The
    // bank-supplied `id_label` / `password_label` / `confirm_label`
    // from `BANK_INFM_DETL` (codes 13/16/19) hold vestigial Vietnamese
    // strings that the live JEX UI does NOT consume — it uses
    // `comm_0218_nxisas_ml{007,009,011}` instead and overlays
    // bank-specific overrides (e.g. SC Bank's "Group ID") via ML on
    // top. Mirror that here so the dialog renders EN/KO/VI/KM
    // consistently regardless of which bank rows happen to carry
    // form-info data.
    const idLabel = t("settings.login_credentials.add_form.label.id");
    const passwordLabel = t("settings.login_credentials.add_form.label.password");
    const confirmLabel = t("settings.login_credentials.add_form.label.confirm_password");
    // `extra_label` (Coocon code 22) stays bank-supplied — it's the
    // Corporate-ID / Group-ID sub-field name that only some banks
    // render, with no JEX ML equivalent.
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

    // Resolve the dialog's hero logo. The server-supplied
    // `logo_url` (from BANK_INFM_DETL.BANK_DETL_INFO_CD='12') points
    // at login-form-overlay guidance graphics that render as broken
    // thumbnails inside the modal — confirmed by Sonny 2026-05-15
    // against the legacy live dev.wecms.vn output. The desired asset
    // is the curated bank brand wordmark/monogram under
    // /banklogo/icon/ (mirrors `banking_VN/icon/bank logo {nm}1.png`
    // from the legacy comm_0218_search_bank picker). Use the
    // bank_cd-keyed map as the source of truth; fall back to the
    // server logo_url (with {LANG_CODE} substituted) only when the
    // brand-icon map has no entry for the bank.
    const resolvedLogoUrl = useMemo(() => {
        if (bankCd) {
            // Prefer the curated brand wordmark; fall back to the
            // small picker icon when no hero asset is registered.
            const hero =
                BANK_CD_TO_HERO_LOGO_PATH[bankCd] ?? BANK_CD_TO_LOGO_PATH[bankCd];
            if (hero) return hero;
        }
        if (!activeSubType?.logo_url) return null;
        const code = mapLocaleToLangCode(locale);
        return activeSubType.logo_url.replace("{LANG_CODE}", code);
    }, [bankCd, activeSubType, locale]);

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
                className="max-w-[440px] overflow-hidden rounded-2xl"
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

                    {/* Indeterminate progress strip — sits BELOW the
                       title + subtitle, ABOVE the logo + form body.
                       Mirrors legacy comm_0218_nxisas_view.jsp:109's
                       #container-percent which appears directly under
                       the `<h1>` title block. Renders only while a
                       scrape is in flight (`loginDisabled === true`).
                       The negative horizontal margins span the strip
                       edge-to-edge inside the parent's `p-6` so it
                       reads as a full-width band, matching the legacy
                       layout. Animation keyframes live globally in
                       app/globals.css (`wb-login-sweep`). */}
                    {loginDisabled && (
                        <div
                            aria-hidden
                            className="pointer-events-none relative -mx-6 h-1.5 overflow-hidden bg-[rgba(231,233,253,1)]"
                        >
                            <span className="absolute inset-0 block animate-wb-login-sweep bg-[linear-gradient(to_right,rgba(15,31,234,1)_0%,rgba(116,202,241,0.8)_50%,rgba(15,31,234,1)_100%)] bg-[length:200%_100%]" />
                        </div>
                    )}

                    {/* Body — bank logo + optional radios + form fields. */}
                    <div className="flex flex-col items-center gap-6">
                        {/* Server-supplied logo wins over caller-supplied
                           bankLogo when both are present. Falls back to
                           the caller logo when the bank has no logo path
                           (or the form-info fetch is still in flight). */}
                        {resolvedLogoUrl ? (
                            <HeroBankLogo
                                key={resolvedLogoUrl}
                                src={resolvedLogoUrl}
                                bankName={bankName}
                                fallback={bankLogo}
                            />
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
                                    readOnly={loginDisabled === true}
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
                                readOnly={loginDisabled === true}
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
                                readOnly={loginDisabled === true}
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
                                readOnly={loginDisabled === true}
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
                       Login RIGHT. Choose-another-bank + Cancel are
                       disabled while the scrape is in flight (legacy
                       funcToggleUIState parity) so the user can't tear
                       down a half-completed verification. */}
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onChooseAnotherBank}
                            disabled={loginDisabled === true}
                            aria-disabled={loginDisabled === true}
                            className={
                                loginDisabled === true
                                    ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-5 shadow-wb-btn opacity-60"
                                    : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
                            }
                        >
                            {t("settings.login_credentials.add_form.choose_another_bank")}
                        </button>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={loginDisabled === true}
                                aria-disabled={loginDisabled === true}
                                className={
                                    loginDisabled === true
                                        ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-5 shadow-wb-btn opacity-60"
                                        : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                                }
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

/**
 * Hero brand mark above the login form. Mirrors the graceful-degradation
 * contract the other two logo consumers already honour — `BankLogoMark`
 * (bank picker) and `BankBrandLogo` (Settings > Bank Account) both swap to
 * a non-image fallback on load failure. Without it a missing/renamed PNG
 * renders the browser's broken-image glyph inside the dialog.
 *
 * <p>Callers pass {@code key={src}} so switching banks remounts this and
 * clears a previous bank's error state.
 */
function HeroBankLogo({
    src,
    bankName,
    fallback,
}: {
    src: string;
    bankName: string;
    fallback?: ReactNode;
}) {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return fallback ? (
            <div className="flex items-center justify-center" aria-label={bankName}>
                {fallback}
            </div>
        ) : null;
    }

    return (
        <div className="flex items-center justify-center" aria-label={bankName}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={bankName}
                onError={() => setFailed(true)}
                className="max-h-12 max-w-[200px] object-contain"
            />
        </div>
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
    /** When true, the input is read-only and the field is tinted to
     *  match the legacy {@code funcToggleUIState(false)} "locked while
     *  scrape in flight" state. */
    readOnly?: boolean;
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
    readOnly,
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
            <div
                className={
                    readOnly
                        ? "flex items-center gap-1 rounded-md border border-wb-ntrl-4 bg-wb-ntrl-2 p-2"
                        : "flex items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white p-2"
                }
            >
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
                    readOnly={readOnly}
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
 * Per-bank Login Type dropdown. Used by ABBANK + Vietcom Personal
 * flow. Renders as a custom popdown (not a native `<select>`) so the
 * open-state list matches the legacy comm_0218_search_bank popdown
 * UX (Figma 1797:20561 + the live dev.wecms.vn ABBANK login screen):
 * one option per row, no native chrome, flat caret button on the
 * trigger, list opens directly below the trigger with the same width.
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
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Resolve labels once so the trigger + every list row share the
    // same lookup logic. Missing translations fall back to the legacy
    // English default (matches the legacy ML system's behaviour).
    const resolveLabel = (opt: LoginTypeOption): string => {
        const resolved = t(opt.labelKey);
        return resolved === opt.labelKey ? opt.defaultLabel : resolved;
    };

    const selected =
        options.find((o) => o.value === value) ?? options[0] ?? null;
    const selectedLabel = selected ? resolveLabel(selected) : "";

    // Close the popdown when the user clicks outside (or presses ESC
    // via the keydown handler below). The dialog itself owns ESC for
    // dismissing the whole dialog; the popdown only intercepts ESC
    // when it's open so the user can collapse the list without losing
    // the dialog context.
    useEffect(() => {
        if (!open) return;
        const handlePointerDown = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (containerRef.current.contains(e.target as Node)) return;
            setOpen(false);
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKey, true);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKey, true);
        };
    }, [open]);

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

            <div ref={containerRef} className="relative">
                <button
                    id={inputId}
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className="flex w-full items-center gap-1 rounded-md border border-wb-ntrl-4 bg-white p-2 text-left"
                >
                    <span aria-hidden className="flex size-4 shrink-0 items-center justify-center text-wb-ntrl-6">
                        <User className="size-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                        {selectedLabel}
                    </span>
                    {/* Caret — points down when closed, up when open. */}
                    <span
                        aria-hidden
                        className="flex size-4 shrink-0 items-center justify-center text-wb-ntrl-6"
                    >
                        <svg
                            viewBox="0 0 12 12"
                            className={
                                open
                                    ? "size-3 rotate-180 transition-transform"
                                    : "size-3 transition-transform"
                            }
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polyline points="2 4 6 8 10 4" />
                        </svg>
                    </span>
                </button>

                {open && (
                    <ul
                        role="listbox"
                        aria-label={label}
                        className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_2px_0px_rgba(0,0,0,0.1),0px_6px_20px_0px_rgba(0,0,0,0.1)]"
                    >
                        {options.map((opt) => {
                            const optLabel = resolveLabel(opt);
                            const isSelected = opt.value === (selected?.value ?? "");
                            return (
                                <li key={opt.value || "default"} role="option" aria-selected={isSelected}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(opt.value);
                                            setOpen(false);
                                        }}
                                        className={
                                            "flex w-full cursor-pointer items-center px-3 py-2 text-left text-wb-14 font-medium leading-4 text-wb-ntrl-8 hover:bg-wb-bg-sidebar " +
                                            (isSelected ? "bg-wb-bg-sidebar" : "bg-white")
                                        }
                                    >
                                        {optLabel}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
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
