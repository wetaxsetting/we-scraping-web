/**
 * Canonical client-side route constants. Every redirect / navigation target
 * that is reused across pages goes through this file so it can be refactored
 * from one place. Raw string paths should stay inside Next.js page/segment
 * files; cross-cutting navigation (logo, post-login redirect, module home
 * links) uses the named constants below.
 */

/**
 * "Home" — destination for the WeCMS logo and the post-login redirect.
 *
 * Today this resolves to the Banking landing page because that is the first
 * and only module. When a real cross-module home / overview page ships, only
 * this constant changes — the logo click and the login redirect automatically
 * follow.
 */
export const HOME_ROUTE = "/banking/account-inquiry";

/**
 * Default sub-page opened when the user clicks the Banking top menu.
 *
 * Intentionally a separate constant from {@link HOME_ROUTE} even though they
 * currently point to the same path: the two represent different user intents
 * ("take me home" vs. "take me to Banking") and are expected to diverge once
 * a cross-module home page exists.
 */
export const BANKING_HOME = "/banking/account-inquiry";

/**
 * Default sub-page opened when the user clicks the Payment top menu.
 *
 * Mirrors {@link BANKING_HOME}: when Payment grows a landing page, only this
 * constant changes — the top-nav item + any future dashboard card follow.
 */
export const PAYMENT_HOME = "/payment/approval-box";

/**
 * Default sub-page opened when the user clicks the Add-On Service top menu.
 *
 * Points at Sales e-Invoices today — the first (and only) Add-On screen.
 * When a cross-module Add-On landing page ships, only this constant changes.
 */
export const ADDON_HOME = "/addon/sales-einvoices";
