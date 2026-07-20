"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, UploadCloud } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { useStickyLoading } from "@/hooks/useStickyLoading";
import { ApiCallError } from "@/lib/api/banking";
import {
    ENV_USE_PURPOSE_CD,
    ENV_USE_VAS_ACCOUNT_CD,
    fetchEnvironmentSetting,
    updateEnvironmentSetting,
} from "@/lib/api/environmentSettings";
import { useApiData } from "@/lib/api/useApiData";
import {
    deletePreferencesLogo,
    fetchPreferences,
    fetchPreferencesLogoBlob,
    updatePreferences,
    uploadPreferencesLogo,
} from "@/lib/api/preferences";
import { useTranslation } from "@/lib/i18n";
import type {
    ApiPreferencesResponse,
    ApiPreferencesUpdateRequest,
} from "@/lib/types/api";

import ToggleSwitch from "../ToggleSwitch";

import type { PreferencesToggleKey } from "./types";

/** Client-side mirror of the backend allow-list — keeps a doomed
 *  upload from making the round-trip. Backend rejects the same set
 *  via {@code WBE2087}. */
const ALLOWED_LOGO_MIME_TYPES: ReadonlySet<string> = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/svg+xml",
]);

/** Client-side mirror of the backend 2 MB cap (WBE2086). */
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * Preferences panel — Figma 142:17995 (read) + 154:24540 (edit).
 *
 * Wired to:
 *   - GET / PUT /api/v1/settings/preferences          (BUSI_INFM half)
 *   - GET / PUT /api/v1/settings/environment-settings/{00077|00074}
 *
 * The two toggle rows fire per-code env-setting PUTs on click (legacy
 * comm_0215_001.ts:466/516 pattern). The company-profile form runs in
 * read mode by default; Edit swaps the field list for inputs, Save
 * fires the PUT and flips back to read mode, Cancel discards the
 * draft.
 */
