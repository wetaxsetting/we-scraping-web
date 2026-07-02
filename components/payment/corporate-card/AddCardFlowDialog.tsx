"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CaptchaDialog } from "@/app/(dashboard)/banking/credentials/CaptchaDialog";
import { OtpDialog } from "@/app/(dashboard)/banking/credentials/OtpDialog";
import { QnaDialog } from "@/app/(dashboard)/banking/credentials/QnaDialog";
import { useDialog } from "@/components/shared/dialog";
import LoginIdPasswordDialog, {
    type LoginIdPasswordValues,
} from "@/components/shared/popups/LoginIdPasswordDialog";
import SelectBankDialog from "@/components/shared/popups/SelectBankDialog";
import {
    BANK_CD_TO_HERO_LOGO_PATH,
    resolveBankLogoUrl,
    type BankOption,
} from "@/components/shared/popups/selectBankBanks";
import { ApiCallError } from "@/lib/api/banking";
import {
    submitScrapeCaptcha,
    submitScrapeOtp,
    submitScrapeQna,
    verifyScrape,
    type ApiQnaQuestion,
    type ApiScrapeSessionResponse,
} from "@/lib/api/bankCredentials";
import type { ApiScrapedCard } from "@/lib/types/api";
import { createScrapedCards } from "@/lib/api/cardTransactions";
import { fetchLoginCredentialBanks } from "@/lib/api/loginCredentials";
import { useTranslation } from "@/lib/i18n";

import type { ScrapedCardDraft } from "./addCardFlowTypes";
import SelectCardsDialog from "./SelectCardsDialog";

/** Palette for the bank-picker fallback initial chip — copied from
 *  LoginCredentialsPanel so the picker looks identical between the
 *  Add Bank flow and the Add Card flow. */
const BANK_FALLBACK_PALETTE = [
    "#0046AD", "#A21F2A", "#F5A623", "#0A3F8F",
    "#0073C6", "#C8102E", "#E1232E", "#0083B0",
    "#1A8754", "#7B1FA2", "#00838F", "#5D4037",
];

/**
 * Corporate-card registration is only supported for Shinhan and Woori
 * (legacy comm_0218_nxisas JOB="for card"). The Select Bank popup in
 * THIS flow must therefore list only these two — keyed on the legacy
 * {@code BANK_CD} (the same codes {@link resolveBankLogoUrl} maps).
 * Scoped to the Add Card flow only; the shared {@code SelectBankDialog}
 * and every other Select Bank consumer keep their full bank list.
 */
const CARD_REGISTRATION_BANKS: readonly { bankCd: string; name: string }[] = [
    { bankCd: "11704088", name: "Shinhan Bank" }, // Shinhan VN
    { bankCd: "11704020", name: "Woori Bank" },   // Woori VN
];

export type AddCardFlowDialogProps = {
    /** Closes the entire chain. */
    onClose:    () => void;
    /** Fired after at least one card is successfully registered. The
     *  parent (Card Management modal) uses it to refresh its list. */
    onSuccess?: () => void;
};

/**
 * Card Management &gt; Add Card &mdash; popup-chain state machine.
 * Mirrors legacy {@code comm_0218_nxisas} (JOB="for card") but uses
 * the API-based scrape path ({@code nxisas_api_v2.js} → backend
 * Coocon proxy) rather than the desktop {@code NXiSAS.exe} agent.
 *
 * <h2>Steps</h2>
 *
 * <ol>
 *   <li><b>Select Bank</b> (L3) — pick the issuing bank.</li>
 *   <li><b>Login ID/PW</b> (L3) — enter credentials; submit fires
 *       {@code POST /api/v1/banking/scraping/verify} with
 *       {@code scrape_kind: "CARD_INFO"}. Branches on response:
 *       <ul>
 *         <li>{@code COMPLETED}    → Step 3 with scraped cards</li>
 *         <li>{@code OTP_REQUIRED} → OtpDialog (L4); resume after OTP</li>
 *         <li>{@code QNA_REQUIRED} → QnaDialog (L4); resume after Q&amp;A</li>
 *         <li>{@code CAPTCHA_REQUIRED} → CaptchaDialog (L4); resume</li>
 *         <li>{@code ERROR}        → system error dialog + back to Login</li>
 *       </ul>
 *   </li>
 *   <li><b>Select Cards</b> (L4) — user picks which scraped cards to
 *       register; Save fires
 *       {@code POST /api/v1/payment/card-transactions/cards}.</li>
 * </ol>
 *
 * <h2>Stack levels</h2>
 *
 * <p>Card Management modal sits at L2 (it's a feature dialog opened
 * from a top-nav button). Bank-picker + Login dialogs run at L3. The
 * Select Cards dialog and challenge dialogs run at L4 so they paint
 * above the login form. Per CLAUDE.md §"Modal stacking convention".
 */
