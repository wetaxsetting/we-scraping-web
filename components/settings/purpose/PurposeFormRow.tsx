"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import ParentPurposePicker from "./ParentPurposePicker";
import PurposeTableColumns, {
    PURPOSE_TABLE_MIN_WIDTH,
} from "./PurposeTableColumns";
import type { PurposeNode } from "./types";

/** Shape of a draft purpose submitted by the inline form. */
export type PurposeDraft = {
    code: string;
    name: string;
    description: string;
    /** Empty when the draft is a level-1 purpose; carries a parent code for level-2. */
    parentCode: string;
};

export type PurposeFormMode =
    | { kind: "add" }
    | {
          kind: "edit";
          node: PurposeNode;
          /** Resolved parent code when editing a child — empty for level-1 nodes. */
          parentCode: string;
      };

type PurposeFormRowProps = {
    mode: PurposeFormMode;
    /** Only level-1 codes; OQ-FE-Frontend-1 (decided 2026-05-12) — the
     *  picker MUST not expose level-2 rows. The panel filters this
     *  list before passing it through. */
    eligibleParents: { code: string; name: string }[];
    onCancel: () => void;
    onSave: (draft: PurposeDraft) => void;
    /** Outer-table class names — used by the panel to stack
     *  `mt-auto` + `sticky bottom-0 z-10`. */
    className?: string;
};

/* Backend Bean Validation rules (mirrored frontend-side):
 *   hand_use_usag_cd → required, ≤ 20 chars
 *   use_usag_nm       → required, ≤ 255 chars
 *   use_usag_cont     → optional, ≤ 500 chars
 *   parent_use_usag_cd→ optional, ≤ 20 chars
 * Backend is still authoritative; the frontend guard is just for UX. */
const MAX_CODE_LEN        = 20;
const MAX_NAME_LEN        = 255;
const MAX_DESCRIPTION_LEN = 500;
const MAX_PARENT_LEN      = 20;

/**
 * Purpose — inline Add / Edit row (Figma 9448:19960).
 *
 * Renders as a self-contained `<table>` with the SAME `<colgroup>` as
 * the main read-only `<PurposeTable>`. Both tables sit inside one
 * shared horizontal-scroll container (panel layer), so columns stay
 * perfectly aligned with the header above regardless of vertical or
 * horizontal scroll position — the canonical CLAUDE.md §7a sibling-table
 * pattern, mirroring Chart of Accounts.
 *
 * <h2>Validation (Phase 3 — 2026-05-12)</h2>
 *
 * Mirrors the backend Bean Validation rules: required + length caps on
 * the four wire fields. Save stays disabled until the required fields
 * (`code`, `name`) are non-empty. Backend is still authoritative — any
 * client bypass surfaces as a server `WBE_VALIDATION` envelope.
 *
 * <h2>Parent picker (OQ-FE-Frontend-1 — decided 2026-05-12)</h2>
 *
 * Free-text input fronted by a datalist of eligible level-1 codes.
 * The picker MUST not expose level-2 rows; the panel guarantees this
 * by pre-filtering `eligibleParents` to level-1 only.
 */