export default function PreferencesPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState<DraftState | null>(null);
    const [saving, setSaving] = useState(false);
    const [logoBusy, setLogoBusy] = useState(false);
    // Bump to re-fetch after a successful Save so the read-mode field
    // list reflects the persisted values without a full page reload.
    const [refreshKey, setRefreshKey] = useState(0);

    const profile = useApiData(
        () => fetchPreferences(),
        [refreshKey],
    );

    /* Smooth the loading + saving + logo-busy indicators so a fast
     * cached PUT / GET doesn't flicker the button-disabled state and
     * the "Loading…" placeholder on/off. */
    const stickyProfileLoading = useStickyLoading(profile.loading);
    const stickySaving = useStickyLoading(saving);
    const stickyLogoBusy = useStickyLoading(logoBusy);

    // Object URL for the JWT-authenticated logo blob. Re-fetched when
    // `logo_url` flips (which it does on every upload thanks to the
    // server-side cache-busting `?v=<filename>` suffix). Revoked on
    // unmount / re-fetch so we don't leak blob handles.
    const logoUrl = profile.data?.logo_url ?? null;
    const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!logoUrl) {
            setLogoObjectUrl(null);
            return;
        }
        let cancelled = false;
        let currentUrl: string | null = null;
        fetchPreferencesLogoBlob()
            .then((blob) => {
                if (cancelled) return;
                if (!blob) {
                    setLogoObjectUrl(null);
                    return;
                }
                currentUrl = URL.createObjectURL(blob);
                setLogoObjectUrl(currentUrl);
            })
            .catch(() => {
                if (!cancelled) setLogoObjectUrl(null);
            });
        return () => {
            cancelled = true;
            if (currentUrl) URL.revokeObjectURL(currentUrl);
        };
    }, [logoUrl]);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const onPickLogo = () => {
        if (!isEditing || logoBusy) return;
        fileInputRef.current?.click();
    };

    const submitLogoFile = async (file: File) => {
        if (file.size === 0) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.preferences.error.logo_empty"),
            });
            return;
        }
        if (file.size > MAX_LOGO_SIZE_BYTES) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.preferences.error.logo_too_large"),
            });
            return;
        }
        if (!ALLOWED_LOGO_MIME_TYPES.has(file.type)) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.preferences.error.logo_type"),
            });
            return;
        }
        setLogoBusy(true);
        try {
            await uploadPreferencesLogo(file);
            setRefreshKey((n) => n + 1);
        } catch (err) {
            const apiErr = err instanceof ApiCallError ? err : null;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: apiErr?.message ?? String(err),
                errorCode: apiErr?.code,
            });
        } finally {
            setLogoBusy(false);
        }
    };

    const onLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Reset the input so the user can re-pick the same filename.
        if (e.target) e.target.value = "";
        if (!file) return;
        await submitLogoFile(file);
    };

    const onLogoFileDropped = (file: File) => {
        if (!isEditing || logoBusy) return;
        void submitLogoFile(file);
    };

    const onDeleteLogo = async () => {
        if (!isEditing || logoBusy) return;
        setLogoBusy(true);
        try {
            await deletePreferencesLogo();
            setRefreshKey((n) => n + 1);
        } catch (err) {
            const apiErr = err instanceof ApiCallError ? err : null;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: apiErr?.message ?? String(err),
                errorCode: apiErr?.code,
            });
        } finally {
            setLogoBusy(false);
        }
    };

    // The two toggle states are loaded independently and stored as
    // local booleans so flipping one cannot transiently re-render the
    // other as OFF while a refetch is in flight. Mount-only fetch —
    // we never re-pull these from the server after the initial load;
    // every successful flip already returns the persisted value and
    // we mirror it locally.
    const [usePurpose, setUsePurpose] = useState<boolean | null>(null);
    const [useVas, setUseVas] = useState<boolean | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetchEnvironmentSetting(ENV_USE_PURPOSE_CD)
            .then((r) => { if (!cancelled) setUsePurpose(r.env_set_cont === "Y"); })
            .catch(() => { if (!cancelled) setUsePurpose(false); });
        fetchEnvironmentSetting(ENV_USE_VAS_ACCOUNT_CD)
            .then((r) => { if (!cancelled) setUseVas(r.env_set_cont === "Y"); })
            .catch(() => { if (!cancelled) setUseVas(false); });
        return () => { cancelled = true; };
    }, []);

    const onEdit = () => {
        if (!profile.data) return;
        setDraft(toDraft(profile.data));
        setIsEditing(true);
    };

    const onCancel = () => {
        setDraft(null);
        setIsEditing(false);
    };

    const onSave = async () => {
        if (!draft) return;
        const validation = validateDraft(draft, t);
        if (validation) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: validation,
            });
            return;
        }
        setSaving(true);
        try {
            await updatePreferences(toRequest(draft));
            setSaving(false);
            setIsEditing(false);
            setDraft(null);
            setRefreshKey((n) => n + 1);
        } catch (err) {
            setSaving(false);
            const apiErr = err instanceof ApiCallError ? err : null;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: apiErr?.message ?? String(err),
                errorCode: apiErr?.code,
            });
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <PreferencesHeader
                isEditing={isEditing}
                saving={stickySaving}
                disabled={!profile.data}
                onEdit={onEdit}
                onCancel={onCancel}
                onSave={onSave}
            />

            {/* Hidden file input for the logo picker — the cream card
               acts as its visible click target in edit mode. */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/svg+xml"
                className="sr-only"
                onChange={onLogoFileChange}
            />

            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar h-full overflow-y-auto pr-1">
                    <div className="flex flex-col gap-8">
                        <CompanySection
                            isEditing={isEditing}
                            data={profile.data}
                            loading={stickyProfileLoading}
                            draft={draft}
                            onDraftChange={setDraft}
                            logoObjectUrl={logoObjectUrl}
                            logoBusy={stickyLogoBusy}
                            onPickLogo={onPickLogo}
                            onDeleteLogo={onDeleteLogo}
                            onLogoFileDropped={onLogoFileDropped}
                        />
                        <PurposeVasSection
                            isEditing={isEditing}
                            usePurpose={usePurpose ?? false}
                            useVas={useVas ?? false}
                            onTogglePurpose={async (next) => {
                                await toggleEnv(
                                    ENV_USE_PURPOSE_CD,
                                    next,
                                    dialog,
                                    t,
                                    () => setUsePurpose(next),
                                );
                            }}
                            onToggleVas={async (next) => {
                                await toggleEnv(
                                    ENV_USE_VAS_ACCOUNT_CD,
                                    next,
                                    dialog,
                                    t,
                                    () => setUseVas(next),
                                );
                            }}
                        />
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
    saving,
    disabled,
    onEdit,
    onCancel,
    onSave,
}: {
    isEditing: boolean;
    saving: boolean;
    disabled: boolean;
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
                        disabled={saving}
                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("settings.preferences.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={saving}
                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t("settings.preferences.save")}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onEdit}
                    disabled={disabled}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Pencil className="size-4" strokeWidth={2} />
                    {t("settings.preferences.edit")}
                </button>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Company section
