"use client";

/**
 * Static UI preview for NXiSAS secondary-auth modals.
 *
 * <p>Purpose: validate the WeCMS-styled modal UI/UX for OTP / Security
 * Question / CAPTCHA / Bank Credentials / Transfer Confirm BEFORE the
 * Phase B popup-bridge ports them to a live engine interception path.
 * Triggered by `?preview=nxisas` on the OAT page (see
 * {@link OwnAccountTransferPage}).
 *
 * <p>This file is **isolated** from the production flow:
 *
 * <ul>
 *   <li>No engine calls, no Spring calls, no localStorage writes.</li>
 *   <li>Confirm / Cancel both just close the modal — no side effects.</li>
 *   <li>The legacy `.layerCont` CSS path (see `app/nxisas-modals.css`)
 *       remains the Phase B fallback; this preview is parallel.</li>
 *   <li>Mock data is inline — never sent anywhere.</li>
 * </ul>
 *
 * <p>When Phase B opens, the popup-bridge picks each modal up
 * verbatim, swaps the mock data for real engine output via
 * `lib/nxisas/popup-bridge.ts` (designed in the previous audit), and
 * the Cancel/Confirm handlers route to the bundle's existing
 * body-delegated `.save`/`.cancel` click handler. The visual chrome
 * does not change.
 *
 * <p>Design constraints honoured:
 *   - shadcn `<Dialog>` + WeCMS tokens (no `.layerCont` styling)
 *   - `stackLevel={2}` overlays the composer's `stackLevel={1}`
 *   - `h-8` form controls (Figma 167:15759 spec — same as composer)
 *   - AddNewContact-style footer buttons (Settings standard)
 *   - All visible strings i18n'd in en/ko/vi
 */

import { useState } from "react";

import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/* ===================================================================
 *  Mock data — fixed across the preview so reviewers always see the
 *  same content. Never sent anywhere.
 * ================================================================= */

const MOCK_BANK_NM = "Shinhan VN";
const MOCK_LOGIN_ID = "WEBCASH01";

/** Mirrors the bundle's `_qna_template:472` (`#{QNA_LIST}` substitution
 *  point) — the engine seeds `<li data-val data-hiddenVal>` rows from
 *  the bank's saved Q&A list. */
const MOCK_QNA_QUESTIONS = [
    { value: "What is your mother's maiden name?",    hiddenValue: "Q01" },
    { value: "What was the name of your first pet?",  hiddenValue: "Q02" },
    { value: "What city were you born in?",           hiddenValue: "Q03" },
    { value: "What was your first school?",           hiddenValue: "Q04" },
];

/** Tiny inline SVG playing the role of `_captcha_template:427`
 *  `data:image/png;base64,#{IMG}`. Real captcha is a base64 PNG/SVG
 *  the engine streams back; this preview uses an obvious mock so a
 *  reviewer can see the slot is rendered correctly. */
const MOCK_CAPTCHA_DATA_URL =
    "data:image/svg+xml;utf8,"
    + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50">`
        + `<rect width="160" height="50" fill="#f3f4f6"/>`
        + `<text x="80" y="32" font-family="monospace" font-size="22"`
        + `      font-weight="700" text-anchor="middle"`
        + `      fill="#1f2937" letter-spacing="6">AB3X9K</text>`
        + `<line x1="10" y1="25" x2="150" y2="25" stroke="#9ca3af" stroke-width="1"/>`
        + `</svg>`,
    );

/**
 * Mock substitution values for the legacy
 * `_confirm_transfer_template` (nxisas_v2.js:619-774). Field names
 * mirror the legacy template's `#{…}` tokens verbatim so the Phase B
 * popup-bridge can drop in real engine output by replacing only this
 * record (no renderer change needed).
 *
 * <p>Visibility flags (`show*Area`) mirror the legacy template's
 * `style="#{XXX_AREA}"` placeholders — they're populated by
 * `nxisas_v2.js:1344-1509` (`run2ndCert` confirm branch) with
 * either an empty string (visible) or `display:none` (hidden),
 * per bank. Preview defaults flip ALL detail rows + OTP area on
 * so reviewers can see the densest layout; toggling them off would
 * exercise the conditional rendering.
 */
