"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

import enMessages from "@/locales/en.json";
import koMessages from "@/locales/ko.json";
import viMessages from "@/locales/vi.json";

/*
 * Lightweight in-house i18n — no runtime dep, Phase 1 scope only.
 *
 *   - Keys are flat dotted strings (`login.login_button`, `nav.banking`).
 *   - EN is the fallback; missing keys return the key itself so missing
 *     translations are obvious in the UI rather than silently empty.
 *   - Selection persists to localStorage under `wecms_locale`.
 *   - <html lang> is kept in sync for a11y.
 *
 * SSR: initial render on server uses DEFAULT_LOCALE. The client hydrates
 * from localStorage in useEffect and re-renders with the stored locale.
 * First-paint flash is acceptable for Sprint 0; upgrade to a cookie-driven
 * server-side variant once i18n leaves this scope.
 */

export type Locale = "EN" | "KO" | "VI";

export const LOCALES: readonly Locale[] = ["EN", "KO", "VI"] as const;
export const DEFAULT_LOCALE: Locale = "EN";
const STORAGE_KEY = "wecms_locale";

// The imported JSON is typed as a plain Record<string, string>.
type Messages = Record<string, string>;

const MESSAGES: Record<Locale, Messages> = {
    EN: enMessages as Messages,
    KO: koMessages as Messages,
    VI: viMessages as Messages,
};

const HTML_LANG: Record<Locale, string> = {
    EN: "en",
    KO: "ko",
    VI: "vi",
};

function isLocale(x: unknown): x is Locale {
    return x === "EN" || x === "KO" || x === "VI";
}

type LocaleContextValue = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    /**
     * Translate a key. `{var}` placeholders in the message are replaced by
     * matching entries in `vars`. Falls back to the English message, then to
     * the key itself, so misses are visible.
     */
    t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

    // Rehydrate from localStorage on mount (client-only).
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (isLocale(stored)) setLocaleState(stored);
        } catch {
            // private mode / quota — ignore
        }
    }, []);

    // Keep <html lang> in sync with the active locale for assistive tech.
    useEffect(() => {
        if (typeof document !== "undefined") {
            document.documentElement.lang = HTML_LANG[locale];
        }
    }, [locale]);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }, []);

    const t = useCallback<LocaleContextValue["t"]>(
        (key, vars) => {
            const raw =
                MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
            if (!vars) return raw;
            // Use a function replacement so `String.prototype.replaceAll`
            // does NOT apply `$&` / `$$` / `$'` / `` $` `` / `$N`
            // substitution patterns to the value. Without this, a value
            // containing `$&` (e.g. a blocked-chars string like
            // `<>'"@$&`) would leak the matched placeholder back into
            // the output as the literal `{name}`.
            return Object.entries(vars).reduce(
                (acc, [k, v]) => acc.replaceAll(`{${k}}`, () => String(v)),
                raw,
            );
        },
        [locale],
    );

    const value = useMemo<LocaleContextValue>(
        () => ({ locale, setLocale, t }),
        [locale, setLocale, t],
    );

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation(): LocaleContextValue {
    const ctx = useContext(LocaleContext);
    if (!ctx) {
        throw new Error("useTranslation() must be used inside <LocaleProvider>");
    }
    return ctx;
}