// ─────────────────────────────────────────────────────────────

function CompanySection({
    isEditing,
    data,
    loading,
    draft,
    onDraftChange,
    logoObjectUrl,
    logoBusy,
    onPickLogo,
    onDeleteLogo,
    onLogoFileDropped,
}: {
    isEditing: boolean;
    data: ApiPreferencesResponse | null;
    loading: boolean;
    draft: DraftState | null;
    onDraftChange: (d: DraftState) => void;
    logoObjectUrl: string | null;
    logoBusy: boolean;
    onPickLogo: () => void;
    onDeleteLogo: () => void;
    onLogoFileDropped: (file: File) => void;
}) {
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

            <LogoBlock
                isEditing={isEditing}
                logoObjectUrl={logoObjectUrl}
                hasLogo={Boolean(data?.logo_url)}
                logoBusy={logoBusy}
                onPickLogo={onPickLogo}
                onDeleteLogo={onDeleteLogo}
                onFileDropped={onLogoFileDropped}
            />

            {isEditing && draft ? (
                <CompanyEditForm draft={draft} onChange={onDraftChange} />
            ) : (
                <CompanyFieldList data={data} loading={loading} />
            )}
        </section>
    );
}

/**
 * Three visual states matched against Figma:
 *
 * 1. **Logo present** — render the image, edit-mode adds the red trash
 *    button. Solid card outline, never dashed.
 * 2. **Empty + view mode** — soft blue card with the {@code <ImageOff/>}
 *    icon + "No Image" label. Decorative, not clickable.
 * 3. **Empty + edit mode** — soft blue card with a dashed brand-blue
 *    border, the {@code <UploadCloud/>} icon, and "Drag & drop or
 *    browse to upload". Whole card is clickable + accepts dropped
 *    files.
 */
