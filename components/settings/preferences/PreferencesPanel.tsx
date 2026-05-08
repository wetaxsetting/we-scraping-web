"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import ToggleSwitch from "../ToggleSwitch";

import { COMPANY_FIELDS, TOGGLE_ROWS } from "./mockData";
import type { PreferencesCompanyField } from "./types";

/**
 * Preferences panel — Figma 142:17995 (read-only) + 154:24540 (edit mode).
 *
 * Two visual states share one shell:
 *   · Read mode  → field list with Edit button.
 *   · Edit mode  → 2-column form + Address textarea, logo grows a delete
 *                  button, header swaps Edit for Cancel/Save plus a
 *                  "Krong updated · 53 mins ago" audit indicator.
 *
 * Cancel/Save are no-ops in this static pass — both just flip back to
 * read mode. Wire the real PATCH once the Spring endpoint lands.
 */
export default function PreferencesPanel() {
    const [isEditing, setIsEditing] = useState(false);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <PreferencesHeader
                isEditing={isEditing}
                onEdit={() => setIsEditing(true)}
                onCancel={() => setIsEditing(false)}
                onSave={() => setIsEditing(false)}
            />

            {/* Scroll region — Company + Purpose/VAS sections stack and scroll
               together once the form grows past the modal height. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar h-full overflow-y-auto pr-1">
                    <div className="flex flex-col gap-8">
                        <CompanySection isEditing={isEditing} />
                        <PurposeVasSection isEditing={isEditing} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

function PreferencesHeader({
    isEditing,
    onEdit,
    onCancel,
    onSave,
}: {
    isEditing: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 px-8 pb-5 pt-[calc(var(--spacing)*14)]">
            <div className="min-w-0">
                <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                    {t("settings.preferences.title")}
                </h3>
                <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                    {t("settings.preferences.description")}
                </p>
            </div>

            {isEditing ? (
                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/5"
                    >
                        {t("settings.preferences.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {t("settings.preferences.save")}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/5"
                >
                    <Pencil className="size-4" strokeWidth={2} />
                    {t("settings.preferences.edit")}
                </button>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Company section — read or edit
// ─────────────────────────────────────────────────────────────

function CompanySection({ isEditing }: { isEditing: boolean }) {
    const { t } = useTranslation();
    return (
        <section className="flex flex-col gap-5">
            <div>
                <h4 className="text-wb-15 font-semibold tracking-wb-tight text-wb-ink">
                    {t("settings.preferences.company.title")}
                </h4>
                <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                    {t("settings.preferences.company.description")}
                </p>
            </div>

            <LogoBlock isEditing={isEditing} />

            {isEditing ? <CompanyEditForm /> : <CompanyFieldList />}
        </section>
    );
}

function LogoBlock({ isEditing }: { isEditing: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="flex w-full max-w-[401px] flex-col gap-2.5">
            <span className="text-wb-14 font-medium text-wb-ntrl-8">
                {t("settings.preferences.logo")}
            </span>
            {/* `relative` so the edit-mode delete button can sit absolutely at
               the bottom-right inside the cream container. */}
            <div className="relative flex h-[117px] w-full items-center justify-center rounded-[10px] border-2 border-wb-ntrl-3 bg-[#fefdf9]">
                <CompanyLogoPlaceholder />
                {isEditing && (
                    <button
                        type="button"
                        aria-label={t("settings.preferences.delete_logo")}
                        className="absolute bottom-3 right-3 flex size-9 cursor-pointer items-center justify-center rounded-full bg-white drop-shadow-[0_4px_7px_rgba(0,0,0,0.15)] hover:bg-black/5"
                    >
                        <Trash2 className="size-4 text-wb-red-07" strokeWidth={1.8} />
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Inline placeholder so the screen renders before the company record carries
 * a real logo URL. Mirrors the orange/red wordmark in Figma 142:18017
 * (VVABOOKS sample). Once the API provides `companyLogoUrl`, replace with
 * <img>.
 */
function CompanyLogoPlaceholder() {
    return (
        <div className="flex flex-col items-center justify-center leading-none">
            <span className="text-wb-28 font-extrabold text-wb-error">
                VVABOOKS
            </span>
            <span className="mt-1 text-wb-11 font-medium tracking-wide text-wb-error">
                Co., Ltd.
            </span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Read-mode field list (unchanged)
// ─────────────────────────────────────────────────────────────

function CompanyFieldList() {
    const { t } = useTranslation();
    return (
        <dl className="flex w-full flex-col">
            {COMPANY_FIELDS.map((field) => (
                <div
                    key={field.key}
                    className="flex items-start border-b border-wb-ntrl-3 py-3"
                >
                    <dt className="flex w-[191px] shrink-0 items-start gap-0.5 text-wb-14 font-medium text-wb-ntrl-8">
                        <span>{t(field.labelKey)}</span>
                        {field.required && (
                            <span aria-hidden className="text-wb-error">
                                *
                            </span>
                        )}
                    </dt>
                    <dd className="min-w-0 flex-1 text-wb-14 font-medium text-wb-dark">
                        {field.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

// ─────────────────────────────────────────────────────────────
// Edit-mode form
// ─────────────────────────────────────────────────────────────

function CompanyEditForm() {
    const fieldByKey = (key: PreferencesCompanyField["key"]) =>
        COMPANY_FIELDS.find((f) => f.key === key)!;

    const vietnameseName = fieldByKey("vietnamese_name");
    const displayName = fieldByKey("display_name");
    const taxId = fieldByKey("tax_id");
    const repEmail = fieldByKey("representative_email");
    const address = fieldByKey("address");

    return (
        // `pl-2` indents the form (labels + inputs) 8 px inside the Company
        // section so the input text — which carries its own 8 px internal
        // padding — visually aligns with the section title / Logo card edge.
        // Logo and section title intentionally stay flush left.
        <div className="flex w-full flex-col gap-3 pl-2">
            {/* Two-column row: Vietnamese Name + Tax ID. */}
            <div className="grid w-full grid-cols-2 items-start gap-3">
                <FormField label={vietnameseName.labelKey} required={vietnameseName.required}>
                    <TextInput defaultValue={vietnameseName.value} />
                </FormField>
                <FormField label={taxId.labelKey} required={taxId.required}>
                    <TextInput defaultValue={taxId.value} />
                </FormField>
            </div>

            {/* Two-column row: Display Name + Representative E-mail. */}
            <div className="grid w-full grid-cols-2 items-start gap-3">
                <FormField label={displayName.labelKey} required={displayName.required}>
                    <TextInput defaultValue={displayName.value} />
                </FormField>
                <FormField label={repEmail.labelKey} required={repEmail.required}>
                    <TextInput defaultValue={repEmail.value} type="email" />
                </FormField>
            </div>

            {/* Full-width address textarea. */}
            <FormField label={address.labelKey} required={address.required}>
                <AddressTextarea />
            </FormField>
        </div>
    );
}

function FormField({
    label,
    required,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <span className="flex items-start gap-0.5 text-wb-14-tight font-medium text-wb-ntrl-8">
                {t(label)}
                {required && (
                    <span aria-hidden className="text-wb-error">
                        *
                    </span>
                )}
            </span>
            {children}
        </div>
    );
}

function TextInput({
    defaultValue,
    type = "text",
}: {
    defaultValue?: string;
    type?: "text" | "email";
}) {
    return (
        <input
            type={type}
            defaultValue={defaultValue}
            className="h-8 w-full min-w-0 rounded-md bg-white px-2 text-wb-14-tight font-medium text-wb-ink shadow-wb-outline outline-none placeholder:text-wb-ntrl-5 focus-visible:shadow-wb-focus"
        />
    );
}

function AddressTextarea() {
    const { t } = useTranslation();
    return (
        <textarea
            placeholder={t("settings.preferences.placeholder.address")}
            className="h-[124px] w-full min-w-0 resize-y rounded-md bg-white px-2 pt-2 pb-4 text-wb-14 font-medium leading-[18px] text-wb-ink shadow-wb-outline outline-none placeholder:text-wb-ntrl-5 focus-visible:shadow-wb-focus"
        />
    );
}

// ─────────────────────────────────────────────────────────────
// Purpose & VAS toggles — reused in read & edit mode
// ─────────────────────────────────────────────────────────────

function PurposeVasSection({ isEditing }: { isEditing: boolean }) {
    const { t } = useTranslation();
    return (
        <section className="flex flex-col gap-2">
            <h4 className="text-wb-15 font-semibold tracking-wb-tight text-wb-ink">
                {t("settings.preferences.purpose_vas.title")}
            </h4>
            <div className="flex flex-col">
                {TOGGLE_ROWS.map((row, index) => {
                    const titleKey =
                        isEditing && row.editTitleKey ? row.editTitleKey : row.titleKey;
                    const descKey =
                        isEditing && row.editDescriptionKey
                            ? row.editDescriptionKey
                            : row.descriptionKey;
                    const isLast = index === TOGGLE_ROWS.length - 1;
                    return (
                        <div
                            key={row.key}
                            className={
                                isLast
                                    ? "flex items-center gap-5 py-3"
                                    : "flex items-center gap-5 border-b border-wb-border-sidebar py-3"
                            }
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-wb-13 font-medium text-wb-ink">
                                    {t(titleKey)}
                                </p>
                                <p className="mt-1 text-wb-13 font-medium text-wb-ntrl-6">
                                    {t(descKey)}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="text-wb-13 font-medium text-wb-ntrl-6">
                                    {row.enabled
                                        ? t("settings.preferences.toggle.on")
                                        : t("settings.preferences.toggle.off")}
                                </span>
                                <ToggleSwitch
                                    tone="brand"
                                    checked={row.enabled}
                                    ariaLabel={t(titleKey)}
                                    disabled={!isEditing}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
