"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Country / dial-code picker for the Telephone field in the
 * Settings > Users Add + Edit forms (Figma 142:17631 / 5300:31189).
 *
 * Legacy parity — JEX WeCMS User Management `comm_0190_003`
 * (`WECMS_STATIC/ts-src/.../comm_0190_003.ts:161`): the legacy form
 * surfaces a country dial-code dropdown next to a free-form phone input
 * with a FIXED, HARDCODED three-country allow-list (`ALLOW_NATN_NUM`),
 * renders the country NAME in the list, and shows only the dial code in
 * the collapsed control. No flags, no ISO labels.
 *
 * IMPORTANT — fixed list, NOT API-driven. An earlier revision sourced
 * the three countries from `GET /api/v1/common/countries` filtered to an
 * allow-list. The country master (`NATN_INFM`) has no South Korea row,
 * so the API path silently returned only Vietnam + Cambodia and dropped
 * +82. The supported set is a product constant, so this picker now uses
 * the hardcoded `SUPPORTED_COUNTRIES` below as the single source of
 * truth — exactly as legacy `comm_0190_003` hardcodes `ALLOW_NATN_NUM`.
 * Do NOT reintroduce an API fetch that can omit a supported country.
 *
 * The picker always renders exactly these three, in this order:
 *
 *   1. +82  South Korea
 *   2. +84  Vietnam
 *   3. +855 Cambodia
 *
 * Display rules:
 *   · collapsed control shows the dial code only (e.g. `+84`);
 *   · the dropdown list shows the dial code + country name;
 *   · dial codes are normalised to significant digits — legacy stores
 *     the zero-padded `+0084` form, but the control shows the clean
 *     `+84` (`+0082 → +82`, `+0084 → +84`, `+0855 → +855`).
 *
 * Uncontrolled-with-FormData per the rest of the form: an internal
 * hidden input carries the selected dial code (e.g. "84") so the
 * parent's `FormData` collector picks it up under `phoneCode`.
 *
 * NOTE on persistence: legacy concatenates the dial code into the saved
 * `CLPH_NO` (stored encrypted at rest). The refactor's `clph_no` split +
 * write-back is a separate, backend-coordinated concern (`mapUserRow` /
 * `toCreateRequest` — see types.ts) and is NOT changed here. This
 * component only governs the dropdown UI.
 */

export type PhoneCountry = {
    /** ISO 3166-1 alpha-2 code (lowercase) — stable key. */
    iso2: string;
    /** Display name in English. */
    name: string;
    /** Dial code WITHOUT the leading "+" and without zero-padding
     *  (e.g. "82", "84", "855") — matches the wire shape
     *  (`StoredUser.phoneCountryCode = "84"`). */
    dial: string;
};

/** Canonical, fixed list of supported countries — the single source of
 *  truth for both the set and the display order. Ordered by ascending
 *  dial code: +82 → +84 → +855. */
const SUPPORTED_COUNTRIES: readonly PhoneCountry[] = [
    { iso2: "kr", name: "South Korea", dial: "82" },
    { iso2: "vn", name: "Vietnam",     dial: "84" },
    { iso2: "kh", name: "Cambodia",    dial: "855" },
];

/** Normalise a raw dial value to its significant digits: strips a
 *  leading "+" and any zero-padding so the legacy `+0084` / `0084`
 *  forms render as the clean `84`. */
function normalizeDial(raw: string | undefined | null): string {
    const digits = (raw ?? "").replace(/\D/g, "");
    return digits.replace(/^0+/, "") || digits;
}

/** Resolve a dial code (e.g. "84") to its country entry. Falls back to
 *  Vietnam — the WeCMS default tenant locale — when the value is unknown
 *  or empty so the trigger always has something to render. */
function resolveCountry(dial: string | undefined | null): PhoneCountry {
    const trimmed = normalizeDial(dial);
    return (
        SUPPORTED_COUNTRIES.find((c) => c.dial === trimmed) ??
        SUPPORTED_COUNTRIES.find((c) => c.iso2 === "vn") ??
        SUPPORTED_COUNTRIES[0]
    );
}

type Props = {
    /** Form name for the hidden input that ships the selected dial code. */
    name: string;
    /** Initial dial code without "+" (e.g. "84"). */
    defaultValue?: string;
};

export default function PhoneCountryPicker({ name, defaultValue }: Props) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<PhoneCountry>(
        () => resolveCountry(defaultValue),
    );
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close on click-outside + Escape.
    useEffect(() => {
        if (!open) return;
        function onClick(e: MouseEvent) {
            if (!wrapperRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    function pick(country: PhoneCountry) {
        setSelected(country);
        setOpen(false);
    }

    return (
        <div ref={wrapperRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-8 w-[72px] cursor-pointer items-center gap-1 rounded-l-md bg-white px-2 shadow-wb-outline hover:bg-black/[0.02]"
            >
                <span className="flex-1 text-left text-wb-14-tight font-medium text-wb-ink">
                    +{selected.dial}
                </span>
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 text-wb-ntrl-6 transition-transform",
                        open && "rotate-180",
                    )}
                    strokeWidth={2}
                />
            </button>
            <input type="hidden" name={name} value={selected.dial} />

            {open ? (
                <ul
                    role="listbox"
                    className="absolute left-0 top-[calc(100%+4px)] z-50 w-[220px] rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card"
                >
                    {SUPPORTED_COUNTRIES.map((country) => {
                        const isActive = country.iso2 === selected.iso2;
                        return (
                            <li key={country.iso2}>
                                <button
                                    type="button"
                                    onClick={() => pick(country)}
                                    className={cn(
                                        "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-black/[0.03]",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "w-12 shrink-0 text-wb-13 font-medium",
                                            isActive ? "text-brand" : "text-wb-ink",
                                        )}
                                    >
                                        +{country.dial}
                                    </span>
                                    <span
                                        className={cn(
                                            "flex-1 truncate text-wb-13 font-normal",
                                            isActive ? "text-brand" : "text-wb-ink",
                                        )}
                                    >
                                        {country.name}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : null}
        </div>
    );
}
