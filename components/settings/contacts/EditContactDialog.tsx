"use client";

import { useEffect, useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { useTranslation } from "@/lib/i18n";

import AddNewContactDialog from "./AddNewContactDialog";
import { toFormValues } from "./mappers";
import type { ContactFormValues, ContactRow } from "./types";
import { useContactsMutations } from "./useContacts";

type EditContactDialogProps = {
    /** `TRCO_KEY` of the row being edited. Used for the detail GET +
     *  the PUT path segment. */
    trcoKey: string;
    /** List-row data — used to seed the form for the brief window
     *  before the detail GET resolves so the dialog never opens fully
     *  empty. Replaced by the resolved detail once it arrives. */
    fallback: ContactRow;
    onClose: () => void;
    /** Fires after a successful PUT — host refetches and dismisses. */
    onSaved?: () => void | Promise<void>;
};

/**
 * Edit Contact dialog — Figma 12346:165870.
 *
 * Wired to `GET /api/v1/settings/contacts/{trcoKey}` (detail seed) +
 * `PUT /api/v1/settings/contacts/{trcoKey}` (save). Renders the same
 * form chrome as `<AddNewContactDialog>` because both Figma frames
 * (12346:165800 / 12346:165870) specify byte-for-byte identical
 * layouts — only the title and the seed data differ.
 *
 * <p>While the detail GET is in flight, the dialog mounts with a
 * fallback `ContactFormValues` derived from the row clicked in the
 * list. The detail response replaces the fallback once it lands
 * (the inner `<AddNewContactDialog>`'s `useEffect` re-seeds on
 * `initialValues` change). On detail-fetch failure we surface the
 * error and close the dialog so the user can retry from the row
 * action menu.
 */
export default function EditContactDialog({
    trcoKey,
    fallback,
    onClose,
    onSaved,
}: EditContactDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const mutations = useContactsMutations();

    const [values, setValues] = useState<ContactFormValues>(() =>
        deriveFallbackValues(fallback),
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const detail = await mutations.loadDetail(trcoKey);
                if (cancelled) return;
                const formValues = toFormValues(detail);
                setValues(formValues);
            } catch (e: unknown) {
                if (cancelled) return;
                const ex = e as ApiCallError;
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: ex.message,
                    errorCode: ex.code,
                });
                onClose();
            }
        })();
        return () => {
            cancelled = true;
        };
        // trcoKey is stable across the dialog's lifetime (keyed in
        // parent); mutations / dialog / t are stable callbacks.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trcoKey]);

    return (
        <AddNewContactDialog
            mode="edit"
            trcoKey={trcoKey}
            initialValues={values}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

/**
 * Minimal fallback seed — every required field carries the list
 * row's value, every nested block stays empty. Replaced by
 * `toFormValues(detail)` as soon as the detail GET resolves.
 */
function deriveFallbackValues(row: ContactRow): ContactFormValues {
    return {
        contactCode: row.contactCode,
        contactName: row.contactName,
        contactEnglishName: "",
        taxId: row.taxId,
        location: row.location,
        accounts: row.location === "local"
            ? [
                {
                    id: `fallback-${row.id}`,
                    bank: row.deposit.bankName,
                    bankCd: "",
                    bankDiv: "",
                    bankStatus: "",
                    currency: "VND",
                    accountNo: row.deposit.accountNo,
                    recipient: "",
                    lookupVerified: false,
                },
            ]
            : [],
        overseas: {
            beneficiaryName: row.location === "overseas" ? row.deposit.bankName : "",
            swiftCode: row.location === "overseas" ? row.deposit.accountNo : "",
            beneficiaryAccountNo: "",
            beneficiaryBankName: "",
            beneficiaryBankCode: "",
            beneficiaryAddress: "",
        },
        address: row.addresses[0] ?? "",
        changedAddress: "",
        validTill: "",
    };
}
