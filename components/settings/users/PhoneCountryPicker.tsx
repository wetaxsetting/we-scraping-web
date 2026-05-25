"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { fetchCountries, type Country } from "@/lib/api/countries";
import { cn } from "@/lib/utils";

/**
 * Country / dial-code picker for the Telephone field in the
 * Settings > Users Add + Edit forms (Figma 142:17631 / 5300:31189).
 *
 * Data source: `GET /api/v1/common/countries` (refactor counterpart of
 * legacy JEX `comm_0110_001_r001`, backed by `NATN_INFM`). The API is
 * a generic directory of every country WeCMS knows about; this picker
 * applies a per-screen allow-list (`ALLOWED_ISO2`) so only the three
 * countries the live deployment supports on this form are surfaced —
 * Cambodia / South Korea / Vietnam, matching `wabooks.enums.NtnlCd` +
 * the commented-out filter at `comm_0110_001_r001_act.jsp:80-85`.
 * Other screens (overseas payment beneficiary country, contacts
 * overseas info, ...) consume the same endpoint with their own
 * allow-list.
 *
 * Layout matches the legacy popover: plain list, no search input, no
 * per-row checkmark — only the selected row's text turns blue.
 *
 * When the API is unreachable the picker falls back to the static
 * `FALLBACK_COUNTRIES` list below so the form still works offline.
 *
 * Uncontrolled-with-FormData per the rest of the form: an internal
 * hidden input carries the selected dial code (e.g. "84") so the
 * parent's `FormData` collector picks it up under `phoneCode`.
 */

/** Per-screen allow-list. ISO 3166-1 alpha-2 in lowercase. To surface
 *  a new country on the Settings > Users phone picker, add its code
 *  here (and ensure a matching row exists in `NATN_INFM` + a flag
 *  SVG under `public/assets/flag/`). */
const ALLOWED_ISO2: ReadonlySet<string> = new Set(["kh", "kr", "vn"]);

export type PhoneCountry = {
    /** ISO 3166-1 alpha-2 code (lowercase) — stable key. */
    iso2: string;
    /** Display name in English. Frontend can swap for a localized
     *  label when the backend ships one; project locale set is EN/KO/VI. */
    name: string;
    /** Dial code WITHOUT the leading "+" — matches the wire shape
     *  (`StoredUser.phoneCountryCode = "84"`). */
    dial: string;
    /** Filename under `/assets/flag/` (without `.svg`). */
    flag: string;
};

/** Static fallback used only when `GET /api/v1/common/countries` errors
 *  out. Already pre-filtered to `ALLOWED_ISO2` so offline-dev shows the
 *  same set as the live path. */
const FALLBACK_COUNTRIES: PhoneCountry[] = [
    { iso2: "kh", name: "Cambodia",    dial: "855", flag: "Cambodia" },
    { iso2: "kr", name: "South Korea", dial: "82",  flag: "South-Korea" },
    { iso2: "vn", name: "Vietnam",     dial: "84",  flag: "Vietnam" },
];

/** Known flag-asset basenames per ISO2. Used as a fallback when the API
 *  returns a country whose name doesn't kebab-case cleanly to an SVG. */
const FLAG_BY_ISO2: Record<string, string> = {
    kh: "Cambodia",
    kr: "South-Korea",
    vn: "Vietnam",
};

export function flagFor(iso2: string): string {
    return FLAG_BY_ISO2[iso2.toLowerCase()] ?? iso2.toLowerCase();
}

function toPhoneCountry(c: Country): PhoneCountry {
    return {
        iso2: c.iso2,
        name: c.name,
        dial: c.dial,
        flag: flagFor(c.iso2),
    };
}

/** Resolve a dial code (e.g. "84") to its country entry. Falls back to
 *  Vietnam — the WeCMS default tenant locale — when the value is unknown
 *  or empty so the trigger always has something to render. */
function resolveCountry(
    countries: PhoneCountry[],
    dial: string | undefined | null,
): PhoneCountry {
    const trimmed = (dial ?? "").replace(/^\+/, "").trim();
    return (
        countries.find((c) => c.dial === trimmed) ??
        countries.find((c) => c.iso2 === "vn") ??
        countries[0]
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
    const [countries, setCountries] = useState<PhoneCountry[]>(FALLBACK_COUNTRIES);
    const [selected, setSelected] = useState<PhoneCountry>(
        () => resolveCountry(FALLBACK_COUNTRIES, defaultValue),
    );
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fetch the country directory on mount, then filter to the
    // per-screen allow-list. Falls back to the static seed when the
    // API is unreachable (offline-dev graceful degradation).
    useEffect(() => {
        let cancelled = false;
        fetchCountries()
            .then((rows) => {
                if (cancelled) return;
                const mapped = rows
                    .filter((c) => ALLOWED_ISO2.has(c.iso2.toLowerCase()))
                    .map(toPhoneCountry);
                if (mapped.length === 0) return;
                setCountries(mapped);
                setSelected((current) => {
                    const stillThere = mapped.find((c) => c.iso2 === current.iso2);
                    return stillThere ?? resolveCountry(mapped, defaultValue);
                });
            })
            .catch(() => {
                /* Keep FALLBACK_COUNTRIES — offline-dev graceful degradation. */
            });
        return () => {
            cancelled = true;
        };
        // `defaultValue` is the seed value at mount; downstream re-syncs
        // happen via the `selected` state so we don't refire on every
        // parent re-render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                className="flex h-8 w-[85px] cursor-pointer items-center gap-1 rounded-l-md bg-white px-2 shadow-wb-outline hover:bg-black/[0.02]"
            >
                <img
                    src={`/assets/flag/${selected.flag}.svg`}
                    alt=""
                    aria-hidden
                    className="size-4 shrink-0 rounded-sm object-cover"
                    onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                    }}
                />
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
                    {countries.map((country) => {
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
                                    <img
                                        src={`/assets/flag/${country.flag}.svg`}
                                        alt=""
                                        aria-hidden
                                        className="size-4 shrink-0 rounded-sm object-cover"
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                                        }}
                                    />
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