function LogoBlock({
    isEditing,
    logoObjectUrl,
    hasLogo,
    logoBusy,
    onPickLogo,
    onDeleteLogo,
    onFileDropped,
}: {
    isEditing: boolean;
    logoObjectUrl: string | null;
    hasLogo: boolean;
    logoBusy: boolean;
    onPickLogo: () => void;
    onDeleteLogo: () => void;
    onFileDropped: (file: File) => void;
}) {
    const { t } = useTranslation();
    const [dragOver, setDragOver] = useState(false);

    // The card is the picker affordance in edit mode (whether or not
    // a logo is already set). In view mode it stays decorative.
    const cardInteractive = isEditing && !logoBusy;

    // Border + background switch with state. Empty-state cards use the
    // brand-soft blue per Figma; the populated logo container keeps the
    // neutral cream so the image reads cleanly.
    const cardBaseClass =
        "relative flex h-[117px] w-full items-center justify-center rounded-[10px] outline-none";
    const cardEmptyClass = isEditing
        ? "border-2 border-dashed " +
          (dragOver ? "border-brand bg-brand-soft" : "border-wb-ntrl-3 bg-brand-soft")
        : "border-2 border-wb-ntrl-3 bg-brand-soft";
    const cardPopulatedClass = "border-2 border-wb-ntrl-3 bg-[#fefdf9]";
    const cardInteractiveClass = cardInteractive
        ? "cursor-pointer hover:border-brand focus-visible:border-brand"
        : "";

    return (
        <div className="flex w-full max-w-[401px] flex-col gap-2.5">
            <span className="text-wb-14 font-medium text-wb-ntrl-8">
                {t("settings.preferences.logo")}
            </span>
            <div
                role={cardInteractive ? "button" : undefined}
                tabIndex={cardInteractive ? 0 : -1}
                aria-label={cardInteractive ? t("settings.preferences.pick_logo") : undefined}
                onClick={cardInteractive ? onPickLogo : undefined}
                onKeyDown={
                    cardInteractive
                        ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  onPickLogo();
                              }
                          }
                        : undefined
                }
                // Drag-and-drop is only meaningful in edit mode. Calling
                // preventDefault on dragOver is what makes the element
                // a valid drop target.
                onDragOver={
                    cardInteractive
                        ? (e) => {
                              e.preventDefault();
                              if (!dragOver) setDragOver(true);
                          }
                        : undefined
                }
                onDragLeave={cardInteractive ? () => setDragOver(false) : undefined}
                onDrop={
                    cardInteractive
                        ? (e) => {
                              e.preventDefault();
                              setDragOver(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) onFileDropped(file);
                          }
                        : undefined
                }
                className={
                    cardBaseClass +
                    " " +
                    (logoObjectUrl ? cardPopulatedClass : cardEmptyClass) +
                    " " +
                    cardInteractiveClass
                }
            >
                {logoObjectUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={logoObjectUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                    />
                ) : isEditing ? (
                    <EmptyLogoEditState />
                ) : (
                    <EmptyLogoViewState />
                )}
                {isEditing && hasLogo && (
                    <button
                        type="button"
                        disabled={logoBusy}
                        aria-label={t("settings.preferences.delete_logo")}
                        // Stop the parent card click so the trash button
                        // doesn't simultaneously open the file picker.
                        onClick={(e) => {
                            e.stopPropagation();
                            onDeleteLogo();
                        }}
                        className="absolute bottom-3 right-3 flex size-9 cursor-pointer items-center justify-center rounded-full bg-white drop-shadow-[0_4px_7px_rgba(0,0,0,0.15)] hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash2 className="size-4 text-wb-red-07" strokeWidth={1.8} />
                    </button>
                )}
            </div>
        </div>
    );
}

function EmptyLogoViewState() {
    const { t } = useTranslation();
    // Legacy parity (pymn_0009_001 Preferences): the empty logo box shows
    // only the centered "No Image" label — no broken-image icon. The card
    // itself already centers this content.
    return (
        <span className="text-wb-13 font-medium text-wb-ntrl-6">
            {t("settings.preferences.empty_logo")}
        </span>
    );
}

