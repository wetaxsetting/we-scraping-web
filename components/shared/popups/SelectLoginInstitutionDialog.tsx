"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

/**
 * Static institution options for the dropdown — Figma 1797:20999
 * "Menu : Dropdown" (Bank, GDT). Replace with a real fetcher
 * (`useApiData` + `lib/api/institutions.ts`) once the institution-
 * master endpoint lands; the dropdown chrome doesn't change.
 */
/** Stable institution identifier — translated label changes per locale,
 *  but the id stays constant so parent flows can branch on it
 *  (`"BANK"` → bank chain, `"GDT"` → GDT credentials popup, …). */
export type InstitutionId = "BANK" | "GDT";

type InstitutionOption = {
    id: InstitutionId;
    /** i18n key for the visible label. */
    labelKey: string;
};

const INSTITUTION_OPTIONS: readonly InstitutionOption[] = [
    {
        id: "BANK",
        labelKey: "settings.login_credentials.select_institution.option.bank",
    },
    {
        id: "GDT",
        labelKey: "settings.login_credentials.select_institution.option.gdt",
    },
];

export type SelectLoginInstitutionDialogProps = {
    onCancel: () => void;
    /** Submit handler. Receives the stable institution id of the
     *  currently-selected option (`"BANK"` / `"GDT"`) so the parent can
     *  branch on it without depending on translated labels. When
     *  omitted, the Next button stays disabled. */
    onNext?: (institutionId: InstitutionId) => void;
    /** Optional override — when `true`, force Next into its disabled
     *  visual state regardless of selection. When omitted, the dialog
     *  auto-enables Next as soon as the user picks an option from the
     *  dropdown. */
    nextDisabled?: boolean;
    /** Optional initial selection by stable institution id. Defaults
     *  to the first option (`"BANK"`) per the Figma frame. */
    initialInstitutionId?: InstitutionId;
};

/**
 * Select a Login Institution feature dialog — Figma 1797:20561.
 *
 * Reusable institution-picker popup used as the first step of the
 * "Add Login Credentials" flow on the Settings → Login Credentials
 * panel. Single dropdown field (Institution + asterisk + dropdown
 * with `Bank` placeholder + chevron) and a right-aligned Cancel +
 * Next footer. Generic enough to be reused by any future flow that
 * asks the user to pick an institution before continuing.
 *
 * Modal frame: `max-w-[410px]`, `rounded-[16px]`,
 * `overflow-visible` (lets the dropdown panel render past the
 * dialog's bottom edge when the option list is long). Inner
 * sections are laid out by hand (per CLAUDE.md §3a's Figma-driven
 * deviation precedent for small modals) — `gap-6 px-4 py-6` mirrors
 * Figma's `px-[16px] py-[24px] gap-[24px]`.
 *
 * Static UI: the option list (`Bank` / `GDT`) is a hardcoded
 * `INSTITUTION_OPTIONS` constant. Click the field to open the
 * dropdown; click a row to commit + close. Next auto-enables once
 * a row has been selected; Cancel + Radix overlay (gated by
 * stackLevel=2's default `closeOnOutsideClick=false`) + ESC dismiss.
 */
