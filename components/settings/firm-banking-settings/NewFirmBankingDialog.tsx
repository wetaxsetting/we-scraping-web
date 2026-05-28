"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ModalField, ModalInput } from "@/components/shared/modal-form";
import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { fetchAccountsByBank } from "@/lib/api/banking";
import { createFirmBankingSetting } from "@/lib/api/firmBankingSettings";
import { mapAccountLookupOption } from "@/lib/api/mappers";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import BankLogo from "./BankLogo";
import type {
    AccountLookupOption,
    FirmBankingLinkedAccount,
} from "./types";

type SupportedBank = "shinhan" | "vietcombank" | "woori";

/**
 * Bounded-bank set per OQ-8a Option (c) — wire NAPAS code + i18n
 * label + the visual `BankLogo` token. The set MUST stay in lockstep
 * with the backend `BANK_TO_FILE_TYPE` allow-list inside
 * `FirmBankingSettingsService` AND the V68 `NAPAS_BANK_INFO` seed.
 *
 * TODO(future-bank-onboarding): when the backend extends the allow-
 * list, append a row here, V68's seed, and the backend map in the
 * same MR. No other UI change is required — the autocomplete loads
 * accounts dynamically from `/api/v1/banking/accounts/by-bank`.
 */
const SUPPORTED_BANKS: ReadonlyArray<{
    key: SupportedBank;
    outBankCd: string;
    labelKey: string;
    logo: FirmBankingLinkedAccount["bank"];
}> = [
    {
        key: "shinhan",
        outBankCd: "970424",
        labelKey: "settings.firm_banking_settings.new_firm_banking.banks.shinhan",
        logo: "shinhan",
    },
    {
        key: "vietcombank",
        outBankCd: "970436",
        labelKey:
            "settings.firm_banking_settings.new_firm_banking.banks.vietcombank",
        logo: "vcb",
    },
    {
        key: "woori",
        outBankCd: "970457",
        labelKey: "settings.firm_banking_settings.new_firm_banking.banks.woori",
        logo: "woori",
    },
];

type NewFirmBankingDialogProps = {
    onClose: () => void;
    /** Fired AFTER a successful POST. Host (panel) bumps its refetch
     *  token so the linked-accounts list re-renders with the new row. */
    onCreated?: () => void;
};

/**
 * "New Firm Banking" dialog — Figma 5936:24436.
 *
 * Wire-up status (2026-05-09):
 *   - Bank dropdown limited to the OQ-8a Option (c) bounded set
 *     (Shinhan / Vietcombank / Woori).
 *   - Withdrawal Account is a **searchable autocomplete** wired to
 *     `GET /api/v1/banking/accounts/by-bank` — mirrors the legacy
 *     `comm_0220_002.ts` UX:
 *       1. Selecting a bank loads its accounts once
 *          (`fuctionLoadWithdrawalAccounts`).
 *       2. Click in the input → opens the dropdown.
 *       3. Typing filters the loaded list client-side
 *          (`searchAccounts` / `filterAccounts`).
 *       4. Selecting a row stores the raw `acct_no` in form state and
 *          paints the masked `<acct> (<ccy>)` label in the input.
 *       5. Changing the bank clears the selected account.
 *       6. The input is disabled until a bank is selected.
 *       7. No debounce — list is loaded once per bank-change and
 *          filtered in memory; matches JEX exactly.
 *   - Submit calls `createFirmBankingSetting` with the raw
 *     `wdrl_act_no`. Server-derives `file_type`. `org_stat` stays
 *     hardcoded `"1"` until UX adds a status selector.
 */