function EmptyLogoEditState() {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center gap-2 text-wb-ntrl-6">
            <UploadCloud className="size-7" strokeWidth={1.5} />
            <span className="text-wb-13 font-medium">
                {/* Mid-sentence "browse" highlight matches Figma — a
                   plain text token, not an inline action, since the
                   whole card is the click target. */}
                {t("settings.preferences.upload_prompt.before")}{" "}
                <span className="text-brand">
                    {t("settings.preferences.upload_prompt.browse")}
                </span>{" "}
                {t("settings.preferences.upload_prompt.after")}
            </span>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Read-mode field list
// ─────────────────────────────────────────────────────────────

type ReadField = {
    key: "vietnamese_name" | "display_name" | "tax_id" | "representative_email" | "address";
    labelKey: string;
    value: string;
    required: boolean;
};

function CompanyFieldList({
    data,
    loading,
}: {
    data: ApiPreferencesResponse | null;
    loading: boolean;
}) {
    const { t } = useTranslation();
    const fields: ReadField[] = useMemo(() => {
        if (!data) return [];
        return [
            {
                key: "vietnamese_name",
                labelKey: "settings.preferences.field.vietnamese_name",
                value: data.vietnamese_name,
                required: true,
            },
            {
                key: "display_name",
                labelKey: "settings.preferences.field.display_name",
                value: data.display_name ?? "",
                required: false,
            },
            {
                key: "tax_id",
                labelKey: "settings.preferences.field.tax_id",
                value: data.tax_id,
                required: true,
            },
            {
                key: "representative_email",
                labelKey: "settings.preferences.field.representative_email",
                value: data.representative_email,
                required: true,
            },
            {
                key: "address",
                labelKey: "settings.preferences.field.address",
                value: composeAddress(data),
                required: true,
            },
        ];
    }, [data]);

    if (loading || !data) {
        return (
            <p className="py-3 text-wb-14 font-medium text-wb-muted">
                {t("common.loading")}
            </p>
        );
    }

    return (
        <dl className="flex w-full flex-col">
            {fields.map((field) => (
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

function CompanyEditForm({
    draft,
    onChange,
}: {
    draft: DraftState;
    onChange: (d: DraftState) => void;
}) {
    return (
        <div className="flex w-full flex-col gap-3 pl-2">
            <div className="grid w-full grid-cols-2 items-start gap-3">
                <FormField labelKey="settings.preferences.field.vietnamese_name" required>
                    <TextInput
                        value={draft.vietnameseName}
                        onChange={(v) => onChange({ ...draft, vietnameseName: v })}
                    />
                </FormField>
                <FormField labelKey="settings.preferences.field.tax_id" required>
                    <TextInput
                        value={draft.taxId}
                        onChange={(v) => onChange({ ...draft, taxId: v })}
                    />
                </FormField>
            </div>

            <div className="grid w-full grid-cols-2 items-start gap-3">
                <FormField labelKey="settings.preferences.field.display_name">
                    <TextInput
                        value={draft.displayName}
                        onChange={(v) => onChange({ ...draft, displayName: v })}
                    />
                </FormField>
                <FormField labelKey="settings.preferences.field.representative_email" required>
                    <TextInput
                        type="email"
                        value={draft.representativeEmail}
                        onChange={(v) => onChange({ ...draft, representativeEmail: v })}
                    />
                </FormField>
            </div>

            <FormField labelKey="settings.preferences.field.address" required>
                <AddressTextarea
                    value={draft.addressPost}
                    onChange={(v) => onChange({ ...draft, addressPost: v })}
                />
            </FormField>
        </div>
    );
}

function FormField({
    labelKey,
    required,
    children,
}: {
    labelKey: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <span className="flex items-start gap-0.5 text-wb-14-tight font-medium text-wb-ntrl-8">
                {t(labelKey)}
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
    value,
    onChange,
    type = "text",
}: {
    value: string;
    onChange: (v: string) => void;
    type?: "text" | "email";
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-full min-w-0 rounded-md bg-white px-2 text-wb-14-tight font-medium text-wb-ink shadow-wb-outline outline-none placeholder:text-wb-ntrl-5 focus-visible:shadow-wb-focus"
        />
    );
}

function AddressTextarea({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("settings.preferences.placeholder.address")}
            className="h-[124px] w-full min-w-0 resize-y rounded-md bg-white px-2 pt-2 pb-4 text-wb-14 font-medium leading-[18px] text-wb-ink shadow-wb-outline outline-none placeholder:text-wb-ntrl-5 focus-visible:shadow-wb-focus"
        />
    );
}

// ─────────────────────────────────────────────────────────────
// Purpose & VAS toggles
// ─────────────────────────────────────────────────────────────

type ToggleRowConfig = {
    key: PreferencesToggleKey;
    titleKey: string;
    descriptionKey: string;
    editTitleKey?: string;
    editDescriptionKey?: string;
};

const TOGGLE_ROWS: ToggleRowConfig[] = [
    {
        key: "use_purpose",
        titleKey: "settings.preferences.use_purpose.title",
        descriptionKey: "settings.preferences.use_purpose.description",
    },
    {
        key: "use_vas_account",
        titleKey: "settings.preferences.use_vas.title",
        descriptionKey: "settings.preferences.use_vas.description",
        editTitleKey: "settings.preferences.use_vas_code.title",
        editDescriptionKey: "settings.preferences.use_vas_code.description",
    },
];

function PurposeVasSection({
    isEditing,
    usePurpose,
    useVas,
    onTogglePurpose,
    onToggleVas,
}: {
    isEditing: boolean;
    usePurpose: boolean;
    useVas: boolean;
    onTogglePurpose: (next: boolean) => Promise<void>;
    onToggleVas: (next: boolean) => Promise<void>;
}) {
    const { t } = useTranslation();
    return (
        <section className="flex flex-col gap-2">
            <h4 className="text-wb-15 font-semibold tracking-wb-tight text-wb-ink">
                {t("settings.preferences.purpose_vas.title")}
            </h4>
            <div className="flex flex-col">
                {TOGGLE_ROWS.map((row, index) => {
                    const enabled = row.key === "use_purpose" ? usePurpose : useVas;
                    const onChange =
                        row.key === "use_purpose" ? onTogglePurpose : onToggleVas;
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
                                    {enabled
                                        ? t("settings.preferences.toggle.on")
                                        : t("settings.preferences.toggle.off")}
                                </span>
                                <ToggleSwitch
                                    tone="brand"
                                    checked={enabled}
                                    ariaLabel={t(titleKey)}
                                    onChange={(next) => {
                                        // Use Purpose / Use VAS Account
                                        // are always directly editable —
                                        // independent of the panel's Edit
                                        // mode (which gates only the
                                        // company-profile fields). Each
                                        // flip persists immediately via
                                        // `toggleEnv` and surfaces an error
                                        // dialog on failure, mirroring the
                                        // legacy comm_0215_001 behaviour and
                                        // the Firm Banking Settings panel.
                                        void onChange(next);
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type DraftState = {
    vietnameseName:      string;
    displayName:         string;
    taxId:               string;
    representativeName:  string;
    representativeEmail: string;
    telNo:               string;
    faxNo:               string;
    addressPost:         string;
    addressDetail:       string;
    addressCity:         string;
    addressState:        string;
};

function toDraft(p: ApiPreferencesResponse): DraftState {
    return {
        vietnameseName:      p.vietnamese_name,
        displayName:         p.display_name ?? "",
        taxId:               p.tax_id,
        representativeName:  p.representative_name ?? "",
        representativeEmail: p.representative_email,
        telNo:               p.tel_no ?? "",
        faxNo:               p.fax_no ?? "",
        addressPost:         p.address.post_address,
        addressDetail:       p.address.detail_address ?? "",
        addressCity:         p.address.city,
        addressState:        p.address.state,
    };
}

function toRequest(d: DraftState): ApiPreferencesUpdateRequest {
    return {
        vietnamese_name:      d.vietnameseName.trim(),
        display_name:         emptyToNull(d.displayName),
        tax_id:               d.taxId.trim(),
        representative_name:  emptyToNull(d.representativeName),
        representative_email: d.representativeEmail.trim(),
        tel_no:               emptyToNull(d.telNo),
        fax_no:               emptyToNull(d.faxNo),
        address: {
            post_address:   d.addressPost.trim(),
            detail_address: emptyToNull(d.addressDetail),
            city:           d.addressCity.trim(),
            state:          d.addressState.trim(),
        },
    };
}

function emptyToNull(s: string): string | null {
    const t = s.trim();
    return t === "" ? null : t;
}

function composeAddress(p: ApiPreferencesResponse): string {
    return [
        p.address.post_address,
        p.address.detail_address,
        p.address.city,
        p.address.state,
    ]
        .filter((s) => s != null && s !== "")
        .join(", ");
}

function validateDraft(d: DraftState, t: (k: string) => string): string | null {
    if (!d.vietnameseName.trim()) return t("settings.preferences.error.vietnamese_name_required");
    if (!d.taxId.trim()) return t("settings.preferences.error.tax_id_required");
    if (!d.representativeEmail.trim()) return t("settings.preferences.error.email_required");
    if (!d.addressPost.trim()) return t("settings.preferences.error.address_required");
    // Light email shape check — backend enforces @Email.
    if (!/^.+@.+\..+$/.test(d.representativeEmail.trim()))
        return t("settings.preferences.error.email_invalid");
    return null;
}

async function toggleEnv(
    code: string,
    next: boolean,
    dialog: ReturnType<typeof useDialog>,
    t: (k: string) => string,
    onSuccess: () => void,
): Promise<void> {
    try {
        await updateEnvironmentSetting(code, { env_set_cont: next ? "Y" : "N" });
        onSuccess();
    } catch (err) {
        const apiErr = err instanceof ApiCallError ? err : null;
        dialog.open({
            type: "error",
            title: t("dialog.error"),
            description: apiErr?.message ?? String(err),
            errorCode: apiErr?.code,
        });
    }
}
