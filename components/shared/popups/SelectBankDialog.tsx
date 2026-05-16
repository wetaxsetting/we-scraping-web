"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

import {
    Dialog,
    DialogContent,
    type DialogStackLevel,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";

import { SELECT_BANK_LIST, type BankOption } from "./selectBankBanks";

export type SelectBankDialogProps = {
    /** Controlled value of the search input. */
    value: string;
    onChange: (next: string) => void;
    /** Optional handler for the right-side search-icon click. The icon is
     *  decorative on static UI; when omitted the click no-ops. */
    onSearch?: () => void;
    /** Fired when the user picks a row from the dropdown. The parent
     *  typically stores the bank and drives `nextDisabled` / `onNext`
     *  from it — this dialog deliberately does NOT track its own
     *  "selection committed" state so the flow stays parent-controlled. */
    onSelect?: (bank: BankOption) => void;
    onCancel: () => void;
    /** Submit handler. When omitted (or `nextDisabled`), the Next button
     *  stays in its disabled visual state and clicks no-op. */
    onNext?: () => void;
    /** Force the Next button into its disabled visual state. Defaults to
     *  `true` for static UI. */
    nextDisabled?: boolean;
    /** Position in the modal stack. Defaults to `3` because the canonical
     *  use is the Settings → Registered → Select Bank chain. Callers that
     *  open this popup directly from a Settings panel (e.g. Bank Account
     *  Management → +Add) pass `2` so the overlay dim and z-index match
     *  CLAUDE.md §"Modal stacking convention". */
    stackLevel?: DialogStackLevel;
    /** Optional list of banks to render. When omitted, falls back to the
     *  static {@link SELECT_BANK_LIST} (legacy default). When supplied,
     *  the parent has fetched live bank registry data (e.g. via
     *  {@code GET /api/v1/login-credentials/banks}) and the picker shows
     *  real {@code BANK_CD} values that flow correctly to NXISAS. */
    banks?: readonly BankOption[];
};

/**
 * Select Bank feature dialog — Figma 1081:25861 + 1081:25910 (dropdown).
 *
 * Reusable institution-picker popup: a small modal with one search field
 * (Bank label + asterisk + search input with right-side clear / search
 * icons) and a right-aligned Cancel + Next footer. Below the input sits a
 * filtered bank dropdown — opens on input focus, on the search-icon
 * click, or as the user types; clicking a row commits the bank name back
 * through `onChange` and closes the dropdown. Triggered today by the
 * "Choose another bank" button inside `<LoginIdPasswordDialog>`, but
 * generic enough to be reused by any future flow that prompts the user
 * to pick a bank before continuing.
 *
 * Frame: `max-w-[410px]`, `rounded-[16px]`. The chrome is
 * laid out by hand (per CLAUDE.md §3a's Figma-driven deviation
 * precedent for small modals) — the body lives inside `p-4 gap-4` and
 * the footer sits in its own `p-2.5 gap-2.5` band, exactly matching
 * the Figma frame's split.
 *
 * Static UI: search/clear/next handlers are optional no-ops by default;
 * Cancel + overlay click + ESC dismiss. Bank list is sourced from the
 * static `SELECT_BANK_LIST` constant — swap for a real fetcher when
 * the bank-master endpoint lands.
 */
export default function SelectBankDialog({
    value,
    onChange,
    onSearch,
    onSelect,
    onCancel,
    onNext,
    nextDisabled = true,
    stackLevel = 3,
    banks,
}: SelectBankDialogProps) {
    const { t } = useTranslation();
    const inputId = useId();
    const isNextDisabled = nextDisabled || !onNext;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const inputRowRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Caller-supplied list (live API) wins; otherwise use the static
    // seed so the dialog stays usable without a parent fetch.
    const bankList: readonly BankOption[] = banks ?? SELECT_BANK_LIST;

    const trimmedValue = value.trim().toLowerCase();
    const filteredBanks = useMemo(() => {
        if (!trimmedValue) return bankList;
        return bankList.filter((bank) =>
            bank.name.toLowerCase().includes(trimmedValue),
        );
    }, [trimmedValue, bankList]);

    // Selected = bank whose name matches the current value exactly. Used
    // to paint the gray "currently selected" row when the user reopens
    // the dropdown after a selection (Figma 1081:25951 first-row state).
    const selectedBankId = useMemo(() => {
        if (!trimmedValue) return null;
        return (
            bankList.find(
                (bank) => bank.name.toLowerCase() === trimmedValue,
            )?.id ?? null
        );
    }, [trimmedValue, bankList]);

    // Close the dropdown on a click outside the input row + dropdown.
    // The dialog itself owns ESC and overlay-click dismissal — we only
    // care about clicks landing inside the modal but outside this widget.
    useEffect(() => {
        if (!isDropdownOpen) return;
        function handlePointerDown(event: MouseEvent) {
            const target = event.target as Node | null;
            if (!target) return;
            if (
                inputRowRef.current?.contains(target) ||
                dropdownRef.current?.contains(target)
            ) {
                return;
            }
            setIsDropdownOpen(false);
        }
        document.addEventListener("mousedown", handlePointerDown);
        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [isDropdownOpen]);

    function handleSearchClick() {
        setIsDropdownOpen((prev) => !prev);
        onSearch?.();
    }

    function handleSelectBank(bank: BankOption) {
        onChange(bank.name);
        onSelect?.(bank);
        setIsDropdownOpen(false);
    }

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent
                // Stack position is caller-driven: defaults to L3 for the
                // Settings → Registered → child chain, and L2 when opened
                // directly from a Settings panel (Bank Account → +Add).
                // The shared modalStack ensures ESC and X dismiss only
                // this dialog regardless of the selected level.
                stackLevel={stackLevel}
                // Figma 1081:25861 has title only, no description — opt
                // out of Radix's a11y description requirement.
                aria-describedby={undefined}
                className="max-w-[410px] overflow-visible rounded-2xl p-0"
            >
                {/* Top section — title + field. p-4 gap-4 per Figma. */}
                <div className="flex flex-col gap-4 p-4">
                    <DialogTitle asChild>
                        <h2 className="text-wb-13 font-medium text-wb-dark">
                            {t("settings.login_credentials.select_bank.title")}
                        </h2>
                    </DialogTitle>

                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor={inputId}
                            className="flex items-start gap-0.5 text-wb-14 font-medium leading-normal text-wb-muted"
                        >
                            <span>
                                {t("settings.login_credentials.select_bank.label")}
                            </span>
                            <span aria-hidden className="text-wb-red-07">
                                *
                            </span>
                            <span className="sr-only">
                                {t("settings.login_credentials.confirmation.required")}
                            </span>
                        </label>

                        {/* Input + dropdown stack. `relative` anchors the
                           absolutely-positioned dropdown to the input row
                           below it. */}
                        <div className="relative">
                            {/* Input row — 1 px gray border, no focus colour
                               change. Per design ask (2026-05-06): keep the
                               default border on focus; suppress the blue
                               ring/halo entirely so the field reads
                               identically focused and unfocused. */}
                            <div
                                ref={inputRowRef}
                                className="flex items-center gap-1 rounded-[7px] border border-wb-ntrl-4 bg-white pl-2.5 pr-2 py-2"
                            >
                                <input
                                    id={inputId}
                                    type="text"
                                    value={value}
                                    onChange={(e) => {
                                        onChange(e.target.value);
                                        setIsDropdownOpen(true);
                                    }}
                                    // `onClick` (not `onFocus`) — Radix
                                    // auto-focuses the first focusable
                                    // element when the dialog mounts, so
                                    // a focus-based open would surface
                                    // the dropdown immediately on modal
                                    // open. Click and typing are the only
                                    // user-initiated triggers.
                                    onClick={() => setIsDropdownOpen(true)}
                                    placeholder={t(
                                        "settings.login_credentials.select_bank.placeholder",
                                    )}
                                    autoComplete="off"
                                    spellCheck={false}
                                    role="combobox"
                                    aria-expanded={isDropdownOpen}
                                    aria-controls={`${inputId}-listbox`}
                                    aria-autocomplete="list"
                                    className="min-w-0 flex-1 appearance-none border-0 bg-transparent text-wb-14 font-medium leading-4 text-wb-ntrl-8 shadow-none outline-none ring-0 placeholder:text-wb-muted focus:border-0 focus:outline-none focus:ring-0"
                                />
                                <button
                                    type="button"
                                    onClick={handleSearchClick}
                                    aria-label={t(
                                        "settings.login_credentials.select_bank.search",
                                    )}
                                    aria-expanded={isDropdownOpen}
                                    className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-brand"
                                >
                                    <Search className="size-4" strokeWidth={2} />
                                </button>
                            </div>

                            {/* Dropdown — Figma 1081:25948. Anchored to the
                               input row, full input width, white card with
                               soft layered shadow. Visible only while open
                               AND there is at least one filtered match. */}
                            {isDropdownOpen && filteredBanks.length > 0 && (
                                <div
                                    ref={dropdownRef}
                                    id={`${inputId}-listbox`}
                                    role="listbox"
                                    aria-label={t(
                                        "settings.login_credentials.select_bank.title",
                                    )}
                                    // max-h-[320px] caps the dropdown at
                                    // roughly 8 rows; custom-scrollbar-y
                                    // pairs the WB365 scrollbar token
                                    // (per CLAUDE.md §6c) so longer lists
                                    // scroll inside instead of pushing
                                    // the modal taller than the viewport.
                                    className="custom-scrollbar-y absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-[320px] overflow-y-auto rounded-[6px] bg-white p-1 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_2px_0px_rgba(0,0,0,0.1),0px_6px_20px_0px_rgba(0,0,0,0.1)]"
                                >
                                    <div className="flex flex-col gap-0.5">
                                        {filteredBanks.map((bank) => {
                                            const isSelected =
                                                bank.id === selectedBankId;
                                            return (
                                                <button
                                                    key={bank.id}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isSelected}
                                                    onClick={() =>
                                                        handleSelectBank(bank)
                                                    }
                                                    className={
                                                        "flex w-full cursor-pointer items-center gap-2 rounded-[4px] p-2 text-left transition-colors hover:bg-wb-bg-sidebar " +
                                                        (isSelected
                                                            ? "bg-wb-bg-sidebar"
                                                            : "bg-transparent")
                                                    }
                                                >
                                                    <BankLogoMark bank={bank} />
                                                    <span className="min-w-0 flex-1 truncate text-wb-14 font-medium leading-4 tracking-wb-tight text-wb-ntrl-8">
                                                        {bank.name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer — Cancel + Next, right-aligned. p-2.5 gap-2.5
                   per Figma. */}
                <div className="flex items-center justify-end gap-2.5 p-2.5">
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
                        onClick={isNextDisabled ? undefined : onNext}
                        className={
                            isNextDisabled
                                ? "flex h-8 cursor-not-allowed items-center justify-center rounded-md bg-wb-ntrl-4 px-3 text-wb-14-tight font-medium tracking-wb-tight text-white"
                                : "flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium tracking-wb-tight text-white shadow-wb-brand-btn hover:bg-brand-hover"
                        }
                    >
                        {t("settings.login_credentials.select_bank.next")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Bank picker row icon. Renders the real PNG asset under
 * {@code public/banklogo/} when {@link BankOption.logoUrl} resolves; on
 * any image-load failure (asset missing, wrong locale variant) the row
 * gracefully falls back to a 24 px brand-coloured disc with the bank's
 * initial in white — matches the legacy comm_0218_nxisas behaviour
 * where un-seeded banks render an initial chip instead of a broken-image
 * icon. Logos are bitmap (PNG) so we render via {@code <img>}.
 */
function BankLogoMark({ bank }: { bank: BankOption }) {
    const [errored, setErrored] = useState(false);
    const showImage = bank.logoUrl && !errored;

    if (showImage) {
        return (
            <span
                aria-hidden
                // Fixed 24×24 box so every row aligns vertically, but
                // the image inside scales to fit its natural aspect
                // ratio — most brand icons are square monograms (BIDV,
                // ACB, Vietin) but a handful are wider wordmarks
                // (ABBANK, KEBHana). object-contain + width-auto keeps
                // both groups crisp without distortion.
                className="flex size-6 shrink-0 items-center justify-center"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={bank.logoUrl}
                    alt=""
                    onError={() => setErrored(true)}
                    className="max-h-6 max-w-6 object-contain"
                />
            </span>
        );
    }
    return (
        <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white"
            style={{ backgroundColor: bank.color }}
        >
            {bank.initial}
        </span>
    );
}