const MOCK_CONFIRM_TRANSFER = {
    // ----- Section 1: Sender Account Information -----
    senderAccount:     "Shinhan VN  700005285280  Current (VND)",     // #{SND_ACCT}
    transferAmount:    "1,000,000 ₫",                                  // #{TRNS_AMT}

    // ----- Section 2: Recipient Account Information -----
    recipientBank:     "IBK VN",                                       // #{RECP_BANK}
    recipientAcctNo:   "076400794420002",                              // #{RECP_ACCT_NO}
    recipientName:     "WEBCASH CO LTD",                               // #{RECP_NM}

    // ----- Section 3: Transaction Details -----
    showFeeStts:       true,                                           // #{TRNS_FEE_STTS_AREA}
    transferFeeStts:   "Sender pays",                                  // #{TRNS_FEE_STTS}
    showFeeAmt:        true,                                           // #{TRNS_FEE_AMT_AREA}
    feeAmount:         "5,000 ₫",                                      // #{TRNS_FEE_AMT}
    showRmrk:          true,                                           // #{TRNS_RMRK_AREA}
    remark:            "Internal funding",                             // #{TRNS_REMARK}
    showRmrkSender:    true,                                           // #{TRNS_RMRK_SENDER_AREA}
    remarkSender:      "Internal funding (sender memo)",               // #{TRNS_RMRK_SENDER}
    showRmrkRecp:      true,                                           // #{TRNS_RMRK_RECP_AREA}
    remarkRecipient:   "Internal funding (recipient memo)",            // #{TRNS_RMRK_RECP}

    // ----- Password / OTP wrapper -----
    showPwdArea:       true,                                           // #{PWD_AREA}
    showOtpPwdArea:    true,                                           // #{OTP_PWD_AREA}
    showTrnsPwdArea:   false,                                          // #{TRNS_PWD} hidden by default per legacy
    transactionCode:   "8XK29Z",                                       // #{ADDITIONAL_INFO} — token-displayed code
    userName:          MOCK_LOGIN_ID,                                  // #{USER_NAME}
};

/* ===================================================================
 *  Preview state — which modal is open (only one at a time).
 * ================================================================= */

type PreviewModalKind = null | "otp" | "qna" | "captcha" | "password" | "confirm";

/* ===================================================================
 *  Main exported component — trigger panel + active modal.
 * ================================================================= */

export default function NxisasSecondaryAuthPreview() {
    const [open, setOpen] = useState<PreviewModalKind>(null);
    const close = () => setOpen(null);

    return (
        <>
            <PreviewTriggerPanel onPick={setOpen} />

            {open === "otp"      && <OtpModal       open onClose={close} />}
            {open === "qna"      && <QnaModal       open onClose={close} />}
            {open === "captcha"  && <CaptchaModal   open onClose={close} />}
            {open === "password" && <PasswordModal  open onClose={close} />}
            {open === "confirm"  && <ConfirmModal   open onClose={close} />}
        </>
    );
}

/* ===================================================================
 *  Trigger panel — fixed bottom-right, DEV banner-styled. Only ever
 *  rendered when `?preview=nxisas` is in the URL (see
 *  OwnAccountTransferPage gating).
 * ================================================================= */

function PreviewTriggerPanel({
    onPick,
}: {
    onPick: (kind: PreviewModalKind) => void;
}) {
    return (
        <div
            // Fixed bottom-right card, amber border to make it obvious
            // this is a dev tool. z-30 keeps it under any open modal
            // (modals at stackLevel={2} → z-[60+]) but above page chrome.
            className="fixed bottom-4 right-4 z-30 flex flex-col gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 shadow-wb-card"
        >
            <p className="text-wb-12 font-semibold uppercase tracking-wider text-amber-900">
                DEV — NXiSAS modal preview
            </p>
            <div className="flex flex-col gap-1.5">
                <DevButton onClick={() => onPick("otp")}>     Open OTP </DevButton>
                <DevButton onClick={() => onPick("qna")}>     Open Security Question </DevButton>
                <DevButton onClick={() => onPick("captcha")}> Open CAPTCHA </DevButton>
                <DevButton onClick={() => onPick("password")}>Open Bank Credentials </DevButton>
                <DevButton onClick={() => onPick("confirm")}> Open Transfer Confirm </DevButton>
            </div>
        </div>
    );
}