export default function SelectLoginInstitutionDialog({
    onCancel,
    onNext,
    nextDisabled,
    initialInstitutionId = "BANK",
}: SelectLoginInstitutionDialogProps) {
    const { t } = useTranslation();
    const fieldId = useId();
    const listboxId = `${fieldId}-listbox`;
    // Track selection by stable institution id (`"BANK"` / `"GDT"`) so
    // the parent flow can branch on it without depending on the
    // translated label. The Figma frame (1797:20569) shows the trigger
    // with "Bank" in dark `text-#404040` — i.e. a baked-in default
    // selection — so we default to the first option (`"BANK"`) and
    // derive the visible label from the option list at render time.
    const [selectedId, setSelectedId] = useState<InstitutionId>(
        initialInstitutionId,
    );
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const fieldWrapperRef = useRef<HTMLDivElement>(null);

    // Auto-derive Next-enabled from the selection. The optional
    // `nextDisabled` prop wins when explicitly `true` — lets a parent
    // veto the auto-enable (e.g. while a previous submission is in
    // flight). The dialog always renders a default selection, so the
    // disabled-by-empty-selection branch is reserved for parents that
    // explicitly clear the selection in the future.
    const isNextDisabled = nextDisabled === true;

    // Close the dropdown on a click outside the field + dropdown.
    // The dialog itself owns ESC and overlay-click dismissal — we
    // only care about clicks landing inside the modal but outside
    // this widget.
    useEffect(() => {
        if (!isDropdownOpen) return;
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node | null;
            if (!target) return;
            if (fieldWrapperRef.current?.contains(target)) return;
            setIsDropdownOpen(false);
        }
        document.addEventListener("mousedown", handlePointerDown);
        return () =>
            document.removeEventListener("mousedown", handlePointerDown);
    }, [isDropdownOpen]);

    const selectedOption =
        INSTITUTION_OPTIONS.find((opt) => opt.id === selectedId) ??
        INSTITUTION_OPTIONS[0];
    const selectedLabel = t(selectedOption.labelKey);

    function handleSelectOption(id: InstitutionId) {
        setSelectedId(id);
        setIsDropdownOpen(false);
    }

    function handleNext() {
        if (isNextDisabled || !onNext) return;
        onNext(selectedId);
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent
                // Level 2 child of Settings (z-[60] above z-50). Sibling
                // of Registered Login Credentials — the two are
                // mutually exclusive entry points into the credentials
                // chain. The transparent overlay keeps Settings' dim
                // from compounding. Standard top-right X close icon
                // comes from the primitive — dismisses only this dialog
                // via the shared modalStack.
                stackLevel={2}
                // Figma 1797:20561 has title only, no description — opt
                // out of Radix's a11y description requirement.
                aria-describedby={undefined}
                // `overflow-visible` so the dropdown panel can extend
                // past the dialog's bottom edge with its layered
                // shadow uncropped.
                className="max-w-[410px] overflow-visible rounded-2xl p-0"
            >
                <div className="flex flex-col gap-6 px-4 py-6">
                    {/* Header — title only. */}
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold text-wb-dark">
                            {t(
                                "settings.login_credentials.select_institution.title",
                            )}
                        </h2>
                    </DialogTitle>

                    {/* Field — Institution * + dropdown. The wrapper
                       anchors the absolutely-positioned dropdown panel
                       below the trigger button. */}
                    <div
                        ref={fieldWrapperRef}
                        className="relative flex flex-col gap-2"
                    >
                        <label
                            htmlFor={fieldId}
                            className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8"
                        >
                            <span>
                                {t(
                                    "settings.login_credentials.select_institution.label",
                                )}
                            </span>
                            <span aria-hidden className="text-wb-red-07">
                                *
                            </span>
                            <span className="sr-only">
                                {t(
                                    "settings.login_credentials.confirmation.required",
                                )}
                            </span>
                        </label>

                        {/* Trigger — same chrome as the Account Type
                           cell in SelectBankAccountsDialog (shadow-wb-btn
                           for the layered-shadow outline + ChevronDown
                           affordance). */}
                        <button
                            id={fieldId}
                            type="button"
                            onClick={() => setIsDropdownOpen((prev) => !prev)}
                            aria-haspopup="listbox"
                            aria-expanded={isDropdownOpen}
                            aria-controls={listboxId}
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md bg-white p-2 shadow-wb-btn"
                        >
                            <span className="min-w-0 flex-1 truncate text-left text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                                {selectedLabel}
                            </span>
                            <ChevronDown
                                className="size-4 shrink-0 text-wb-ntrl-8"
                                strokeWidth={2}
                                aria-hidden
                            />
                        </button>

                        {/* Dropdown panel — Figma 1797:20999. Anchored
                           to the trigger, full field width, white card
                           with the canonical layered shadow. Selected
                           row paints `bg-wb-bg-sidebar` (#f5f5f5) +
                           `text-brand` + check icon per Figma 1797:21002. */}
                        {isDropdownOpen && (
                            <div
                                id={listboxId}
                                role="listbox"
                                aria-label={t(
                                    "settings.login_credentials.select_institution.title",
                                )}
                                className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 rounded-md bg-white p-1 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_2px_0px_rgba(0,0,0,0.1),0px_6px_20px_0px_rgba(0,0,0,0.1)]"
                            >
                                <div className="flex flex-col gap-0.5">
                                    {INSTITUTION_OPTIONS.map((opt) => {
                                        const label = t(opt.labelKey);
                                        const isSelected = opt.id === selectedId;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                onClick={() =>
                                                    handleSelectOption(opt.id)
                                                }
                                                className={
                                                    "flex w-full cursor-pointer items-center gap-2 rounded p-2 text-left transition-colors hover:bg-wb-bg-sidebar " +
                                                    (isSelected
                                                        ? "bg-wb-bg-sidebar"
                                                        : "bg-transparent")
                                                }
                                            >
                                                <span
                                                    className={
                                                        "min-w-0 flex-1 truncate text-wb-14 font-medium leading-4 tracking-wb-tight " +
                                                        (isSelected
                                                            ? "text-brand"
                                                            : "text-wb-ntrl-8")
                                                    }
                                                >
                                                    {label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer — Cancel (outline) + Next (auto-enables
                       on selection). Right-aligned, gap-2. */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium tracking-wb-tight text-wb-ntrl-10 shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            disabled={isNextDisabled}
                            aria-disabled={isNextDisabled}
                            onClick={isNextDisabled ? undefined : handleNext}
                            className={
                                isNextDisabled
                                    ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white"
                                    : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                            }
                        >
                            {t(
                                "settings.login_credentials.select_institution.next",
                            )}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