export default function PurposeFormRow({
    mode,
    eligibleParents,
    onCancel,
    onSave,
    className,
}: PurposeFormRowProps) {
    const { t } = useTranslation();
    const seed = mode.kind === "edit" ? mode.node : null;

    const [code, setCode] = useState(seed?.code ?? "");
    const [name, setName] = useState(seed?.name ?? "");
    const [description, setDescription] = useState(
        seed?.description && seed.description !== "-" ? seed.description : "",
    );
    const [parentCode, setParentCode] = useState(
        mode.kind === "edit" ? mode.parentCode : "",
    );
    const [submitting, setSubmitting] = useState(false);

    /* Parent picker dropdown state — anchored to the input via the
     * rect captured at focus time. `null` means closed. The host
     * (ParentPurposePicker) handles ESC + outside-click dismissal;
     * Cancel/Save committing also clears the rect implicitly via
     * unmount. */
    const parentInputRef = useRef<HTMLInputElement>(null);
    const [parentAnchorRect, setParentAnchorRect] = useState<DOMRect | null>(
        null,
    );
    const parentPickerOpen = parentAnchorRect !== null;

    function openParentPicker() {
        if (parentInputRef.current) {
            setParentAnchorRect(parentInputRef.current.getBoundingClientRect());
        }
    }
    function closeParentPicker() {
        setParentAnchorRect(null);
    }

    const codeTrimmed = code.trim();
    const nameTrimmed = name.trim();
    const isValid =
        codeTrimmed.length > 0 &&
        nameTrimmed.length > 0 &&
        code.length <= MAX_CODE_LEN &&
        name.length <= MAX_NAME_LEN &&
        description.length <= MAX_DESCRIPTION_LEN &&
        parentCode.length <= MAX_PARENT_LEN;

    async function handleSave() {
        if (!isValid || submitting) return;
        try {
            setSubmitting(true);
            await onSave({
                code: codeTrimmed,
                name: nameTrimmed,
                description: description.trim(),
                parentCode: parentCode.trim(),
            });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <table
            className={cn(
                "table-fixed border-collapse border-t border-wb-table-border bg-wb-bg-footer",
                className,
            )}
            style={{
                width: "100%",
                minWidth: PURPOSE_TABLE_MIN_WIDTH,
            }}
        >
            <PurposeTableColumns />
            <tbody>
                <tr className="align-middle">
                    {/* Chevron gutter — empty placeholder so the row aligns
                       with the table's first column. */}
                    <td className="px-2.5 py-2" />

                    {/* Purpose Code */}
                    <td className="px-2.5 py-2">
                        <InlineInput
                            value={code}
                            onChange={setCode}
                            placeholder={t(
                                "settings.purpose.form.code_placeholder",
                            )}
                            ariaLabel={t("settings.purpose.col.code")}
                            maxLength={MAX_CODE_LEN}
                            invalid={code.length > MAX_CODE_LEN}
                        />
                    </td>

                    {/* Purpose Name */}
                    <td className="px-2.5 py-2">
                        <InlineInput
                            value={name}
                            onChange={setName}
                            placeholder={t(
                                "settings.purpose.form.name_placeholder",
                            )}
                            ariaLabel={t("settings.purpose.col.name")}
                            maxLength={MAX_NAME_LEN}
                            invalid={name.length > MAX_NAME_LEN}
                        />
                    </td>

                    {/* Description + parent picker + Cancel / Save. */}
                    <td colSpan={2} className="px-2.5 py-2">
                        <div className="flex items-center gap-2">
                            <InlineInput
                                value={description}
                                onChange={setDescription}
                                placeholder={t(
                                    "settings.purpose.form.description_placeholder",
                                )}
                                ariaLabel={t(
                                    "settings.purpose.col.description",
                                )}
                                className="min-w-0 flex-1"
                                maxLength={MAX_DESCRIPTION_LEN}
                                invalid={description.length > MAX_DESCRIPTION_LEN}
                            />
                            <InlineInput
                                inputRef={parentInputRef}
                                value={parentCode}
                                onChange={(next) => {
                                    setParentCode(next);
                                    // Typing should keep the panel
                                    // open + refresh its position so
                                    // the filter stays visible while
                                    // the user types.
                                    if (parentInputRef.current) {
                                        setParentAnchorRect(
                                            parentInputRef.current.getBoundingClientRect(),
                                        );
                                    }
                                }}
                                onFocus={openParentPicker}
                                onClick={openParentPicker}
                                placeholder={t(
                                    "settings.purpose.form.parent_placeholder",
                                )}
                                ariaLabel={t(
                                    "settings.purpose.form.parent_aria",
                                )}
                                className="w-[180px] shrink-0"
                                maxLength={MAX_PARENT_LEN}
                                invalid={parentCode.length > MAX_PARENT_LEN}
                                trailingIcon={
                                    <Search
                                        className="size-3.5 text-wb-ntrl-6"
                                        strokeWidth={1.8}
                                        aria-hidden
                                    />
                                }
                            />
                            {/* Searchable parent dropdown — Figma
                               9542:20102. Portal-rendered so the
                               panel can overflow the form row's `<td>`
                               clip rect + the Settings modal's
                               `overflow-hidden` scroll container. */}
                            {parentPickerOpen && parentAnchorRect && (
                                <ParentPurposePicker
                                    anchorRect={parentAnchorRect}
                                    options={eligibleParents}
                                    query={parentCode}
                                    selected={parentCode}
                                    onSelect={(opt) => {
                                        setParentCode(opt.code);
                                        closeParentPicker();
                                        // Return focus to the input
                                        // so the user can immediately
                                        // tab on to Save / Cancel.
                                        parentInputRef.current?.focus();
                                    }}
                                    onClose={closeParentPicker}
                                />
                            )}
                            <button
                                type="button"
                                onClick={onCancel}
                                disabled={submitting}
                                className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {t("settings.purpose.form.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!isValid || submitting}
                                className={cn(
                                    "inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover",
                                    (!isValid || submitting) &&
                                        "cursor-not-allowed opacity-60 hover:bg-brand",
                                    isValid && !submitting && "cursor-pointer",
                                )}
                            >
                                {t("settings.purpose.form.save")}
                            </button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

type InlineInputProps = {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    ariaLabel: string;
    trailingIcon?: React.ReactNode;
    className?: string;
    /** Hard cap mirroring the backend Bean Validation length. */
    maxLength?: number;
    /** Render the input with the WB365 danger ramp when true. */
    invalid?: boolean;
    /** Optional handlers for the parent-picker trigger — the picker
     *  needs to know when focus / click lands on the input so it can
     *  open the dropdown anchored to it. */
    onFocus?: () => void;
    onClick?: () => void;
    /** Forwarded ref so the host can read the input's bounding rect
     *  (drives the portal-rendered dropdown's anchor position). */
    inputRef?: React.Ref<HTMLInputElement>;
};

/**
 * 32-px-tall slim text input matching the Chart of Accounts inline-row
 * chrome (Figma 9196:13888 et al.). Used only inside this form for now
 * — extract to `components/settings/` when a second consumer outside
 * this file lands (CLAUDE.md §1 two-call rule).
 *
 * Accepts a forwarded `inputRef` so the parent picker can anchor its
 * portal-rendered dropdown to the input's bounding rect. The
 * `onFocus` / `onClick` callbacks open the picker on initial focus
 * AND on subsequent clicks (re-opens after dismiss).
 */
function InlineInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
    trailingIcon,
    className,
    maxLength,
    invalid,
    onFocus,
    onClick,
    inputRef,
}: InlineInputProps & { ref?: React.Ref<HTMLDivElement> }) {
    return (
        <div className={cn("relative w-full", className)}>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={onFocus}
                onClick={onClick}
                placeholder={placeholder}
                aria-label={ariaLabel}
                aria-invalid={invalid || undefined}
                maxLength={maxLength}
                className={cn(
                    "h-8 w-full rounded-md bg-white py-2 pl-2 text-wb-13 font-medium leading-4 text-wb-ink placeholder:text-wb-ntrl-5",
                    "shadow-wb-outline outline-none",
                    "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                    invalid && "shadow-[0px_0px_0px_1px_var(--color-wb-red-07)]",
                    trailingIcon ? "pr-7" : "pr-2",
                )}
            />
            {trailingIcon && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center"
                >
                    {trailingIcon}
                </span>
            )}
        </div>
    );
}