function DevButton({
    onClick, children,
}: { onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex h-7 cursor-pointer items-center justify-start rounded-md bg-white px-2 text-wb-13 font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
        >
            {children}
        </button>
    );
}

/* ===================================================================
 *  Shared modal helpers — keep all 5 modals consistent.
 * ================================================================= */

type ModalShellProps = {
    open:    boolean;
    onClose: () => void;
};

/**
 * Field label slot mirroring the composer's {@code FieldLabel} —
 * keeps form rhythm consistent across composer + engine modals.
 */
function FieldLabel({
    text, required, children,
}: {
    text:      string;
    required?: boolean;
    children:  React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label
                className={cn(
                    "text-wb-13 font-medium text-wb-ntrl-8",
                    required && "after:ml-0.5 after:text-wb-status-rejected-text after:content-['*']",
                )}
            >
                {text}
            </label>
            {children}
        </div>
    );
}

/** Footer button pair — same class chain as Add New Contact
 *  ({@link AddNewContactDialog}) so every popup in WeCMS feels
 *  identical. Disabled-Confirm dims to opacity-60 (Settings standard). */
function FooterButtons({
    cancelLabel, confirmLabel, onCancel, onConfirm, confirmDisabled,
}: {
    cancelLabel:      string;
    confirmLabel:     string;
    onCancel:         () => void;
    onConfirm:        () => void;
    confirmDisabled?: boolean;
}) {
    return (
        <>
            <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {cancelLabel}
            </button>
            <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled}
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
                {confirmLabel}
            </button>
        </>
    );
}

/* ===================================================================
 *  OTP modal — mirrors bundle `_otp_template:384-415`.
 *  Required fields: `OTP` input (bundle: `input[name="res"]`).
 * ================================================================= */