export default function NewFirmBankingDialog({
    onClose,
    onCreated,
}: NewFirmBankingDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();

    const [bank, setBank] = useState<SupportedBank | null>(null);
    const [partnerId, setPartnerId] = useState("");
    const [vanCode, setVanCode] = useState("");

    /** All accounts loaded for the currently-selected bank. Loaded
     *  once per bank-change; filtered client-side as the user types. */
    const [accountOptions, setAccountOptions] = useState<AccountLookupOption[]>([]);
    /** True while the autocomplete is awaiting the lookup response. */
    const [accountLoading, setAccountLoading] = useState(false);
    /** Free-form text the user types into the autocomplete chip. Drives
     *  the in-memory filter and is also painted into the input when no
     *  selection has been made yet. */
    const [accountQuery, setAccountQuery] = useState("");
    /** Raw `acct_no` of the selected account — submitted as
     *  `wdrl_act_no`. Null while no account has been picked. */
    const [selectedAcctNo, setSelectedAcctNo] = useState<string | null>(null);
    /** Pre-composed `<masked> (<ccy>)` chip label for the selected
     *  row. Painted into the input when a row has been selected so
     *  the user sees the same string that lands in the audit log. */
    const [selectedDisplayLabel, setSelectedDisplayLabel] = useState("");
    /** True while the autocomplete dropdown is open. Toggled on click
     *  and on outside-click via the effect below. */
    const [accountOpen, setAccountOpen] = useState(false);
    /** Keyboard-driven highlight cursor for the popover. -1 = no row
     *  highlighted (mouse-only mode); ≥0 = the matching index inside
     *  the currently-filtered list. Driven by Arrow Up / Arrow Down on
     *  the input and reset whenever the filter narrows so the cursor
     *  doesn't dangle past the new list bounds. The highlighted row
     *  is auto-scrolled into view via the layout effect below — that
     *  is the "auto scroll" the user is asking about. */
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    const [submitting, setSubmitting] = useState(false);

    const [bankOpen, setBankOpen] = useState(false);
    const bankWrapperRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!bankOpen) return;
        const handler = (e: MouseEvent) => {
            if (!bankWrapperRef.current) return;
            if (!bankWrapperRef.current.contains(e.target as Node)) {
                setBankOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [bankOpen]);

    const accountWrapperRef = useRef<HTMLDivElement | null>(null);
    /** The autocomplete `<input>` itself — drives the popover anchor so
     *  the portal-rendered dropdown can compute its `position: fixed`
     *  rect from the input's bounding box every time it opens. */
    const accountInputRef = useRef<HTMLInputElement | null>(null);
    /** Popover element ref — used by the outside-click handler to test
     *  containment. With the popover portaled to `document.body` it is
     *  no longer a descendant of `accountWrapperRef`, so the click-out
     *  test must check both refs. */
    const accountPopoverRef = useRef<HTMLDivElement | null>(null);
    /** Per-option `<li>` refs — the layout effect below calls
     *  `scrollIntoView({ block: "nearest" })` on the highlighted
     *  entry so keyboard navigation pulls off-screen rows back into
     *  view automatically. Mirrors the standard combobox UX (Material,
     *  Headless UI, native `<select>`) — pressing Arrow Down past the
     *  visible window scrolls one row at a time, not the whole page. */
    const accountOptionRefs = useRef<Array<HTMLLIElement | null>>([]);

    /** Computed `position: fixed` style for the portaled popover. The
     *  popover is anchored to `accountInputRef`'s bounding rect; opens
     *  BELOW when there's room, flips ABOVE otherwise. `maxHeight` is
     *  capped to the available viewport space minus 8px padding so the
     *  list never spills off-screen. */
    const [accountPopoverStyle, setAccountPopoverStyle] =
        useState<React.CSSProperties | null>(null);

    /** Recompute the popover position on open + on scroll / resize so
     *  the portal-rendered dropdown stays glued to the input as the
     *  user moves the page (e.g. the modal scrolls internally on a
     *  short viewport). Only runs while the dropdown is open. */
    useLayoutEffect(() => {
        if (!accountOpen) {
            setAccountPopoverStyle(null);
            return;
        }
        const compute = () => {
            const el = accountInputRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const vh = window.innerHeight;
            const GAP = 4;        // matches the previous mt-1 visual gap
            const VIEWPORT_PAD = 8;
            // Smaller cap than the canonical popover (240) — keeps the
            // Withdrawal Account list compact (4 rows tall by default
            // at ~48px row height including the nickname sub-line) so
            // the dropdown doesn't dominate the modal visually. The
            // user explicitly asked for a smaller height.
            const MAX = 200;

            const spaceBelow = vh - rect.bottom - GAP - VIEWPORT_PAD;
            const spaceAbove = rect.top - GAP - VIEWPORT_PAD;

            // Open downward by default; flip up only when the panel
            // would clip more aggressively below than above. Mirrors
            // the ViewSettingPopover heuristic (no-room-below → open
            // above).
            const openUpward = spaceBelow < Math.min(MAX, 140) && spaceAbove > spaceBelow;
            const maxHeight = Math.max(
                80,                                 // never shorter than 2-3 rows
                Math.min(MAX, openUpward ? spaceAbove : spaceBelow),
            );

            setAccountPopoverStyle({
                position: "fixed",
                left: rect.left,
                width: rect.width,
                maxHeight,
                ...(openUpward
                    ? { bottom: vh - rect.top + GAP }
                    : { top: rect.bottom + GAP }),
            });
        };

        compute();
        // Keep the popover stuck to the input as the user scrolls
        // (Settings shell scroll, page scroll) or resizes the window.
        // `true` on capture so internal-scroll containers also fire.
        window.addEventListener("scroll", compute, true);
        window.addEventListener("resize", compute);
        return () => {
            window.removeEventListener("scroll", compute, true);
            window.removeEventListener("resize", compute);
        };
    }, [accountOpen]);

    useEffect(() => {
        if (!accountOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const insideTrigger =
                accountWrapperRef.current?.contains(target) ?? false;
            const insidePopover =
                accountPopoverRef.current?.contains(target) ?? false;
            if (!insideTrigger && !insidePopover) {
                setAccountOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [accountOpen]);

    const partnerIdId = useId();
    const vanCodeId = useId();
    const wdrlActNoId = useId();
    const wdrlActNoListId = useId();

    const selectedBank = bank
        ? SUPPORTED_BANKS.find((b) => b.key === bank) ?? null
        : null;

    /** Load accounts whenever the bank changes; clear the selection
     *  + query so the autocomplete chip starts fresh.
     *
     *  Guarded with an `ignore` flag so an out-of-order response
     *  (user clicks bank A → bank B before A's request returns)
     *  doesn't overwrite B's loaded list with A's stale rows. */
    useEffect(() => {
        // Clear selection + filter regardless of whether a bank is
        // selected — the user always restarts the account picker
        // when they change banks.
        setAccountOptions([]);
        setAccountQuery("");
        setSelectedAcctNo(null);
        setSelectedDisplayLabel("");
        setAccountOpen(false);

        if (!selectedBank) {
            setAccountLoading(false);
            return;
        }

        let ignore = false;
        setAccountLoading(true);
        fetchAccountsByBank(selectedBank.outBankCd)
            .then((res) => {
                if (ignore) return;
                setAccountOptions(res.list.map(mapAccountLookupOption));
            })
            .catch((err) => {
                if (ignore) return;
                const code = err instanceof ApiCallError ? err.code : "WBE9999";
                const message =
                    err instanceof Error ? err.message : t("common.error.unknown");
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode: code,
                });
                setAccountOptions([]);
            })
            .finally(() => {
                if (ignore) return;
                setAccountLoading(false);
            });

        return () => {
            ignore = true;
        };
        // `dialog` and `t` are stable; depending on `selectedBank`
        // covers every fetch trigger.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBank?.outBankCd]);

    /** Filter the loaded list against the current query string —
     *  matches against the masked display label and the raw account
     *  number (so a user can paste either form). Mirrors legacy
     *  `comm_0220_002.searchAccounts` (formatted account + currency
     *  matched case-insensitively). */
    const filteredAccounts = useMemo(() => {
        const q = accountQuery.trim().toLowerCase();
        if (!q) return accountOptions;
        return accountOptions.filter((opt) => {
            return (
                opt.displayLabel.toLowerCase().includes(q) ||
                opt.acctNo.toLowerCase().includes(q)
            );
        });
    }, [accountOptions, accountQuery]);

    /** Reset the keyboard-cursor whenever the popover opens (start at
     *  row 0) or the visible list changes shape (filter narrowed /
     *  bank reload). Closing the popover clears the cursor so the
     *  next open starts fresh — matches Material / Headless UI
     *  combobox semantics. */
    useEffect(() => {
        if (!accountOpen) {
            setHighlightedIndex(-1);
            return;
        }
        // Snap the cursor to the first valid row whenever the popover
        // opens or the filtered list changes (e.g. user typed and the
        // list narrowed). If the list is empty we go to -1 so Enter
        // is a no-op.
        setHighlightedIndex(filteredAccounts.length > 0 ? 0 : -1);
    }, [accountOpen, filteredAccounts]);

    /** Auto-scroll the highlighted row into view inside the popover.
     *  `block: "nearest"` only scrolls when the row would otherwise be
     *  off-screen, so mouse-only users (highlighted index unchanged
     *  from filter reset) don't see the list jump as they hover. This
     *  is the canonical "keyboard-driven auto scroll" combobox
     *  behavior — pressing Arrow Down past the visible window pulls
     *  the next row in by one, never jumps the whole list. */
    useLayoutEffect(() => {
        if (!accountOpen) return;
        if (highlightedIndex < 0) return;
        const li = accountOptionRefs.current[highlightedIndex];
        // `scrollIntoView({ block: "nearest" })` is the standard
        // combobox primitive — does nothing when the row is already
        // visible inside the scroll container, scrolls by exactly the
        // amount needed to reveal a partially / fully off-screen row.
        li?.scrollIntoView({ block: "nearest" });
    }, [accountOpen, highlightedIndex]);

    /** Keyboard navigation handler bound to the autocomplete input.
     *  Implements the standard combobox key set (Arrow Up/Down, Enter,
     *  Escape) so users who prefer keyboard over mouse can pick an
     *  account without leaving the input. Each Arrow keystroke moves
     *  the cursor by one row; the layout effect above scrolls the
     *  newly-highlighted row into view. */
    const handleAccountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (accountInputDisabled) return;

        // ArrowDown / ArrowUp open the popover when it's closed
        // (matching native <select>). When already open they move
        // the highlight cursor by one, clamped to the list bounds.
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!accountOpen) {
                setAccountOpen(true);
                return;
            }
            setHighlightedIndex((idx) => {
                if (filteredAccounts.length === 0) return -1;
                return Math.min(filteredAccounts.length - 1, Math.max(idx, -1) + 1);
            });
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!accountOpen) {
                setAccountOpen(true);
                return;
            }
            setHighlightedIndex((idx) => {
                if (filteredAccounts.length === 0) return -1;
                return Math.max(0, idx - 1);
            });
        } else if (e.key === "Enter") {
            // Enter selects the currently-highlighted row. Only fires
            // when the popover is open and an actual row is highlighted
            // — a stray Enter (popover closed, input empty) shouldn't
            // submit the form (the form's Save button has its own
            // gating).
            if (!accountOpen) return;
            const opt = filteredAccounts[highlightedIndex];
            if (!opt) return;
            e.preventDefault();
            selectAccount(opt);
        } else if (e.key === "Escape") {
            // Close the popover but stop propagation so the parent
            // `<Dialog>` doesn't ALSO close the modal — Escape on a
            // combobox dismisses only the dropdown, never its host.
            if (accountOpen) {
                e.preventDefault();
                e.stopPropagation();
                setAccountOpen(false);
            }
        } else if (e.key === "Home") {
            if (!accountOpen) return;
            e.preventDefault();
            setHighlightedIndex(filteredAccounts.length > 0 ? 0 : -1);
        } else if (e.key === "End") {
            if (!accountOpen) return;
            e.preventDefault();
            setHighlightedIndex(
                filteredAccounts.length > 0 ? filteredAccounts.length - 1 : -1,
            );
        }
    };

    /** Validation predicates. The bank dropdown is required and the
     *  account picker must have a *selected* row (free-form typed
     *  text isn't valid — JEX gates the legacy Save on
     *  `acc_no_selected = $('#acc_no li.selected').length > 0`). */
    const isValid =
        bank !== null &&
        partnerId.trim().length > 0 &&
        partnerId.trim().length <= 20 &&
        vanCode.trim().length > 0 &&
        vanCode.trim().length <= 20 &&
        selectedAcctNo !== null &&
        selectedAcctNo.length > 0;

    const submitDisabled = !isValid || submitting;

    const handleSubmit = async () => {
        if (submitDisabled) return;
        if (!selectedBank || !selectedAcctNo) return;
        setSubmitting(true);
        try {
            await createFirmBankingSetting({
                out_bank_cd: selectedBank.outBankCd,
                wdrl_act_no: selectedAcctNo,
                bank_prtn_id: partnerId.trim(),
                van_org_cd: vanCode.trim(),
                org_stat: "1",
            });
            onCreated?.();
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t(
                    "settings.firm_banking_settings.create_success",
                ),
                onConfirm: onClose,
                onClose: onClose,
            });
        } catch (err) {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message =
                err instanceof Error ? err.message : t("common.error.unknown");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        } finally {
            setSubmitting(false);
        }
    };

    const accountInputDisabled = !selectedBank || submitting;
    /** What the autocomplete input renders. Once a row is selected
     *  the masked display label is locked into the input (the user
     *  cannot edit it without re-opening the picker); while the user
     *  is typing-to-filter we paint the query verbatim. */
    const accountInputValue = selectedAcctNo
        ? selectedDisplayLabel
        : accountQuery;

    const handleAccountInputClick = () => {
        if (accountInputDisabled) return;
        setAccountOpen(true);
        // Clicking back into the chip after a selection re-enters
        // search mode — clear the selection so the typed query
        // becomes the visible value and the dropdown shows the full
        // list again. Mirrors legacy comm_0220_002 behavior where
        // re-clicking the field re-opens the dropdown.
        if (selectedAcctNo) {
            setSelectedAcctNo(null);
            setSelectedDisplayLabel("");
            setAccountQuery("");
        }
    };

    const handleAccountInputChange = (next: string) => {
        if (accountInputDisabled) return;
        // Any typing implicitly clears the locked selection — the
        // user is searching again.
        if (selectedAcctNo) {
            setSelectedAcctNo(null);
            setSelectedDisplayLabel("");
        }
        setAccountQuery(next);
        setAccountOpen(true);
    };

    const selectAccount = (option: AccountLookupOption) => {
        setSelectedAcctNo(option.acctNo);
        setSelectedDisplayLabel(option.displayLabel);
        setAccountQuery("");
        setAccountOpen(false);
    };

    return (
        <Dialog
            open
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent
                stackLevel={2}
                hideClose
                className="max-w-[400px] rounded-2xl p-0"
            >
                <div className="flex w-full flex-col gap-6 px-4 py-6">
                    <DialogTitle asChild>
                        <h2 className="text-wb-16 font-semibold leading-[18px] text-wb-dark">
                            {t("settings.firm_banking_settings.new_firm_banking.title")}
                        </h2>
                    </DialogTitle>

                    <div className="flex flex-col gap-4">
                        <ModalField
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.bank_name",
                            )}
                        >
                            <div ref={bankWrapperRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setBankOpen((open) => !open)}
                                    aria-haspopup="listbox"
                                    aria-expanded={bankOpen}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md bg-white p-2 text-left text-wb-14 font-medium leading-4 shadow-wb-btn hover:bg-black/[0.02]",
                                        selectedBank
                                            ? "text-wb-ntrl-8"
                                            : "text-wb-ntrl-5",
                                    )}
                                >
                                    {selectedBank ? (
                                        <>
                                            <BankLogo
                                                bank={selectedBank.logo}
                                                bankName={t(selectedBank.labelKey)}
                                                bankCd={selectedBank.outBankCd}
                                                className="size-4 shrink-0"
                                            />
                                            <span className="flex-1 truncate">
                                                {t(selectedBank.labelKey)}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="flex-1 truncate">
                                            {t(
                                                "settings.firm_banking_settings.new_firm_banking.bank_name_placeholder",
                                            )}
                                        </span>
                                    )}
                                    <ChevronDown
                                        className="size-4 shrink-0 text-wb-ntrl-8"
                                        strokeWidth={2}
                                        aria-hidden
                                    />
                                </button>

                                {bankOpen && (
                                    <ul
                                        role="listbox"
                                        className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md bg-white p-1 shadow-wb-popup"
                                    >
                                        {SUPPORTED_BANKS.map((option) => {
                                            const isSelected = bank === option.key;
                                            return (
                                                <li key={option.key} role="option" aria-selected={isSelected}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setBank(option.key);
                                                            setBankOpen(false);
                                                        }}
                                                        className={cn(
                                                            "flex w-full cursor-pointer items-center gap-2 rounded p-2 text-left text-wb-14 font-medium leading-4 text-wb-ntrl-8 hover:bg-wb-bg-active",
                                                            isSelected && "bg-brand-soft",
                                                        )}
                                                    >
                                                        <BankLogo
                                                            bank={option.logo}
                                                            bankName={t(option.labelKey)}
                                                            bankCd={option.outBankCd}
                                                            className="size-4 shrink-0"
                                                        />
                                                        <span className="flex-1 truncate">
                                                            {t(option.labelKey)}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </ModalField>

                        <ModalField
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.partner_id",
                            )}
                            htmlFor={partnerIdId}
                        >
                            <ModalInput
                                id={partnerIdId}
                                value={partnerId}
                                onChange={(e) => setPartnerId(e.target.value)}
                                maxLength={20}
                                placeholder={t(
                                    "settings.firm_banking_settings.new_firm_banking.partner_id_placeholder",
                                )}
                                aria-label={t(
                                    "settings.firm_banking_settings.new_firm_banking.partner_id",
                                )}
                            />
                        </ModalField>

                        <ModalField
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.van_code",
                            )}
                            htmlFor={vanCodeId}
                        >
                            <ModalInput
                                id={vanCodeId}
                                value={vanCode}
                                onChange={(e) => setVanCode(e.target.value)}
                                maxLength={20}
                                placeholder={t(
                                    "settings.firm_banking_settings.new_firm_banking.van_code_placeholder",
                                )}
                                aria-label={t(
                                    "settings.firm_banking_settings.new_firm_banking.van_code",
                                )}
                            />
                        </ModalField>

                        <ModalField
                            label={t(
                                "settings.firm_banking_settings.new_firm_banking.withdrawal_account",
                            )}
                            htmlFor={wdrlActNoId}
                        >
                            <div ref={accountWrapperRef}>
                                <input
                                    id={wdrlActNoId}
                                    ref={accountInputRef}
                                    type="text"
                                    role="combobox"
                                    aria-haspopup="listbox"
                                    aria-expanded={accountOpen}
                                    aria-controls={wdrlActNoListId}
                                    aria-autocomplete="list"
                                    aria-activedescendant={
                                        accountOpen && highlightedIndex >= 0
                                            ? `${wdrlActNoListId}-opt-${highlightedIndex}`
                                            : undefined
                                    }
                                    autoComplete="off"
                                    value={accountInputValue}
                                    onChange={(e) => handleAccountInputChange(e.target.value)}
                                    onClick={handleAccountInputClick}
                                    onKeyDown={handleAccountKeyDown}
                                    onFocus={() => {
                                        if (!accountInputDisabled && !accountOpen) {
                                            setAccountOpen(true);
                                        }
                                    }}
                                    placeholder={
                                        selectedBank
                                            ? t(
                                                  "settings.firm_banking_settings.new_firm_banking.withdrawal_account_placeholder",
                                              )
                                            : t(
                                                  "settings.firm_banking_settings.new_firm_banking.bank_name_placeholder",
                                              )
                                    }
                                    aria-label={t(
                                        "settings.firm_banking_settings.new_firm_banking.withdrawal_account",
                                    )}
                                    disabled={accountInputDisabled}
                                    className={cn(
                                        "h-8 w-full rounded-md bg-white px-2 text-wb-14 font-medium leading-4 text-wb-ntrl-8 placeholder:text-wb-ntrl-5",
                                        "shadow-wb-outline outline-none",
                                        "focus:shadow-[0px_0px_0px_1px_var(--color-brand)]",
                                        accountInputDisabled
                                            ? "cursor-not-allowed bg-wb-bg-sidebar"
                                            : "cursor-text",
                                    )}
                                />

                            </div>

                            {/* Portal-rendered popover — anchored to the
                                input's bounding rect via `position: fixed`.
                                Mirrors the canonical pattern used by
                                <BalancePopover> + <ViewSettingPopover>:
                                escapes the modal's stacking + bounds, opens
                                upward when there isn't enough viewport room
                                below, max-height capped to the actual space
                                available so the list never spills off-screen.
                                **z-index nuance:** when this dialog is opened
                                from inside the Settings shell it runs at
                                `stackLevel=2` (DialogContent z-[61], overlay
                                z-[60] per CLAUDE.md). A portaled popover at
                                Tailwind's default `z-50` (= 50) sits BELOW
                                the modal panel's z-[61] and gets visually
                                clipped by it. We raise the popover to
                                `z-[100]` — the same tier as `<SystemDialog>`,
                                explicitly chosen to sit above every shadcn
                                stackLevel slot (current max L5 →
                                content z-[91]) so the dropdown is reliably
                                visible regardless of which modal level
                                hosted it. */}
                            {accountOpen && !accountInputDisabled && accountPopoverStyle &&
                                createPortal(
                                    /* `pointer-events-auto` is the
                                       load-bearing class here: Radix's
                                       `<Dialog>` uses `react-remove-scroll`,
                                       which sets `pointer-events: none` on
                                       <body> while the modal is open and
                                       grants `pointer-events: auto` only
                                       to the dialog content tree. A popover
                                       portaled to body sits OUTSIDE that
                                       tree and would otherwise inherit the
                                       block — items would render but every
                                       click + scroll would be swallowed.
                                       Explicitly opting in here restores
                                       interactivity without compromising
                                       the modal's outside-click contract. */
                                    <div
                                        ref={accountPopoverRef}
                                        style={accountPopoverStyle}
                                        className="pointer-events-auto z-[100] flex flex-col overflow-hidden rounded-md bg-white shadow-wb-popup"
                                    >
                                        <ul
                                            id={wdrlActNoListId}
                                            role="listbox"
                                            className="custom-scrollbar-y min-h-0 flex-1 overflow-y-auto p-1"
                                        >
                                            {accountLoading ? (
                                                <li
                                                    role="status"
                                                    className="rounded p-2 text-wb-13 font-medium text-wb-ntrl-6"
                                                >
                                                    {t(
                                                        "settings.firm_banking_settings.list.loading",
                                                    )}
                                                </li>
                                            ) : filteredAccounts.length === 0 ? (
                                                <li className="rounded p-2 text-wb-13 font-medium text-wb-ntrl-6">
                                                    {t(
                                                        "settings.firm_banking_settings.list.empty",
                                                    )}
                                                </li>
                                            ) : (
                                                filteredAccounts.map((option, idx) => {
                                                    const isSelected = selectedAcctNo === option.acctNo;
                                                    const isHighlighted = highlightedIndex === idx;
                                                    return (
                                                        <li
                                                            key={option.acctNo}
                                                            id={`${wdrlActNoListId}-opt-${idx}`}
                                                            ref={(el) => {
                                                                accountOptionRefs.current[idx] = el;
                                                            }}
                                                            role="option"
                                                            aria-selected={isSelected}
                                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                                        >
                                                            <button
                                                                type="button"
                                                                tabIndex={-1}
                                                                onClick={() => selectAccount(option)}
                                                                className={cn(
                                                                    "flex w-full cursor-pointer flex-col gap-0.5 rounded p-2 text-left",
                                                                    isHighlighted && "bg-wb-bg-active",
                                                                    isSelected && "bg-brand-soft",
                                                                )}
                                                            >
                                                                <span className="truncate text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                                                                    {option.displayLabel}
                                                                </span>
                                                                {(option.acctNickNm ?? option.acctNm) && (
                                                                    <span className="truncate text-wb-12 font-normal leading-4 text-wb-ntrl-6">
                                                                        {option.acctNickNm ?? option.acctNm}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </li>
                                                    );
                                                })
                                            )}
                                        </ul>
                                    </div>,
                                    document.body,
                                )
                            }
                        </ModalField>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className={cn(
                                "flex h-8 items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn",
                                submitting
                                    ? "cursor-not-allowed opacity-60"
                                    : "cursor-pointer hover:bg-black/[0.03]",
                            )}
                        >
                            {t("common.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitDisabled}
                            aria-busy={submitting}
                            className={cn(
                                "flex h-8 items-center justify-center rounded-md px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn",
                                submitDisabled
                                    ? "cursor-not-allowed bg-wb-ntrl-4"
                                    : "cursor-pointer bg-brand hover:bg-brand-hover",
                            )}
                        >
                            {submitting
                                ? t("common.saving")
                                : t("common.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