export default function AddCardFlowDialog({
    onClose,
    onSuccess,
}: AddCardFlowDialogProps) {
    const { t, locale } = useTranslation();
    const dialog = useDialog();

    /* ------------------------------------------------------------------
     *  Bank picker — fetched once on mount. Mirrors the mapping pattern
     *  used by LoginCredentialsPanel so the picker behaves identically
     *  between the Add Bank and Add Card flows.
     * ---------------------------------------------------------------- */

    const [liveBanks, setLiveBanks] = useState<readonly BankOption[] | null>(null);
    useEffect(() => {
        let cancelled = false;
        fetchLoginCredentialBanks()
            .then((res) => {
                if (cancelled) return;
                const mapped: BankOption[] = res.items.map((row, i) => ({
                    id:      row.bank_cd,
                    name:    row.bank_nm,
                    color:   BANK_FALLBACK_PALETTE[i % BANK_FALLBACK_PALETTE.length],
                    initial: (row.bank_nm.trim().charAt(0) || "?").toUpperCase(),
                    logoUrl: resolveBankLogoUrl(row.bank_cd, locale),
                }));
                setLiveBanks(mapped);
            })
            .catch(() => {
                // Transport failure — leave liveBanks as null so the
                // picker falls back to its static seed.
            });
        return () => { cancelled = true; };
    }, [locale]);

    /**
     * The bank list shown by the Select Bank popup for THIS flow — always
     * exactly the supported corporate-card banks (Shinhan / Woori). Built
     * from {@link CARD_REGISTRATION_BANKS} and enriched with the live
     * name/logo when the fetched list carries that bank; falls back to the
     * curated defaults otherwise. Passing a concrete array (never
     * {@code undefined}) also prevents {@code SelectBankDialog} from
     * dropping back to its static all-banks seed on a fetch failure.
     */
    const cardBanks = useMemo<BankOption[]>(
        () =>
            CARD_REGISTRATION_BANKS.map((b, i) => {
                const live = liveBanks?.find((l) => l.id === b.bankCd);
                const name = live?.name ?? b.name;
                return {
                    id:      b.bankCd,
                    name,
                    color:   BANK_FALLBACK_PALETTE[i % BANK_FALLBACK_PALETTE.length],
                    initial: (name.trim().charAt(0) || "?").toUpperCase(),
                    logoUrl: resolveBankLogoUrl(b.bankCd, locale),
                };
            }),
        [liveBanks, locale],
    );

    /* ------------------------------------------------------------------
     *  Step state machine.
     * ---------------------------------------------------------------- */

    type Step =
        | { kind: "bank" }
        | { kind: "login" }
        | { kind: "challenge"; challenge: ChallengeState }
        | { kind: "cards"; cards: ScrapedCardDraft[]; bankCertSeq: number | null };

    type ChallengeState = {
        sessionId:          string;
        kind:               "OTP" | "QNA" | "CAPTCHA";
        challengePrompt:    string | null;
        qnaQuestions:       ApiQnaQuestion[];
        captchaImage:       string | null;
        captchaImageFormat: string | null;
        loginValues:        LoginIdPasswordValues;
    };

    const [step, setStep] = useState<Step>({ kind: "bank" });
    const [searchValue, setSearchValue] = useState("");
    const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);
    const [inFlight, setInFlight] = useState(false);

    /* ------------------------------------------------------------------
     *  Scrape orchestration.
     * ---------------------------------------------------------------- */

    /** Translate Coocon's {@code cardType} into a localised display
     *  label. Handles three shapes the adapters return in practice:
     *    1. legacy two-char codes — {@code "01"} = credit, {@code "02"} = debit
     *    2. single-digit NXISAS codes — {@code "1"} / {@code "2"}, the
     *       shape legacy {@code card_0001_004.loadCard} maps
     *    3. free-text product names — e.g. WOORI's
     *       {@code "WOORI VISA DEBIT PLATINUM CORPORATE"} (case-
     *       insensitive substring match on "DEBIT" / "CREDIT").
     *  Unknown shapes fall back to a generic "Card" label so the cell
     *  never shows the long marketing string the bank returned. */
    const labelForCardType = useCallback(
        (code: string | null | undefined): string | null => {
            if (!code) return null;
            const u = code.trim().toUpperCase();
            if (!u) return null;
            if (u === "01" || u === "1" || u.includes("CREDIT")) {
                return t("payment.card.management.add_card.confirm.card_type.credit");
            }
            if (u === "02" || u === "2" || u.includes("DEBIT")) {
                return t("payment.card.management.add_card.confirm.card_type.debit");
            }
            return t("payment.card.management.add_card.confirm.card_type.generic");
        },
        [t],
    );

    /** Build the editable Card Name default for one scraped card.
     *  Preference order per the Figma Step-3 confirm table (which
     *  shows the real card product name, never a synthetic label):
     *    1. scraped holder name ({@code card_hldr_nm}) — legacy parity;
     *    2. scraped card product name ({@code card_nm}) — the actual
     *       name the card company registered (e.g. "KOCHAM(for
     *       Southern) VISA Corporate Credit");
     *    3. synthesised "{BankShortName} {last4}" (e.g. "Woori 5559")
     *       as the last resort so the editable cell is never blank.
     *  The user can keep or rename the draft via the pencil button
     *  inside SelectCardsDialog. */
    const defaultHolderName = useCallback(
        (raw: ApiScrapedCard): string => {
            const scraped = (raw.card_hldr_nm ?? "").trim();
            if (scraped) return scraped;
            const productName = (raw.card_nm ?? "").trim();
            if (productName) return productName;
            const last4 = digitsOnly(raw.card_no ?? "").slice(-4);
            const bank  = selectedBank ? bankShortName(selectedBank.name) : "";
            if (bank && last4) return `${bank} ${last4}`;
            if (last4) return last4;
            return bank;
        },
        [selectedBank],
    );

    const toCardDraft = useCallback(
        (raw: ApiScrapedCard, idx: number): ScrapedCardDraft => ({
            id:             `${raw.card_no ?? "card"}::${idx}`,
            cardNo:         raw.card_no ?? "",
            cardTypeCd:     raw.card_type_cd ?? "",
            cardTypeLabel:  labelForCardType(raw.card_type_cd),
            cardNm:         raw.card_nm,
            cardHldrNm:     defaultHolderName(raw),
            issuDt:         raw.issu_dt,
            expiDt:         raw.expi_dt,
            nxisasAcctType: raw.nxisas_acct_type,
            pymnAcctNo:     raw.pymn_acct_no,
        }),
        [defaultHolderName, labelForCardType],
    );

    /** Single funnel for every scrape-related response, called from
     *  every entry point (initial verify + OTP/QNA/CAPTCHA submit).
     *  Branches on {@code res.status}; on COMPLETED transitions to
     *  the Select Cards step, on a challenge transitions to the
     *  matching challenge dialog, on ERROR surfaces a dialog and
     *  returns to Login. */
    const applyScrapeResult = useCallback(
        (res: ApiScrapeSessionResponse, loginValues: LoginIdPasswordValues) => {
            if (res.status === "COMPLETED") {
                const cards = (res.cards ?? []).map(toCardDraft);
                if (cards.length === 0) {
                    dialog.open({
                        type:        "warning",
                        title:       t("dialog.warning"),
                        description: t("payment.card.management.add_card.error.no_cards_returned"),
                    });
                    setStep({ kind: "login" });
                    return;
                }
                setStep({ kind: "cards", cards, bankCertSeq: null });
                return;
            }
            if (res.status === "OTP_REQUIRED") {
                setStep({
                    kind: "challenge",
                    challenge: {
                        sessionId:          res.session_id ?? "",
                        kind:               "OTP",
                        challengePrompt:    res.challenge_prompt,
                        qnaQuestions:       [],
                        captchaImage:       null,
                        captchaImageFormat: null,
                        loginValues,
                    },
                });
                return;
            }
            if (res.status === "QNA_REQUIRED") {
                setStep({
                    kind: "challenge",
                    challenge: {
                        sessionId:          res.session_id ?? "",
                        kind:               "QNA",
                        challengePrompt:    res.challenge_prompt,
                        qnaQuestions:       res.qna_questions ?? [],
                        captchaImage:       null,
                        captchaImageFormat: null,
                        loginValues,
                    },
                });
                return;
            }
            if (res.status === "CAPTCHA_REQUIRED") {
                setStep({
                    kind: "challenge",
                    challenge: {
                        sessionId:          res.session_id ?? "",
                        kind:               "CAPTCHA",
                        challengePrompt:    res.challenge_prompt,
                        qnaQuestions:       [],
                        captchaImage:       res.captcha_image,
                        captchaImageFormat: res.captcha_image_format,
                        loginValues,
                    },
                });
                return;
            }
            // status === "ERROR" (or unrecognised).
            dialog.open({
                type:        "error",
                title:       t("dialog.error"),
                description: res.error_message
                    ?? t("payment.card.management.add_card.error.scrape_failed"),
                errorCode:   res.error_code ?? "WBE9999",
            });
            setStep({ kind: "login" });
        },
        [dialog, t, toCardDraft],
    );

    /* ------------------------------------------------------------------
     *  Shared error surface — referenced by every submit handler below
     *  via the useCallback's deps list. Declared as a const-bound
     *  useCallback so its identity is stable across renders (a
     *  function declaration here would be re-created each render and
     *  break the memoisation of the submit callbacks).
     * ---------------------------------------------------------------- */

    const showError = useCallback((err: unknown): void => {
        const code = err instanceof ApiCallError ? err.code : "WBE9999";
        const message = err instanceof ApiCallError
            ? err.message
            : t("payment.card.management.add_card.error.scrape_failed");
        dialog.open({
            type:        "error",
            title:       t("dialog.error"),
            description: message,
            errorCode:   code,
        });
    }, [dialog, t]);

    /* ------------------------------------------------------------------
     *  Submit handlers — every one of these terminates in
     *  applyScrapeResult().
     * ---------------------------------------------------------------- */

    const handleLoginSubmit = useCallback(
        async (values: LoginIdPasswordValues) => {
            if (!selectedBank || inFlight) return;
            setInFlight(true);
            try {
                const res = await verifyScrape({
                    bank_cd:          selectedBank.id,
                    login_id:         values.id,
                    password:         values.password,
                    nxisas_gb_seq_no: values.nxisasGbSeqNo,
                    extra:            values.extra || undefined,
                    login_type:       values.loginType || undefined,
                    scrape_kind:      "CARD_INFO",
                });
                applyScrapeResult(res, values);
            } catch (err) {
                showError(err);
            } finally {
                setInFlight(false);
            }
        },
        [applyScrapeResult, inFlight, selectedBank, showError],
    );

    const handleOtpSubmit = useCallback(
        async (value: string) => {
            if (step.kind !== "challenge") return;
            try {
                const res = await submitScrapeOtp(step.challenge.sessionId, value);
                applyScrapeResult(res, step.challenge.loginValues);
            } catch (err) {
                showError(err);
            }
        },
        [applyScrapeResult, showError, step],
    );

    const handleQnaSubmit = useCallback(
        async (payload: { hidden_value: string; question: string; answer: string }) => {
            if (step.kind !== "challenge") return;
            try {
                const res = await submitScrapeQna(step.challenge.sessionId, payload);
                applyScrapeResult(res, step.challenge.loginValues);
            } catch (err) {
                showError(err);
            }
        },
        [applyScrapeResult, showError, step],
    );

    const handleCaptchaSubmit = useCallback(
        async (value: string) => {
            if (step.kind !== "challenge") return;
            try {
                const res = await submitScrapeCaptcha(step.challenge.sessionId, value);
                applyScrapeResult(res, step.challenge.loginValues);
            } catch (err) {
                showError(err);
            }
        },
        [applyScrapeResult, showError, step],
    );

    /* ------------------------------------------------------------------
     *  Save selected cards.
     * ---------------------------------------------------------------- */

    const handleCardsSave = useCallback(
        async (rows: ScrapedCardDraft[]) => {
            if (!selectedBank || step.kind !== "cards" || inFlight) return;
            setInFlight(true);
            try {
                const res = await createScrapedCards({
                    bank_cd:       selectedBank.id,
                    bank_cert_seq: step.bankCertSeq ?? undefined,
                    // Per-field normalisation:
                    //  - card_type_cd: backend column is CHAR(2); the
                    //    bank scrape may return a free-text product
                    //    name (e.g. "WOORI VISA DEBIT PLATINUM
                    //    CORPORATE"). Reduce to the 2-char legacy code
                    //    matching wabooks.enums.CardTypes.
                    //  - issu_dt / expi_dt: backend columns are
                    //    VARCHAR(8) yyyyMMdd; the scrape may return
                    //    "2024-01-15" or similar — strip the dashes.
                    //  - card_nm: backend is VARCHAR(50); truncate
                    //    free-text product names so the long marketing
                    //    string at least lands in cardNm even when
                    //    cardTypeCd was reduced.
                    cards: rows.map((r) => ({
                        card_no:           r.cardNo,
                        card_type_cd:      normalizeCardTypeCd(r.cardTypeCd),
                        issu_dt:           normalizeYyyymmdd(r.issuDt) ?? undefined,
                        expi_dt:           normalizeYyyymmdd(r.expiDt) ?? undefined,
                        card_nm:           truncate(r.cardNm, 50) ?? undefined,
                        card_hldr_nm:      r.cardHldrNm.slice(0, 50),
                        nxisas_acct_type:  r.nxisasAcctType || undefined,
                        pymn_acct_no:      r.pymnAcctNo || undefined,
                    })),
                });
                dialog.open({
                    type:        "success",
                    title:       t("dialog.success"),
                    description: t(
                        "payment.card.management.add_card.success.detail",
                        { inserted: res.inserted_count, skipped: res.skipped_count },
                    ),
                });
                onSuccess?.();
                onClose();
            } catch (err) {
                showError(err);
            } finally {
                setInFlight(false);
            }
        },
        [dialog, inFlight, onClose, onSuccess, selectedBank, showError, step, t],
    );

    /* ------------------------------------------------------------------
     *  Render.
     * ---------------------------------------------------------------- */

    const bankHeroLogo = useMemo(() => {
        if (!selectedBank) return undefined;
        const path = BANK_CD_TO_HERO_LOGO_PATH[selectedBank.id];
        if (!path) return undefined;
        // Hero-sized logo (~160px width) to match the legacy
        // comm_0218_nxisas Select-Cards header look.
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={path} alt={selectedBank.name} className="h-10 w-auto" />;
    }, [selectedBank]);

    if (step.kind === "bank") {
        return (
            <SelectBankDialog
                stackLevel={3}
                value={searchValue}
                onChange={setSearchValue}
                onSelect={setSelectedBank}
                nextDisabled={!selectedBank}
                onNext={() => setStep({ kind: "login" })}
                onCancel={onClose}
                banks={cardBanks}
            />
        );
    }

    if (step.kind === "login" && selectedBank) {
        return (
            <LoginIdPasswordDialog
                key={`add-card-login-${selectedBank.id}`}
                stackLevel={3}
                bankName={selectedBank.name}
                bankCd={selectedBank.id}
                bankLogo={bankHeroLogo}
                onChooseAnotherBank={() => {
                    setSearchValue("");
                    setSelectedBank(null);
                    setStep({ kind: "bank" });
                }}
                onLogin={handleLoginSubmit}
                loginDisabled={inFlight}
                onCancel={onClose}
            />
        );
    }

    if (step.kind === "challenge") {
        const ch = step.challenge;
        if (ch.kind === "OTP") {
            return (
                <OtpDialog
                    prompt={ch.challengePrompt}
                    onSubmit={handleOtpSubmit}
                    onCancel={() => setStep({ kind: "login" })}
                />
            );
        }
        if (ch.kind === "QNA") {
            return (
                <QnaDialog
                    bankName={selectedBank?.name ?? ""}
                    loginId={ch.loginValues.id}
                    questions={ch.qnaQuestions}
                    onSubmit={handleQnaSubmit}
                    onCancel={() => setStep({ kind: "login" })}
                />
            );
        }
        // CAPTCHA
        return (
            <CaptchaDialog
                image={ch.captchaImage}
                format={ch.captchaImageFormat}
                onSubmit={handleCaptchaSubmit}
                onCancel={() => setStep({ kind: "login" })}
            />
        );
    }

    if (step.kind === "cards" && selectedBank) {
        return (
            <SelectCardsDialog
                bankName={selectedBank.name}
                cards={step.cards}
                saveDisabled={inFlight}
                onBack={() => setStep({ kind: "login" })}
                onSave={handleCardsSave}
            />
        );
    }

    return null;
}

