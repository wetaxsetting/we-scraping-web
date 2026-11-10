/**
 * User preferences on the backend (`GET /me` → `lang_cd`, `PUT /me/preferences`) — API mode only.
 *
 * Language: `GET /me` answers the saved WeInvoice language, else the login language. The shell
 * applies it once after hydration (`serverLocale()`), and saves every later change
 * (`saveLanguage`) so the choice follows the user to other devices. `localStorage` (`wecms_locale`)
 * stays the per-browser cache read before login.
 */
import { DATA_SOURCE } from "@/lib/api/weinvoice/source";
import { wiPut } from "@/lib/api/weinvoice/http";
import type { Locale } from "@/lib/i18n";

const FROM_WIRE: Record<string, Locale> = { vi: "VI", en: "EN", ko: "KO" };

let serverLang: Locale | null = null;

/** Remember the language `GET /me` returned (`vi` / `en` / `ko`); unknown values are ignored. */
export function rememberServerLang(langCd: string | null | undefined): Locale | null {
    serverLang = (langCd && FROM_WIRE[langCd.toLowerCase()]) || serverLang;
    return serverLang;
}

/** Language the backend holds for this user, once `GET /me` has been read. */
export function serverLocale(): Locale | null {
    return serverLang;
}

/** Save the UI language on the backend. No-op in mock mode or when it is already the saved one. */
export async function saveLanguage(locale: Locale): Promise<void> {
    if (DATA_SOURCE !== "api" || locale === serverLang) return;
    await wiPut("/me/preferences", { langCd: locale.toLowerCase() });
    serverLang = locale;
}

/** Test helper: forget the remembered language. */
export function resetServerLang(): void {
    serverLang = null;
}
