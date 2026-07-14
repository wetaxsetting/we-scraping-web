"use client";

import { useCallback, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import GdtCredentialsDialog, {
    type GdtCredentialsValues,
} from "@/components/shared/popups/GdtCredentialsDialog";
import { useGdtCredentialValidation } from "@/components/settings/login-credentials/useGdtCredentialValidation";
import { ApiCallError } from "@/lib/api/banking";
import {
    createGdtLoginCredential,
    updateGdtLoginCredential,
} from "@/lib/api/loginCredentials";
import { useTranslation } from "@/lib/i18n";

/* ============================================================================
 *  GDT "Account Management" flow — standalone, SettingsModal-independent.
 *
 *  Owns the GDT credential save flow (Figma parity: legacy
 *  `comm_0218_007.js`): validate the credentials through the LOCAL NXiSAS
 *  engine (GDT never uses Coocon), then persist ONLY on a successful
 *  login — POST for a new row, PUT to upsert an existing one. This is the
 *  exact logic that previously lived inline inside
 *  {@code LoginCredentialsPanel}; extracted here so BOTH entry points reuse
 *  it without duplicating business logic:
 *
 *    1. Settings → Login Credentials  (GDT institution click / kebab Edit)
 *    2. Card Transactions → Link Card Payments → "Go to GDT Login Info
 *       Setting"  (opens this dialog directly — no SettingsModal behind it)
 *
 *  The presentational dialog ({@link GdtCredentialsDialog}) is unchanged —
 *  same title / subtitle / login image / fields / validation / Next /
 *  Cancel / X / ESC. This wrapper only supplies the {@code onNext} save
 *  handler + the {@code nextDisabled} in-flight gate.
 * ========================================================================== */

export type GdtAccountManagementDialogProps = {
    /** SeqNo of an existing GDT credential when the tenant already has one
     *  — the save upserts (PUT) against it. `null` / omitted → create
     *  (POST). Callers that don't track the GDT row (e.g. the Link Card
     *  Payments empty-state, which only shows when GDT is NOT configured)
     *  pass `null`. */
    existingSeqNo?: number | null;
    /** The saved GDT login id (User Name) when a credential already
     *  exists — displayed read-only in the dialog's User Name field
     *  (edit mode). `null` / omitted in create mode. Legacy parity:
     *  `comm_0218_007.ts` prefills `#field-username` from
     *  `CERT_INFO_CON` and locks it once a GDT credential exists. */
    existingUserName?: string | null;
    /** Dismiss the dialog — wired to Cancel / X / ESC and run again after a
     *  successful save (once the user acknowledges the success dialog). */
    onClose: () => void;
    /** Fired after a successful save so the opener can refresh its view
     *  (Login Credentials list / Card Transactions GDT-config state). */
    onSaved?: () => void;
};

export default function GdtAccountManagementDialog({
    existingSeqNo,
    existingUserName,
    onClose,
    onSaved,
}: GdtAccountManagementDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [inFlight, setInFlight] = useState(false);

    // Edit mode = an existing GDT credential is being updated. Drives the
    // read-only User Name field (legacy comm_0218_007.ts:189-206 — the
    // "EDIT" branch prefills + locks `#field-username`). Create mode keeps
    // the User Name editable. Kept in sync with the POST-vs-PUT branch in
    // `handleNext` (both key off `existingSeqNo > 0`).
    const isEditMode = existingSeqNo != null && existingSeqNo > 0;

    // GDT credential validation against the LOCAL NXiSAS engine (legacy
    // parity — comm_0218_007.js). The dialog is conditionally mounted by
    // its caller, so the engine load + probe run only while it's open.
    const gdtValidation = useGdtCredentialValidation(true);

    /** Map a non-ready engine status to a guidance dialog (install /
     *  Windows-only / still-loading / engine fault). Returns true when a
     *  dialog was shown (engine NOT ready → caller must abort the save). */
    const showGdtEngineNotReady = useCallback((): boolean => {
        const status = gdtValidation.engineStatus;
        if (status === "ready") return false;
        const key =
            status === "not_installed"
                ? "settings.login_credentials.gdt.engine_not_installed"
                : status === "unsupported_os"
                  ? "settings.login_credentials.gdt.engine_unsupported_os"
                  : status === "loading" || status === "probing"
                    ? "settings.login_credentials.gdt.engine_loading"
                    : "settings.login_credentials.gdt.engine_error";
        // "loading"/"probing" are transient (please-wait) → warning; the
        // rest are blocking faults → error.
        const transient = status === "loading" || status === "probing";
        dialog.open({
            type: transient ? "warning" : "error",
            title: transient ? t("dialog.warning") : t("dialog.error"),
            description: t(key),
            errorCode: transient ? undefined : "WBE_NXISAS_ENGINE",
        });
        return true;
    }, [gdtValidation.engineStatus, dialog, t]);

    const handleNext = (values: GdtCredentialsValues) => {
        if (inFlight) return;
        // Legacy parity (comm_0218_007.js:43-95): the GDT save action IS the
        // login test. Validate through the LOCAL NXiSAS engine first;
        // persist ONLY on a successful login. The engine renders its own
        // CAPTCHA modal + runs the 3-try loop internally during validate().
        if (showGdtEngineNotReady()) return; // engine not ready → abort
        setInFlight(true);

        const finish = () => {
            onSaved?.();
            onClose();
        };
        const onSuccess = () => {
            dialog.open({
                type: "success",
                title: t("dialog.success"),
                description: t("settings.login_credentials.gdt.save_success"),
                onConfirm: finish,
                onClose: finish,
            });
        };
        const showMutationError = (err: unknown) => {
            const code = err instanceof ApiCallError ? err.code : "WBE9999";
            const message =
                err instanceof ApiCallError ? err.message : t("dialog.error");
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: message,
                errorCode: code,
            });
        };

        gdtValidation
            .validate(values.userName, values.password)
            .then((outcome) => {
                // CAPTCHA wrong 3x — legacy WBE6121. No save.
                if (outcome.captchaExceeded) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t(
                            "settings.login_credentials.gdt.captcha_exceeded",
                        ),
                        errorCode: "WBE6121",
                    });
                    return undefined;
                }
                // Bad credentials / non-success login. No save.
                if (!outcome.ok) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t(
                            "settings.login_credentials.gdt.login_failed",
                        ),
                        errorCode: outcome.errorCode || "WBE9999",
                    });
                    return undefined;
                }
                // Login succeeded → persist (pure DB upsert).
                const promise =
                    existingSeqNo != null && existingSeqNo > 0
                        ? updateGdtLoginCredential(existingSeqNo, {
                              login_id: values.userName,
                              password: values.password,
                          })
                        : createGdtLoginCredential({
                              login_id: values.userName,
                              password: values.password,
                          }).then(() => undefined);
                return promise.then(onSuccess).catch(showMutationError);
            })
            .catch(() => {
                // Engine / transport fault during the login test — surface
                // as an engine error, no save.
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t(
                        "settings.login_credentials.gdt.engine_error",
                    ),
                    errorCode: "WBE_NXISAS_ENGINE",
                });
            })
            .finally(() => setInFlight(false));
    };

    return (
        <GdtCredentialsDialog
            onCancel={onClose}
            nextDisabled={inFlight}
            onNext={handleNext}
            // Edit mode locks the User Name to the saved GDT id; create
            // mode leaves it editable. `initialValues` prefills the
            // read-only field so it renders the saved value (and so the
            // value is carried back verbatim on submit).
            userNameReadOnly={isEditMode}
            initialValues={
                isEditMode
                    ? { userName: existingUserName ?? "" }
                    : undefined
            }
        />
    );
}