/* --------------------------------------------------------------------
 *  Tiny pure helpers — module-scoped so they don't recreate per
 *  render and don't need to participate in any useCallback dep list.
 * ------------------------------------------------------------------ */

/** Short, title-case rendering of a bank's display name — takes the
 *  first whitespace-delimited token and capitalises just the first
 *  letter. "WOORI BANK" → "Woori", "Vietcombank" → "Vietcombank",
 *  "BIDV" → "Bidv". Used to seed the default Card Holder Name. */
function bankShortName(bankName: string): string {
    const first = bankName.trim().split(/\s+/)[0] ?? "";
    if (!first) return "";
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Strip everything except digits — used to lift the last-4 of a
 *  masked card number ("407465******5559" → "4074655559" → "5559"). */
function digitsOnly(value: string): string {
    return value.replace(/\D+/g, "");
}

/** Normalise the scraped {@code cardType} into the legacy 2-char
 *  code expected by {@code CARD_MSTR.CARD_TYPE_CD} (CHAR(2)).
 *
 *  Handles four shapes:
 *    - Already a 2-char code ("01" / "02") — pass through.
 *    - Single-digit NXISAS code ("1" / "2" — the shape legacy
 *      card_0001_004 receives) → "01" / "02".
 *    - Free-text product name containing "CREDIT" / "DEBIT" → "01" / "02".
 *    - Anything else → "01" (legacy default; sending an arbitrary
 *      long string would fail the backend `@Size(max=2)` validation).
 */
function normalizeCardTypeCd(raw: string | null | undefined): string {
    if (!raw) return "01";
    const u = raw.trim().toUpperCase();
    if (u === "01" || u === "02") return u;
    if (u === "1") return "01";
    if (u === "2") return "02";
    if (u.includes("CREDIT")) return "01";
    if (u.includes("DEBIT"))  return "02";
    return "01";
}

/** Normalise a possibly-dashed date string ("2024-01-15" /
 *  "20240115" / null) into yyyyMMdd or {@code null}. Truncates to 8
 *  chars to match {@code @Size(max = 8)} on the backend. */
function normalizeYyyymmdd(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D+/g, "");
    if (digits.length === 0) return null;
    return digits.slice(0, 8);
}

/** Bound a possibly-null string to the backend's @Size cap so a
 *  long marketing name still rides through on the wire without
 *  blowing the column width. */
function truncate(raw: string | null | undefined, max: number): string | null {
    if (!raw) return null;
    return raw.length <= max ? raw : raw.slice(0, max);
}