function OtpModal({ open, onClose }: ModalShellProps) {
    const { t } = useTranslation();
    const [otp, setOtp] = useState("");
    const canConfirm = otp.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                stackLevel={2}
                className="max-w-[420px]"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <DialogHeader>
                    <DialogTitle>{t("own_account_transfer.engine.otp.title")}</DialogTitle>
                    <DialogDescription>
                        {t("own_account_transfer.engine.otp.subtitle", { bank: MOCK_BANK_NM })}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-4">
                    {/* OTP token illustration — bundle uses
                        `_otp_template:394` → `/assets_v2/images/common/OTP.jpg`.
                        Preview reuses the same asset for fidelity. */}
                    <div className="flex justify-center rounded-md bg-wb-bg-active p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets_v2/images/common/OTP.jpg"
                            alt=""
                            aria-hidden
                            className="h-20 w-auto object-contain"
                        />
                    </div>

                    <FieldLabel required text={t("own_account_transfer.engine.otp.label")}>
                        <Input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder={t("own_account_transfer.engine.otp.placeholder")}
                            className="h-8 py-2"
                            autoFocus
                        />
                    </FieldLabel>
                </DialogBody>

                <DialogFooter>
                    <FooterButtons
                        cancelLabel={t("own_account_transfer.engine.cancel")}
                        confirmLabel={t("own_account_transfer.engine.ok")}
                        onCancel={onClose}
                        onConfirm={onClose}
                        confirmDisabled={!canConfirm}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ===================================================================
 *  Security Question modal — mirrors bundle `_qna_template:450-496`.
 *  Required: question selection + answer.
 *  Bundle reads back via `.selectValue` + `.selected[data-hiddenval]`
 *  + `input[name='res']`.
 * ================================================================= */

function QnaModal({ open, onClose }: ModalShellProps) {
    const { t } = useTranslation();
    const [questionIdx, setQuestionIdx] = useState<number | null>(null);
    const [answer, setAnswer] = useState("");
    const canConfirm = questionIdx !== null && answer.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                stackLevel={2}
                className="max-w-[480px]"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <DialogHeader>
                    <DialogTitle>{t("own_account_transfer.engine.qna.title")}</DialogTitle>
                    {/* Legacy template renders bank-info + login-id as
                        two columns inside .top (`_qna_template:456-463`).
                        Refactor mirrors via the description slot. */}
                    <DialogDescription>
                        <span className="flex items-center justify-between gap-4">
                            <span>{MOCK_BANK_NM}</span>
                            <span className="text-wb-13 font-medium text-wb-ntrl-8">
                                {t("own_account_transfer.engine.qna.login_id")}{" "}
                                <strong className="font-semibold text-wb-ink">
                                    {MOCK_LOGIN_ID}
                                </strong>
                            </span>
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-4">
                    <FieldLabel required text={t("own_account_transfer.engine.qna.question_label")}>
                        <select
                            className="h-8 w-full rounded-[6px] bg-background px-2 text-wb-14 font-medium text-wb-ntrl-8 shadow-wb-outline outline-none transition-[color,box-shadow] focus-visible:shadow-wb-focus"
                            value={questionIdx ?? ""}
                            onChange={(e) => setQuestionIdx(e.target.value === "" ? null : Number(e.target.value))}
                        >
                            <option value="">
                                {t("own_account_transfer.engine.qna.question_placeholder")}
                            </option>
                            {MOCK_QNA_QUESTIONS.map((q, i) => (
                                <option key={q.hiddenValue} value={i}>
                                    {q.value}
                                </option>
                            ))}
                        </select>
                    </FieldLabel>

                    <FieldLabel required text={t("own_account_transfer.engine.qna.answer_label")}>
                        <Input
                            type="text"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder={t("own_account_transfer.engine.qna.answer_placeholder")}
                            className="h-8 py-2"
                        />
                    </FieldLabel>
                </DialogBody>

                <DialogFooter>
                    <FooterButtons
                        cancelLabel={t("own_account_transfer.engine.cancel")}
                        confirmLabel={t("own_account_transfer.engine.confirm")}
                        onCancel={onClose}
                        onConfirm={onClose}
                        confirmDisabled={!canConfirm}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ===================================================================
 *  CAPTCHA modal — mirrors bundle `_captcha_template:417-448`.
 *  Required: captcha answer (bundle: `input[name="res"]`).
 *  Real engine streams the captcha image as
 *  `data:image/{IMG_FORMAT};base64,{IMG}` — preview uses an inline
 *  SVG so the slot is visually verifiable.
 * ================================================================= */

function CaptchaModal({ open, onClose }: ModalShellProps) {
    const { t } = useTranslation();
    const [code, setCode] = useState("");
    const canConfirm = code.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                stackLevel={2}
                className="max-w-[420px]"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <DialogHeader>
                    <DialogTitle>{t("own_account_transfer.engine.captcha.title")}</DialogTitle>
                    <DialogDescription>
                        {t("own_account_transfer.engine.captcha.subtitle", { bank: MOCK_BANK_NM })}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-4">
                    <div className="flex justify-center rounded-md bg-wb-bg-active p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={MOCK_CAPTCHA_DATA_URL}
                            alt="CAPTCHA"
                            className="h-12 w-auto"
                        />
                    </div>

                    <FieldLabel required text={t("own_account_transfer.engine.captcha.label")}>
                        <Input
                            type="text"
                            inputMode="text"
                            autoComplete="off"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            placeholder={t("own_account_transfer.engine.captcha.placeholder")}
                            className="h-8 py-2"
                            autoFocus
                        />
                    </FieldLabel>
                </DialogBody>

                <DialogFooter>
                    <FooterButtons
                        cancelLabel={t("own_account_transfer.engine.cancel")}
                        confirmLabel={t("own_account_transfer.engine.ok")}
                        onCancel={onClose}
                        onConfirm={onClose}
                        confirmDisabled={!canConfirm}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ===================================================================
 *  Bank Credentials modal — mirrors bundle `_password_template:498-558`.
 *  Required: password input (`#CERT_INFO_DETL_CON`,
 *  `data-require="true"`). Optional: second password, "save" checkbox.
 *  Bundle disables the Login-ID rows (pre-filled from saved cert) —
 *  preview mirrors via `disabled` Input.
 * ================================================================= */

function PasswordModal({ open, onClose }: ModalShellProps) {
    const { t } = useTranslation();
    const [password, setPassword] = useState("");
    const [transferPwd, setTransferPwd] = useState("");
    const [save, setSave] = useState(false);
    const canConfirm = password.length > 0;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                stackLevel={2}
                className="max-w-[460px]"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <DialogHeader>
                    <DialogTitle>{t("own_account_transfer.engine.password.title")}</DialogTitle>
                    <DialogDescription>
                        {t("own_account_transfer.engine.password.subtitle", { bank: MOCK_BANK_NM })}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-4">
                    {/* Login-ID is pre-filled and disabled — mirrors
                        bundle's `CERT_INFO_CON_VAL` row (legacy template
                        line 522-525) where the cert harness already
                        knows the user's login ID. */}
                    <FieldLabel text={t("own_account_transfer.engine.password.login_id_label")}>
                        <Input
                            type="text"
                            value={MOCK_LOGIN_ID}
                            readOnly
                            disabled
                            className="h-8 bg-wb-bg-active py-2"
                        />
                    </FieldLabel>

                    <FieldLabel required text={t("own_account_transfer.engine.password.password_label")}>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t("own_account_transfer.engine.password.password_placeholder")}
                            className="h-8 py-2"
                            autoComplete="new-password"
                            autoFocus
                        />
                    </FieldLabel>

                    <FieldLabel text={t("own_account_transfer.engine.password.transfer_password_label")}>
                        <Input
                            type="password"
                            value={transferPwd}
                            onChange={(e) => setTransferPwd(e.target.value)}
                            placeholder={t("own_account_transfer.engine.password.transfer_password_placeholder")}
                            className="h-8 py-2"
                            autoComplete="new-password"
                        />
                    </FieldLabel>

                    {/* Save-password checkbox — bundle template line 547
                        emits `REG_CERT_INFO_DETL_CON_YN`. */}
                    <label className="flex cursor-pointer items-center gap-2 text-wb-13 font-medium text-wb-ink">
                        <input
                            type="checkbox"
                            checked={save}
                            onChange={(e) => setSave(e.target.checked)}
                            className="size-4 accent-brand"
                        />
                        {t("own_account_transfer.engine.password.save")}
                    </label>
                </DialogBody>

                <DialogFooter>
                    <FooterButtons
                        cancelLabel={t("own_account_transfer.engine.cancel")}
                        confirmLabel={t("own_account_transfer.engine.confirm")}
                        onCancel={onClose}
                        onConfirm={onClose}
                        confirmDisabled={!canConfirm}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ===================================================================
 *  Transfer Confirm modal — mirrors bundle `_confirm_transfer_template`
 *  (nxisas_v2.js:619-774). Engine renders this AFTER login to let the
 *  user double-check the parsed transfer details before final scrape
 *  submit. Some banks (IBK/Shinhan/Vietcom/KEBHana) require an OTP in
 *  the SAME modal — preview renders an OTP input slot.
 * ================================================================= */

/**
 * Transfer Confirmation modal — mirrors the legacy
 * `_confirm_transfer_template` at `nxisas_v2.js:619-774` SECTION FOR
 * SECTION:
 *
 *   1. Title bar           ← #{ML_TRNS_CONF} = "Transfer Confirmation"
 *   2. Sender Account      ← #{ML_SND_ACCT_INFO} group
 *        - Sender Account  ← #{ML_SND_ACCT} / #{SND_ACCT}
 *        - Transfer Amount ← #{ML_TRNS_AMT} / #{TRNS_AMT}
 *   3. Recipient Account   ← #{ML_RECP_ACCT_INFO} group
 *        - Recipient Bank  ← #{ML_RECP_BANK} / #{RECP_BANK}
 *        - Account No.     ← #{ML_RECP_ACCT_NO} / #{RECP_ACCT_NO}
 *        - Recipient Name  ← #{ML_RECP_NM} / #{RECP_NM}
 *   4. Transaction Details ← #{ML_TRNS_DETL} group
 *        Each row gated by a legacy visibility flag:
 *        - Transfer Fee    ← #{TRNS_FEE_STTS_AREA}
 *        - Fee Amount      ← #{TRNS_FEE_AMT_AREA}
 *        - Remarks         ← #{TRNS_RMRK_AREA}
 *        - Remarks Sender  ← #{TRNS_RMRK_SENDER_AREA}
 *        - Remarks Recip.  ← #{TRNS_RMRK_RECP_AREA}
 *   5. OTP / Password area ← #{PWD_AREA} wrapper
 *        - OTP block       ← #{OTP_PWD_AREA} / id="OTP_PWD"
 *             OTP Password input + (ID: <userName>) label
 *             + side-panel: Transaction Code label + ADDITIONAL_INFO
 *               value in brand-red — mirrors `.code-num.ml60` layout
 *        - Transfer Pwd    ← `style="display:none" id="TRNS_PWD"` —
 *             shown only when engine flips its style. (Preview keeps
 *             it hidden by default; flip MOCK_CONFIRM_TRANSFER.
 *             showTrnsPwdArea to true to exercise it.)
 *   6. Footer              ← btn-area
 *        - Cancel (.btn-st normal)         secondary
 *        - Confirm (.btn-st primary w340)  primary, WIDE — `w340`
 *          legacy class = 340px wide button. Refactor honours via
 *          `min-w-[260px]` (responsive cap fits in a 480px modal).
 *
 * <p>This UI mirrors `nxisas_v2.js _confirm_transfer_template`. The
 * old `.layerCont`-styled DOM template appended by the bundle into
 * `<body>` (see `nxisas_v2.js:1344-1509` `run2ndCert` confirm branch)
 * remains as the Phase B fallback. The React modal bridge will
 * reuse this exact structure once `hasSavedBankCert` flips and the
 * bundle starts emitting real confirm-modal events.
 *
 * <p>Visibility flags here use plain React conditionals; the bundle
 * uses inline `style="display:none"` substitution. Phase B's
 * `popup-bridge.ts` will translate bundle flags to React state.
 */
function ConfirmModal({ open, onClose }: ModalShellProps) {
    const { t } = useTranslation();
    const c = MOCK_CONFIRM_TRANSFER;
    const [otpPwd, setOtpPwd]   = useState("");
    const [trnsPwd, setTrnsPwd] = useState("");

    // Confirm enabled when every visible required password is filled.
    const otpFilled  = !c.showOtpPwdArea  || otpPwd.trim().length > 0;
    const trnsFilled = !c.showTrnsPwdArea || trnsPwd.trim().length > 0;
    const canConfirm = otpFilled && trnsFilled;

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent
                stackLevel={2}
                className="max-w-[520px]"
                aria-describedby={undefined}
                closeOnOutsideClick={false}
                closeOnEscape={false}
            >
                <DialogHeader>
                    <DialogTitle>
                        {t("own_account_transfer.engine.confirm_transfer.title")}
                    </DialogTitle>
                </DialogHeader>

                <DialogBody className="custom-scrollbar-y flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
                    {/* Section 1: Sender Account Information */}
                    <ConfirmSection title={t("own_account_transfer.engine.confirm_transfer.sender_section")}>
                        <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.sender_account")}>
                            {c.senderAccount}
                        </ConfirmRow>
                        <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.transfer_amount")}>
                            <strong className="font-semibold text-wb-ink">{c.transferAmount}</strong>
                        </ConfirmRow>
                    </ConfirmSection>

                    {/* Section 2: Recipient Account Information */}
                    <ConfirmSection title={t("own_account_transfer.engine.confirm_transfer.recipient_section")}>
                        <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.recipient_bank")}>
                            {c.recipientBank}
                        </ConfirmRow>
                        <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.recipient_acct_no")}>
                            {c.recipientAcctNo}
                        </ConfirmRow>
                        <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.recipient_name")}>
                            {c.recipientName}
                        </ConfirmRow>
                    </ConfirmSection>

                    {/* Section 3: Transaction Details (5 conditional rows) */}
                    <ConfirmSection title={t("own_account_transfer.engine.confirm_transfer.details_section")}>
                        {c.showFeeStts && (
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.transfer_fee")}>
                                {c.transferFeeStts}
                            </ConfirmRow>
                        )}
                        {c.showFeeAmt && (
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.fee_amount")}>
                                {c.feeAmount}
                            </ConfirmRow>
                        )}
                        {c.showRmrk && (
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.remarks")}>
                                {c.remark}
                            </ConfirmRow>
                        )}
                        {c.showRmrkSender && (
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.remarks_sender")}>
                                {c.remarkSender}
                            </ConfirmRow>
                        )}
                        {c.showRmrkRecp && (
                            <ConfirmRow label={t("own_account_transfer.engine.confirm_transfer.remarks_recipient")}>
                                {c.remarkRecipient}
                            </ConfirmRow>
                        )}
                    </ConfirmSection>

                    {/* PWD_AREA wrapper — OTP + Transfer-Password sub-sections */}
                    {c.showPwdArea && (
                        <>
                            {c.showOtpPwdArea && (
                                <ConfirmSection title="OTP">
                                    <div className="flex items-start gap-6">
                                        {/* Left: OTP input + ID label */}
                                        <div className="flex flex-1 flex-col gap-1.5">
                                            <FieldLabel
                                                required
                                                text={t("own_account_transfer.engine.confirm_transfer.otp_password")}
                                            >
                                                <Input
                                                    type="password"
                                                    autoComplete="one-time-code"
                                                    value={otpPwd}
                                                    onChange={(e) => setOtpPwd(e.target.value)}
                                                    className="h-8 py-2"
                                                    autoFocus
                                                />
                                            </FieldLabel>
                                            <p className="text-wb-12 font-medium text-wb-muted">
                                                {t("own_account_transfer.engine.confirm_transfer.id_label", {
                                                    userName: c.userName,
                                                })}
                                            </p>
                                        </div>

                                        {/* Right: Transaction Code (red, matches
                                            legacy `.code-num` styling). Engine
                                            populates from `ADDITIONAL_INFO`. */}
                                        <div className="flex flex-col gap-1.5">
                                            <p className="text-wb-13 font-medium text-wb-ntrl-8">
                                                {t("own_account_transfer.engine.confirm_transfer.transaction_code")}
                                            </p>
                                            <p className="text-wb-18 font-semibold tracking-wide text-wb-status-rejected-text">
                                                {c.transactionCode}
                                            </p>
                                        </div>
                                    </div>
                                </ConfirmSection>
                            )}
                            {c.showTrnsPwdArea && (
                                <ConfirmSection
                                    title={t("own_account_transfer.engine.confirm_transfer.transfer_password_section")}
                                >
                                    <FieldLabel
                                        required
                                        text={t("own_account_transfer.engine.confirm_transfer.transfer_password")}
                                    >
                                        <Input
                                            type="password"
                                            autoComplete="new-password"
                                            value={trnsPwd}
                                            onChange={(e) => setTrnsPwd(e.target.value)}
                                            placeholder={t("own_account_transfer.engine.confirm_transfer.enter_transfer_password")}
                                            className="h-8 py-2"
                                        />
                                    </FieldLabel>
                                    <p className="text-wb-12 font-medium text-wb-muted">
                                        {t("own_account_transfer.engine.confirm_transfer.id_label", {
                                            userName: c.userName,
                                        })}
                                    </p>
                                </ConfirmSection>
                            )}
                        </>
                    )}
                </DialogBody>

                {/* Footer — legacy `.btn-st primary confirm w340` → 340px
                    wide Confirm. Refactor honours via min-w-[260px] which
                    fits cleanly in the 520px max-w modal alongside Cancel. */}
                <DialogFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {t("own_account_transfer.engine.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={!canConfirm}
                        className="inline-flex h-8 min-w-[260px] cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {t("own_account_transfer.engine.confirm")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Group container for one `_confirm_transfer_template` section.
 * Legacy renders `<div class="form-cont"><div class="title">…</div>
 * <div class="ip-cont">rows…</div></div>` — refactor maps directly.
 */
function ConfirmSection({
    title, children,
}: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h3 className="text-wb-14 font-semibold text-wb-ink">{title}</h3>
            <div className="flex flex-col gap-2 text-wb-13">{children}</div>
        </section>
    );
}

/**
 * Single `.ip-list displayflex` row in legacy. `.name` left column
 * is fixed at 150px (the legacy form-list standard); value column
 * is flex-1.
 */
function ConfirmRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[150px_1fr] items-start gap-3">
            <dt className="text-wb-muted">{label}</dt>
            <dd className="text-wb-ink">{children}</dd>
        </div>
    );
}
