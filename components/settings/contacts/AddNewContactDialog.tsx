"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    ChevronDown,
    Plus,
    Search,
    Trash2,
    UserRound,
    X,
} from "lucide-react";

import DateField from "@/components/shared/DateField";
import { useDialog } from "@/components/shared/dialog";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { ApiCallError } from "@/lib/api/banking";
import { useTranslation } from "@/lib/i18n";
import type { ApiContactBankRow } from "@/lib/types/api";
import { cn } from "@/lib/utils";

import { AttachmentsSection } from "./AttachmentsSection";
import { emptyAccount } from "./mappers";

/** ISO `YYYY-MM-DD` for tomorrow in the user's local timezone.
 *  Mirrors the legacy `moment().add(1,'days').format('YYYYMMDD')`
 *  that legacy `comm_0184_002.ts` stamps as the default Valid Till
 *  on a fresh changed-address row. */
function tomorrowIsoLocal(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

/** Chip format — `2026-05-14` → `14-05-2026`. Matches the legacy
 *  Add/Edit dialog's DD-MM-YYYY display (see the live JEX popup at
 *  `dev.wecms.vn/fnsh_0001_001.act`). */
function formatValidTillChip(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return iso;
    return `${m[3]}-${m[2]}-${m[1]}`;
}
import { validateContact } from "./schema";
import type {
    ContactFormValues,
    ContactLocation,
    DepositAccountFormValues,
} from "./types";
import { useContactsMutations } from "./useContacts";

type AddNewContactDialogProps = {
    onClose: () => void;
    /** Fires after a successful POST / PUT — host refetches and dismisses. */
    onSaved?: () => void | Promise<void>;
    /**
     * Dialog variant. Same UI / layout / spacing / behaviour for both
     * modes — Edit only differs in (1) the title ("Edit Contact"),
     * (2) the initial form state, and (3) the wire call (PUT vs POST).
     */
    mode?: "add" | "edit";
    /** Required when `mode="edit"` — backend identity travels via the
     *  `{trcoKey}` path segment. */
    trcoKey?: string;
    /** Seed values for `mode="edit"`. */
    initialValues?: ContactFormValues;
};

/**
 * Add / Edit Contact dialog — Figma 9194:10938 / 12346:165870.
 *
 * Wired to `POST /api/v1/settings/contacts` (add) /
 * `PUT /api/v1/settings/contacts/{trcoKey}` (edit). Mirrors legacy
 * `comm_0184_002` end-to-end:
 *
 * <ul>
 *   <li>Bank picker — typeahead over `GET /banks` (NAPAS + CITAD)</li>
 *   <li>Recipient flow — verified (Lookup) when bank status='Y' AND
 *       currency='VND'; manual otherwise (status='N' or currency='USD')</li>
 *   <li>Tax ID — 10 or 13 digits when present (inline `MSG3`)</li>
 *   <li>Contact Code — no spaces (strip on input/paste)</li>
 *   <li>Add another account — clone last card (Local) or last overseas
 *       block (Overseas)</li>
 *   <li>Delete account — refuse to drop below 1 card</li>
 *   <li>(Changed) Address with Valid Till date</li>
 *   <li>WBE_CONTACTS_HAND_KEY_DUP → MSG1 (duplicate Contact Code) /
 *       WBE_CONTACTS_TAX_ID_DUP → MSG2 (duplicate Tax ID) — inline;
 *       other codes route to shared error dialog</li>
 * </ul>
 *
 * Per CTO directive 2026-05-08 the wire is lowercase snake_case;
 * `./mappers.toCreateRequest` / `toUpdateRequest` translate this
 * dialog's camelCase form values to the wire shape.
 */
export default function AddNewContactDialog({
    onClose,
    onSaved,
    mode = "add",
    trcoKey,
    initialValues,
}: AddNewContactDialogProps) {
    const { t } = useTranslation();
    const dialog = useDialog();
    const mutations = useContactsMutations();
    const isEdit = mode === "edit";

    // Empty seed — legacy popup opens with one blank deposit-account
    // card (Local) or one blank overseas block; the user fills it in.
    // Add-mode pre-fills the dialog only structurally (no demo data).
    const seed = useMemo<ContactFormValues>(() => {
        if (initialValues) return initialValues;
        return {
            contactCode: "",
            contactName: "",
            // Legacy `comm_0184_002.ts:462` sends TRCO_CMNM verbatim
            // as TRCO_CMENM; the mapper here does the same (falls back
            // to contactName), so we leave the form value empty.
            contactEnglishName: "",
            taxId: "",
            location: "local",
            accounts: [emptyAccount("acc-seed-0")],
            overseas: {
                beneficiaryName: "",
                swiftCode: "",
                beneficiaryAccountNo: "",
                beneficiaryBankName: "",
                beneficiaryBankCode: "",
                beneficiaryAddress: "",
            },
            address: "",
            changedAddress: "",
            validTill: "",
        };
    }, [initialValues]);

    const [contactCode, setContactCode] = useState(seed.contactCode);
    const [contactName, setContactName] = useState(seed.contactName);
    const [taxId, setTaxId] = useState(seed.taxId);
    const [location, setLocation] = useState<ContactLocation>(seed.location);
    const [accounts, setAccounts] = useState<DepositAccountFormValues[]>(seed.accounts);
    const [overseasList, setOverseasList] = useState<OverseasDraft[]>(() =>
        seed.location === "overseas"
            ? [
                {
                    id: `ov-seed-${Date.now()}`,
                    beneficiaryName: seed.overseas.beneficiaryName,
                    swiftCode: seed.overseas.swiftCode,
                    beneficiaryAccountNo: seed.overseas.beneficiaryAccountNo,
                    beneficiaryBankName: seed.overseas.beneficiaryBankName,
                    beneficiaryBankCode: seed.overseas.beneficiaryBankCode,
                    beneficiaryAddress: seed.overseas.beneficiaryAddress,
                },
            ]
            : [emptyOverseasDraft("ov-seed-0")],
    );
    const [address, setAddress] = useState(seed.address);
    const [changedAddressOpen, setChangedAddressOpen] = useState(
        seed.changedAddress.trim().length > 0,
    );
    const [changedAddress, setChangedAddress] = useState(seed.changedAddress);
    const [validTill, setValidTill] = useState(seed.validTill);
    const [deletedAccountKeys, setDeletedAccountKeys] = useState<string[]>([]);
    const [deletedOverseasKeys, setDeletedOverseasKeys] = useState<string[]>([]);

    /**
     * Add-mode only — files staged in the picker before Create
     * resolves the new {@code trcoKey}. After the POST succeeds, the
     * dialog uploads each staged file sequentially (per legacy
     * `comm_0184_002` parity — files attach AFTER the master row
     * exists). Edit-mode bypasses this staging area and uploads
     * immediately via {@link AttachmentsSection} → mutations.
     */
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);

    /**
     * Inline error flags — Contact Code (MSG1) and Tax ID exists
     * (MSG2) come back from the server as WBE_CONTACTS_HAND_KEY_DUP /
     * WBE_CONTACTS_TAX_ID_DUP. Tax ID format (MSG3) is client-side.
     * Reset on input change so the error clears as the user fixes it.
     */
    const [msg1Visible, setMsg1Visible] = useState(false);
    const [msg2Visible, setMsg2Visible] = useState(false);
    const [msg3Visible, setMsg3Visible] = useState(false);

    /** NAPAS + CITAD bank list — fetched once on mount. */
    const [bankOptions, setBankOptions] = useState<ApiContactBankRow[]>([]);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const rows = await mutations.loadBanks();
                if (!cancelled) setBankOptions(rows);
            } catch {
                // Picker stays empty on failure; user can still type
                // the bank name manually. The shared error dialog
                // already fired from the hook's `error` state.
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-seed on initialValues update (Edit dialog fetches detail
    // after mount).
    useEffect(() => {
        if (!initialValues) return;
        if (typeof window !== "undefined") {
            console.log("edit contact detail / mapped form values", initialValues);
        }
        setContactCode(initialValues.contactCode);
        setContactName(initialValues.contactName);
        setTaxId(initialValues.taxId);
        setLocation(initialValues.location);
        setAccounts(initialValues.accounts);
        // Re-seed the overseas inputs from the resolved detail. Without
        // this the Edit dialog kept the empty fallback shape and the
        // user only saw Beneficiary Name + SWIFT code (which the list
        // cell happens to leak through `deposit.bankName/accountNo`),
        // while Beneficiary Account No., Bank Name, and Address stayed
        // empty even though the wire response carried them.
        if (initialValues.location === "overseas") {
            setOverseasList([
                {
                    id:
                        initialValues.existingOverseasKey
                            ? `ov-${initialValues.existingOverseasKey}`
                            : `ov-seed-${Date.now()}`,
                    beneficiaryName: initialValues.overseas.beneficiaryName,
                    swiftCode: initialValues.overseas.swiftCode,
                    beneficiaryAccountNo: initialValues.overseas.beneficiaryAccountNo,
                    beneficiaryBankName: initialValues.overseas.beneficiaryBankName,
                    beneficiaryBankCode: initialValues.overseas.beneficiaryBankCode,
                    beneficiaryAddress: initialValues.overseas.beneficiaryAddress,
                },
            ]);
        } else {
            setOverseasList([emptyOverseasDraft("ov-seed-0")]);
        }
        setAddress(initialValues.address);
        setChangedAddress(initialValues.changedAddress);
        setChangedAddressOpen(initialValues.changedAddress.trim().length > 0);
        setValidTill(initialValues.validTill);
        setDeletedAccountKeys([]);
        setDeletedOverseasKeys([]);
        setMsg1Visible(false);
        setMsg2Visible(false);
        setMsg3Visible(false);
    }, [initialValues]);

    const updateAccount = (id: string, patch: Partial<DepositAccountFormValues>) => {
        setAccounts((prev) =>
            prev.map((acc) => (acc.id === id ? { ...acc, ...patch } : acc)),
        );
    };
    const removeAccount = (id: string) => {
        setAccounts((prev) => {
            if (prev.length <= 1) return prev;
            const dropped = prev.find((acc) => acc.id === id);
            if (dropped?.trcoAcctKey) {
                setDeletedAccountKeys((d) =>
                    d.includes(dropped.trcoAcctKey!) ? d : [...d, dropped.trcoAcctKey!],
                );
            }
            return prev.filter((acc) => acc.id !== id);
        });
    };
    const addAccount = () => {
        setAccounts((prev) => [...prev, emptyAccount(`acc-${Date.now()}`)]);
    };

    const updateOverseas = (id: string, patch: Partial<OverseasDraft>) => {
        setOverseasList((prev) =>
            prev.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        );
    };
    const removeOverseas = (id: string) => {
        setOverseasList((prev) => (prev.length <= 1 ? prev : prev.filter((o) => o.id !== id)));
    };
    const addOverseas = () => {
        setOverseasList((prev) => [...prev, emptyOverseasDraft(`ov-${Date.now()}`)]);
    };

    /**
     * Contact-location radio switch — mirrors legacy `comm_0184_005`
     * WBC1175 confirmation. Add mode flips freely (no saved sub-rows
     * to drop); edit mode prompts before applying the change. On
     * confirm, server-side keys from the leaving side are queued for
     * delete (`accounts_to_delete` / `overseas_to_delete` on the
     * Update wire body) and the in-memory drafts of the leaving side
     * are reset to one empty entry. On cancel, the radio stays put —
     * no in-memory mutation, no wire change.
     */
    const handleLocationChange = (next: ContactLocation) => {
        if (next === location) return;
        if (!isEdit) {
            setLocation(next);
            return;
        }
        dialog.open({
            type: "confirmation",
            title: t("dialog.confirmation"),
            description: t("settings.contacts.confirm_switch_location.description"),
            confirmText: t("dialog.yes"),
            cancelText: t("dialog.no"),
            onConfirm: () => {
                if (location === "local") {
                    // Leaving Local → queue every saved account key
                    // for server-side delete and drop the in-memory
                    // cards.
                    const existingKeys = accounts
                        .map((a) => a.trcoAcctKey)
                        .filter((k): k is string => Boolean(k));
                    if (existingKeys.length > 0) {
                        setDeletedAccountKeys((prev) => {
                            const merged = new Set(prev);
                            for (const k of existingKeys) merged.add(k);
                            return Array.from(merged);
                        });
                    }
                    setAccounts([emptyAccount("acc-seed-0")]);
                } else {
                    // Leaving Overseas → queue the saved beneficiary
                    // key (when present) for server-side delete and
                    // drop the in-memory blocks.
                    if (initialValues?.existingOverseasKey) {
                        const ovrsKey = initialValues.existingOverseasKey;
                        setDeletedOverseasKeys((prev) =>
                            prev.includes(ovrsKey) ? prev : [...prev, ovrsKey],
                        );
                    }
                    setOverseasList([emptyOverseasDraft("ov-seed-0")]);
                }
                setLocation(next);
            },
        });
    };

    const openChangedAddress = () => {
        setChangedAddressOpen(true);
        // Legacy parity (`comm_0184_002.ts` stamps today+1 on a fresh
        // changed-address row when the user opens the block but hasn't
        // picked a date yet). Pre-fills with tomorrow so the shared
        // date popup opens on a valid in-range day.
        if (!validTill) setValidTill(tomorrowIsoLocal());
    };
    const closeChangedAddress = () => {
        setChangedAddressOpen(false);
        setChangedAddress("");
        setValidTill("");
    };

    /**
     * Mirror legacy `comm_0184_002.ts:147-154` — only blocks Save
     * when Tax ID is present but malformed. Empty Tax ID is allowed
     * (the field is optional per the form spec).
     */
    const isTaxIdValid = (raw: string) => {
        if (!raw) return true;
        const digits = raw.replace(/\D/g, "");
        return digits.length === 10 || digits.length === 13;
    };

    const buildValues = (): ContactFormValues => {
        // Overseas builds a single beneficiary block (Spring DTO
        // supports an array but the popup MVP ships the first
        // entry — extra entries are client-only dup-checked and
        // dropped here).
        //
        // Every nested string is `?? ""`-defaulted so a partially
        // initialised draft (e.g. fields renamed mid-MR, async seed
        // not yet applied) can't ship `undefined` to the Zod schema.
        // Zod's base-type guard for `z.string()` reads as the
        // un-translated message "Invalid input: expected string,
        // received undefined" — defensively coalescing here stops the
        // class of bug at the boundary.
        const o0 = overseasList[0] ?? emptyOverseasDraft("ov-seed-empty");
        return {
            contactCode: (contactCode ?? "").trim(),
            contactName: (contactName ?? "").trim(),
            // TRCO_CMENM auto-copy (legacy parity — comm_0184_002.ts:462).
            contactEnglishName: (contactName ?? "").trim(),
            taxId: taxId ?? "",
            location,
            accounts,
            deletedAccountKeys,
            deletedOverseasKeys,
            overseas: {
                beneficiaryName: (o0.beneficiaryName ?? "").trim(),
                swiftCode: (o0.swiftCode ?? "").trim(),
                beneficiaryAccountNo: (o0.beneficiaryAccountNo ?? "").trim(),
                beneficiaryBankName: (o0.beneficiaryBankName ?? "").trim(),
                beneficiaryBankCode: (o0.beneficiaryBankCode ?? "").trim(),
                beneficiaryAddress: (o0.beneficiaryAddress ?? "").trim(),
            },
            existingOverseasKey: initialValues?.existingOverseasKey,
            existingAddressKeys: initialValues?.existingAddressKeys,
            address: (address ?? "").trim(),
            changedAddress: changedAddressOpen ? (changedAddress ?? "").trim() : "",
            validTill: changedAddressOpen ? (validTill ?? "") : "",
        };
    };

    const handleSubmit = async () => {
        if (mutations.submitting) return;

        // Reset inline errors before re-validating.
        setMsg1Visible(false);
        setMsg2Visible(false);
        setMsg3Visible(false);

        // Tax ID format guard (legacy MSG3).
        if (!isTaxIdValid(taxId)) {
            setMsg3Visible(true);
            return;
        }

        // Overseas duplicate-(BIC, ACCT_NO) guard — mirrors legacy
        // `comm_0184_002.ts:374-397`.
        if (location === "overseas") {
            const bics = new Set<string>();
            const accts = new Set<string>();
            for (const o of overseasList) {
                const bic = o.swiftCode.trim();
                const acct = o.beneficiaryAccountNo.trim();
                if (bic && bics.has(bic)) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t("settings.contacts.validation.bic.duplicate"),
                    });
                    return;
                }
                if (acct && accts.has(acct)) {
                    dialog.open({
                        type: "error",
                        title: t("dialog.error"),
                        description: t("settings.contacts.validation.beneficiaryAccountNo.duplicate"),
                    });
                    return;
                }
                if (bic) bics.add(bic);
                if (acct) accts.add(acct);
            }
        }

        const values = buildValues();

        // Pre-Zod inline guard — surface a single, friendly message for
        // the four "required" fields the server's Bean Validation would
        // bounce as WBE_VALIDATION. The schema also catches these, but
        // checking here short-circuits the network call AND keeps the
        // dialog's response immediate.
        const missing =
            !values.contactCode ? "settings.contacts.validation.contactCode.required" :
            !values.contactName ? "settings.contacts.validation.contactName.required" :
            (values.location === "local" && !values.address)
                ? "settings.contacts.validation.address.required"
                : null;
        if (missing) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t(missing),
            });
            return;
        }

        // Debug — surfaces the exact payload shape in DevTools so a
        // future "undefined where string expected" Zod leak can be
        // diagnosed without re-instrumenting.
        if (typeof window !== "undefined") {
            console.log("changedAddressValidTill", values.validTill);
            console.log(
                "mapped dueDt",
                values.validTill ? values.validTill.replace(/-/g, "") : "",
            );
            console.log("create contact payload", values);
        }

        const issues = validateContact(values);
        if (issues) {
            const first = issues[0];
            // Forbid the un-translated default — surface the field path
            // alongside the message key so the user sees something
            // actionable instead of the raw Zod string.
            const description = first.key.startsWith("settings.")
                ? t(first.key)
                : t("settings.contacts.validation.generic", { path: first.path, msg: first.key });
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description,
            });
            return;
        }
        try {
            if (isEdit) {
                if (!trcoKey) throw new Error("trcoKey is required for edit mode");
                await mutations.update(trcoKey, values);
            } else {
                const created = await mutations.create(values);
                // Upload staged files sequentially after the master
                // row is persisted — TRCO_INFO_FILE.FILE_ID is
                // per-TRCO_KEY MAX+1 (V99 branch), and the legacy
                // first-file convention assigns
                // "Business Registration" to FILE_ID = "1".
                // Sequential upload preserves that ordering.
                for (const f of stagedFiles) {
                    try {
                        await mutations.uploadFile(created.trco_key, f);
                    } catch (uploadErr: unknown) {
                        // Surface the first failure but DON'T re-throw —
                        // the contact is already created. The user can
                        // re-open Edit to retry the failed upload.
                        const ex = uploadErr as ApiCallError;
                        dialog.open({
                            type: "error",
                            title: t("dialog.error"),
                            description: ex.message,
                            errorCode: ex.code,
                        });
                        break;
                    }
                }
            }
            if (onSaved) await onSaved();
            else onClose();
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            // Inline-map the backend's per-tenant duplicate guards to the
            // Contact Code (MSG1) / Tax ID (MSG2) field errors. The codes
            // are the contacts backend's own — ContactsValidator throws
            // WBE_CONTACTS_HAND_KEY_DUP / WBE_CONTACTS_TAX_ID_DUP (mirrors
            // legacy comm_0184_002_c001 WBE0003); any other code routes to
            // the shared error dialog below.
            if (ex.code === "WBE_CONTACTS_HAND_KEY_DUP") {
                setMsg1Visible(true);
                return;
            }
            if (ex.code === "WBE_CONTACTS_TAX_ID_DUP") {
                setMsg2Visible(true);
                return;
            }
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
        }
    };

    const handleLookupRecipient = async (acc: DepositAccountFormValues) => {
        if (!acc.bankCd || !acc.accountNo.trim()) {
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: t("settings.contacts.lookup.missing_input"),
            });
            return;
        }
        // Defensive guard: the showLookup gate already hides the
        // button for non-NAPAS picks, but a stale UI / rapid bank
        // swap could theoretically still fire this with bankDiv =
        // "CITAD". The backend already returns an empty name for
        // that case (legacy `FIRM_PROC.inquiryAccount` is NAPAS-only);
        // bail early so the user doesn't see a misleading "lookup
        // empty" error dialog for a button that shouldn't fire.
        if (acc.bankDiv !== "NAPAS") return;
        try {
            // bankDiv narrowed to "NAPAS" by the guard above; the wire
            // contract still ships both fields with one always null so
            // the backend signature stays unchanged.
            const recipientName = await mutations.lookupRecipient({
                napas_bank_cd: acc.bankCd,
                citad_bank_cd: null,
                acct_no: acc.accountNo.trim(),
            });
            if (!recipientName) {
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: t("settings.contacts.lookup.empty"),
                });
                return;
            }
            updateAccount(acc.id, { recipient: recipientName, lookupVerified: true });
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            dialog.open({
                type: "error",
                title: t("dialog.error"),
                description: ex.message,
                errorCode: ex.code,
            });
        }
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
                aria-describedby={undefined}
                className="h-[var(--w-wb-settings-card-h)] max-w-[500px] rounded-2xl p-0"
            >
                <div className="flex h-full w-full flex-col">
                    {/* Title bar */}
                    <div className="flex shrink-0 items-center justify-between gap-4 px-6 pt-6 pb-2">
                        <DialogTitle className="text-wb-16 font-semibold tracking-wb-tight text-wb-dark">
                            {t(
                                isEdit
                                    ? "settings.contacts.edit_dialog.title"
                                    : "settings.contacts.add_dialog.title",
                            )}
                        </DialogTitle>
                        <button
                            type="button"
                            aria-label={t("settings.close")}
                            onClick={onClose}
                            className="flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink hover:bg-black/5"
                        >
                            <X className="size-[18px]" strokeWidth={2} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="custom-scrollbar flex-1 overflow-y-auto px-6 pb-4">
                        <div className="flex flex-col gap-8">
                            {/* Primary fields */}
                            <div className="flex flex-col gap-4">
                                <FormField
                                    label={t("settings.contacts.add_dialog.field.contact_code")}
                                    required
                                    errorMessage={msg1Visible ? t("settings.contacts.add_dialog.msg.contact_code_duplicate") : null}
                                >
                                    <TextInput
                                        value={contactCode}
                                        onChange={(v) => {
                                            // Legacy no-space rule — strip every whitespace
                                            // character including pastes (mirrors
                                            // `comm_0184_002.ts:119-129`).
                                            setContactCode(v.replace(/\s+/g, ""));
                                            setMsg1Visible(false);
                                        }}
                                        placeholder={t(
                                            "settings.contacts.add_dialog.placeholder.contact_code",
                                        )}
                                    />
                                </FormField>

                                <FormField
                                    label={t("settings.contacts.add_dialog.field.contact_name")}
                                    required
                                >
                                    <TextInput
                                        value={contactName}
                                        onChange={setContactName}
                                        placeholder={t(
                                            "settings.contacts.add_dialog.placeholder.contact_name",
                                        )}
                                    />
                                </FormField>

                                <FormField
                                    label={t("settings.contacts.add_dialog.field.tax_id")}
                                    errorMessage={
                                        msg2Visible
                                            ? t("settings.contacts.add_dialog.msg.tax_id_duplicate")
                                            : msg3Visible
                                                ? t("settings.contacts.add_dialog.msg.tax_id_format")
                                                : null
                                    }
                                >
                                    <TextInput
                                        value={taxId}
                                        onChange={(v) => {
                                            // Inputmask-style: keep digits only, then format
                                            // as `XXXXXXXXXX-YYY` when length > 10.
                                            const digits = v.replace(/\D/g, "").slice(0, 13);
                                            const formatted =
                                                digits.length > 10
                                                    ? `${digits.slice(0, 10)}-${digits.slice(10)}`
                                                    : digits;
                                            setTaxId(formatted);
                                            setMsg2Visible(false);
                                            setMsg3Visible(false);
                                        }}
                                        placeholder={t(
                                            "settings.contacts.add_dialog.placeholder.tax_id",
                                        )}
                                    />
                                </FormField>

                                {/* Local / Overseas radio */}
                                <div className="flex items-center gap-6 py-1">
                                    <RadioPill
                                        checked={location === "local"}
                                        onClick={() => handleLocationChange("local")}
                                        label={t("settings.contacts.location.local")}
                                    />
                                    <RadioPill
                                        checked={location === "overseas"}
                                        onClick={() => handleLocationChange("overseas")}
                                        label={t("settings.contacts.location.overseas")}
                                    />
                                </div>

                                {/* Local deposit-account cards OR Overseas blocks */}
                                {location === "local" ? (
                                    <div className="flex flex-col gap-6">
                                        {accounts.map((acc) => (
                                            <DepositAccountCard
                                                key={acc.id}
                                                account={acc}
                                                bankOptions={bankOptions}
                                                canDelete={accounts.length > 1}
                                                onChange={(patch) => updateAccount(acc.id, patch)}
                                                onRemove={() => removeAccount(acc.id)}
                                                onLookup={() => handleLookupRecipient(acc)}
                                            />
                                        ))}
                                        <button
                                            type="button"
                                            onClick={addAccount}
                                            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 self-start rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover hover:bg-black/[0.03]"
                                        >
                                            <Plus className="size-4" strokeWidth={2} />
                                            {t("settings.contacts.add_dialog.add_another_account")}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-6">
                                        {overseasList.map((o) => (
                                            <OverseasBlock
                                                key={o.id}
                                                value={o}
                                                canDelete={overseasList.length > 1}
                                                onChange={(patch) => updateOverseas(o.id, patch)}
                                                onRemove={() => removeOverseas(o.id)}
                                            />
                                        ))}
                                        <button
                                            type="button"
                                            onClick={addOverseas}
                                            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 self-start rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover hover:bg-black/[0.03]"
                                        >
                                            <Plus className="size-4" strokeWidth={2} />
                                            {t("settings.contacts.add_dialog.add_another_account")}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Addresses */}
                            <div className="flex flex-col gap-4">
                                <FormField
                                    label={t("settings.contacts.add_dialog.field.current_address")}
                                >
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        rows={3}
                                        className="w-full resize-y rounded-md bg-white px-2 pb-4 pt-2 text-wb-14-tight font-medium leading-[18px] text-wb-ntrl-8 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] outline-none placeholder:text-wb-ntrl-5 focus:shadow-[0_0_0_1px_var(--color-brand)]"
                                    />
                                </FormField>

                                {changedAddressOpen ? (
                                    <ChangedAddressBlock
                                        address={changedAddress}
                                        onAddressChange={setChangedAddress}
                                        validTill={validTill}
                                        onValidTillChange={setValidTill}
                                        onDelete={closeChangedAddress}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={openChangedAddress}
                                        className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 self-start rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-brand-hover hover:bg-black/[0.03]"
                                    >
                                        <Plus className="size-4" strokeWidth={2} />
                                        {t("settings.contacts.add_dialog.add_changed_address")}
                                    </button>
                                )}
                            </div>

                            <AttachmentsSection
                                mode={isEdit ? "edit" : "add"}
                                trcoKey={trcoKey}
                                stagedFiles={isEdit ? undefined : stagedFiles}
                                onStagedChange={isEdit ? undefined : setStagedFiles}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex shrink-0 items-center justify-end gap-2 px-6 pb-6 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                        >
                            {t("settings.contacts.add_dialog.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={mutations.submitting}
                            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t("settings.contacts.add_dialog.save")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

type OverseasDraft = {
    id: string;
    beneficiaryName: string;
    swiftCode: string;
    beneficiaryAccountNo: string;
    beneficiaryBankName: string;
    beneficiaryBankCode: string;
    beneficiaryAddress: string;
};

function emptyOverseasDraft(id: string): OverseasDraft {
    return {
        id,
        beneficiaryName: "",
        swiftCode: "",
        beneficiaryAccountNo: "",
        beneficiaryBankName: "",
        beneficiaryBankCode: "",
        beneficiaryAddress: "",
    };
}

function FormField({
    label,
    required = false,
    errorMessage,
    children,
}: {
    label: string;
    required?: boolean;
    errorMessage?: string | null;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-2">
            <span className="flex items-start gap-0.5 text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                {label}
                {required && (
                    <span className="text-wb-red-07" aria-hidden>
                        *
                    </span>
                )}
            </span>
            {children}
            {errorMessage && (
                <span className="text-wb-12 font-medium text-wb-red-07">{errorMessage}</span>
            )}
        </label>
    );
}

function TextInput({
    value,
    onChange,
    placeholder,
    rightSlot,
    onClear,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rightSlot?: React.ReactNode;
    onClear?: () => void;
}) {
    return (
        <div className="flex h-8 w-full items-center gap-1 rounded-md bg-white px-2 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] focus-within:shadow-[0_0_0_1px_var(--color-brand)]">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
            />
            {value && onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear"
                    className="flex size-4 cursor-pointer items-center justify-center rounded-full text-wb-ntrl-5 hover:text-wb-ink"
                >
                    <X className="size-3.5" strokeWidth={2} />
                </button>
            )}
            {rightSlot}
        </div>
    );
}

/**
 * Currency dropdown — VND/USD only per the legacy `select-box-option`
 * in `comm_0184_002_view.jsp:233-235`. Changing currency clears the
 * recipient and forces the manual flow when USD (legacy parity).
 */
function CurrencyDropdown({
    value,
    onChange,
}: {
    value: "VND" | "USD" | "";
    onChange: (next: "VND" | "USD") => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    const label = value
        ? t("settings.contacts.add_dialog.currency_value", { code: value })
        : t("settings.contacts.add_dialog.currency_placeholder");
    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md bg-white px-2 text-wb-14-tight font-medium text-wb-ntrl-8 shadow-wb-btn hover:bg-black/[0.03]"
            >
                <span className={cn("truncate", !value && "text-wb-ntrl-5")}>{label}</span>
                <ChevronDown className="size-4 shrink-0" strokeWidth={2} />
            </button>
            {open && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-auto rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {(["VND", "USD"] as const).map((c) => (
                        <li
                            key={c}
                            role="option"
                            aria-selected={value === c}
                            onClick={() => {
                                onChange(c);
                                setOpen(false);
                            }}
                            className={cn(
                                "cursor-pointer px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                                value === c && "bg-wb-bg-active",
                            )}
                        >
                            {t("settings.contacts.add_dialog.currency_value", { code: c })}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * Bank-picker typeahead. Filters the loaded NAPAS+CITAD list by
 * substring against `engAbrvatNm`, `bankNm`, and `bankEngNm`. On
 * pick, stamps both the label (display) AND the wire fields
 * (`bankCd` + `bankDiv` + `bankStatus`) onto the parent card.
 */
function BankPicker({
    label,
    bankCd,
    options,
    onPick,
    placeholder,
}: {
    label: string;
    bankCd: string;
    options: ApiContactBankRow[];
    onPick: (row: ApiContactBankRow) => void;
    placeholder?: string;
}) {
    const [input, setInput] = useState(label);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setInput(label);
    }, [label]);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    const filtered = useMemo(() => {
        const q = input.trim().toLowerCase();
        if (!q) return options.slice(0, 50);
        return options
            .filter((r) => {
                const a = (r.eng_abrvat_nm ?? "").toLowerCase();
                const v = (r.bank_nm ?? "").toLowerCase();
                const e = (r.bank_eng_nm ?? "").toLowerCase();
                return a.includes(q) || v.includes(q) || e.includes(q);
            })
            .slice(0, 50);
    }, [input, options]);
    return (
        <div ref={ref} className="relative">
            <div className="flex h-8 w-full items-center gap-1 rounded-md bg-white px-2 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] focus-within:shadow-[0_0_0_1px_var(--color-brand)]">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="min-w-0 flex-1 bg-transparent text-wb-14-tight font-medium text-wb-ntrl-8 outline-none placeholder:text-wb-ntrl-5"
                />
                <Search className="size-4 shrink-0 text-brand" strokeWidth={2} />
            </div>
            {open && filtered.length > 0 && (
                <ul
                    role="listbox"
                    className="custom-scrollbar-y absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-auto rounded-md border border-wb-ntrl-4 bg-white shadow-wb-card"
                >
                    {filtered.map((r) => {
                        const display = formatBankLabel(r);
                        return (
                            <li
                                key={r.bank_cd}
                                role="option"
                                aria-selected={bankCd === r.bank_cd}
                                onClick={() => {
                                    onPick(r);
                                    setInput(display);
                                    setOpen(false);
                                }}
                                className={cn(
                                    "cursor-pointer truncate px-2 py-1.5 text-wb-14-tight font-medium text-wb-ntrl-8 hover:bg-wb-bg-active",
                                    bankCd === r.bank_cd && "bg-wb-bg-active",
                                )}
                                title={display}
                            >
                                {display}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function formatBankLabel(r: ApiContactBankRow): string {
    const abbr = r.eng_abrvat_nm ?? "";
    const full = r.bank_eng_nm ?? r.bank_nm ?? "";
    if (abbr && full) return `${abbr} - ${full}`;
    return abbr || full || r.bank_cd;
}

function RadioPill({
    checked,
    onClick,
    label,
}: {
    checked: boolean;
    onClick: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onClick}
            className="inline-flex cursor-pointer items-center gap-2.5"
        >
            <span
                className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    checked ? "border-brand" : "border-wb-ntrl-4",
                )}
            >
                {checked && <span className="size-2 rounded-full bg-brand" />}
            </span>
            <span className="text-wb-14 font-medium text-wb-ntrl-8">{label}</span>
        </button>
    );
}

/**
 * One deposit-account card — Local contact only. Recipient flow:
 *   - manual: USD currency OR bank status='N' OR no bank picked yet
 *   - verified (Lookup): VND currency AND bank status='Y'
 * On currency or bank change, recipient + lookupVerified reset
 * (legacy parity — clears stale verified name).
 */
function DepositAccountCard({
    account,
    bankOptions,
    canDelete,
    onChange,
    onRemove,
    onLookup,
}: {
    account: DepositAccountFormValues;
    bankOptions: ApiContactBankRow[];
    canDelete: boolean;
    onChange: (patch: Partial<DepositAccountFormValues>) => void;
    onRemove: () => void;
    onLookup: () => void;
}) {
    const { t } = useTranslation();
    // Lookup Recipient is NAPAS-only — legacy `comm_1003_001` →
    // `FIRM_PROC.inquiryAccount` only resolves account-holder names
    // against the NAPAS network. CITAD entries have no real-time
    // holder-name source and stay on the manual Recipient input.
    //
    // Previously this gate read `account.bankStatus !== "N"` to mirror
    // the legacy popup's `datastatus !== 'N'` check, but `BANK_STAS` in
    // `TB_FIRM_BANK_CODE` is an active flag (1 = active, 0 = inactive)
    // — not a NAPAS-vs-CITAD discriminator. Active CITAD rows carry
    // `BANK_STAS='1'` too (see V145 seed) so the old gate let the
    // Lookup button render on CITAD picks, the click fired with
    // `napas_bank_cd: null, citad_bank_cd: "01616001"`, the backend
    // correctly returned an empty name, and the user saw a misleading
    // "lookup empty" error dialog. Gating on `bankDiv === "NAPAS"`
    // directly matches the legacy intent without depending on the
    // overloaded `BANK_STAS` column.
    const showLookup =
        account.bankDiv === "NAPAS" && account.currency !== "USD" && !!account.bankCd;
    const verifiedRecipient =
        account.lookupVerified && !!account.recipient && showLookup;
    return (
        <div className="flex w-full flex-col gap-2">
            <FormField label={t("settings.contacts.add_dialog.field.deposit_account")}>
                <BankPicker
                    label={account.bank}
                    bankCd={account.bankCd}
                    options={bankOptions}
                    placeholder={t(
                        "settings.contacts.add_dialog.placeholder.deposit_account",
                    )}
                    onPick={(row) =>
                        onChange({
                            bank: formatBankLabel(row),
                            bankCd: row.bank_cd,
                            bankDiv: row.ant_div_cd,
                            bankStatus: row.status ?? "",
                            // Reset recipient on bank change — same legacy
                            // pattern as the currency-change handler.
                            recipient: "",
                            lookupVerified: false,
                        })
                    }
                />
            </FormField>

            <CurrencyDropdown
                value={account.currency}
                onChange={(c) =>
                    onChange({
                        currency: c,
                        // Currency switch clears the recipient + verified
                        // flag so the next save uses a fresh lookup or
                        // manual entry — mirrors `comm_0184_002.ts:94-115`.
                        recipient: "",
                        lookupVerified: false,
                    })
                }
            />

            <TextInput
                value={account.accountNo}
                onChange={(v) => onChange({ accountNo: v })}
                placeholder={t("settings.contacts.add_dialog.placeholder.account_no")}
            />

            {!showLookup && (
                <FormField label={t("settings.contacts.add_dialog.field.recipient_name")}>
                    <TextInput
                        value={account.recipient}
                        onChange={(v) => onChange({ recipient: v, lookupVerified: false })}
                        placeholder={t(
                            "settings.contacts.add_dialog.placeholder.recipient_name",
                        )}
                    />
                </FormField>
            )}

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onLookup}
                    className={cn(
                        "inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-white px-2 text-wb-14 font-medium text-brand shadow-wb-btn hover:bg-black/[0.03]",
                        !showLookup && "invisible",
                    )}
                >
                    <Search className="size-4" strokeWidth={2} />
                    {t("settings.contacts.add_dialog.lookup_recipient")}
                </button>
                {canDelete ? (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-wb-14 font-medium text-wb-red-07 hover:bg-black/[0.03]"
                    >
                        <Trash2 className="size-4" strokeWidth={2} />
                        {t("settings.contacts.add_dialog.delete_account")}
                    </button>
                ) : (
                    <span aria-hidden />
                )}
            </div>

            {verifiedRecipient && (
                <div className="flex items-end gap-1">
                    <UserRound className="size-4 shrink-0 text-wb-ntrl-8" strokeWidth={2} />
                    <span className="truncate text-wb-12 font-medium text-wb-ntrl-8">
                        {account.recipient}
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * One overseas-beneficiary block. Each card is a stack of 5 inputs
 * (Beneficiary Name, Beneficiary Bank Name, BIC, Account No,
 * Address) — mirrors legacy `comm_0184_002_view.jsp:161-211`.
 */
function OverseasBlock({
    value,
    canDelete,
    onChange,
    onRemove,
}: {
    value: OverseasDraft;
    canDelete: boolean;
    onChange: (patch: Partial<OverseasDraft>) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex w-full flex-col gap-3">
            <FormField label={t("settings.contacts.overseas.field.beneficiary_name")}>
                <TextInput
                    value={value.beneficiaryName}
                    onChange={(v) => onChange({ beneficiaryName: v })}
                    placeholder={t("settings.contacts.overseas.placeholder.beneficiary_name")}
                />
            </FormField>
            <FormField label={t("settings.contacts.overseas.field.beneficiary_bank_name")}>
                <TextInput
                    value={value.beneficiaryBankName}
                    onChange={(v) => onChange({ beneficiaryBankName: v })}
                    placeholder={t("settings.contacts.overseas.placeholder.beneficiary_bank_name")}
                />
            </FormField>
            <FormField label={t("settings.contacts.overseas.field.bic")}>
                <TextInput
                    value={value.swiftCode}
                    onChange={(v) => onChange({ swiftCode: v })}
                    placeholder={t("settings.contacts.overseas.placeholder.bic")}
                />
            </FormField>
            <FormField label={t("settings.contacts.overseas.field.beneficiary_account_no")}>
                <TextInput
                    value={value.beneficiaryAccountNo}
                    onChange={(v) => onChange({ beneficiaryAccountNo: v })}
                    placeholder={t("settings.contacts.overseas.placeholder.beneficiary_account_no")}
                />
            </FormField>
            <FormField label={t("settings.contacts.overseas.field.beneficiary_address")}>
                <textarea
                    value={value.beneficiaryAddress}
                    onChange={(e) => onChange({ beneficiaryAddress: e.target.value })}
                    rows={3}
                    className="w-full resize-y rounded-md bg-white px-2 pb-4 pt-2 text-wb-14-tight font-medium leading-[18px] text-wb-ntrl-8 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] outline-none placeholder:text-wb-ntrl-5 focus:shadow-[0_0_0_1px_var(--color-brand)]"
                    placeholder={t("settings.contacts.overseas.placeholder.beneficiary_address")}
                />
            </FormField>
            {canDelete && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-wb-14 font-medium text-wb-red-07 hover:bg-black/[0.03]"
                    >
                        <Trash2 className="size-4" strokeWidth={2} />
                        {t("settings.contacts.add_dialog.delete_account")}
                    </button>
                </div>
            )}
        </div>
    );
}

function ChangedAddressBlock({
    address,
    onAddressChange,
    validTill,
    onValidTillChange,
    onDelete,
}: {
    address: string;
    onAddressChange: (v: string) => void;
    validTill: string;
    onValidTillChange: (v: string) => void;
    onDelete: () => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-3">
            <FormField label={t("settings.contacts.add_dialog.field.changed_address")}>
                <textarea
                    value={address}
                    onChange={(e) => onAddressChange(e.target.value)}
                    rows={3}
                    className="w-full resize-y rounded-md bg-white px-2 pb-4 pt-2 text-wb-14-tight font-medium leading-[18px] text-wb-ntrl-8 shadow-[0_0_0_1px_var(--color-wb-ntrl-4)] outline-none placeholder:text-wb-ntrl-5 focus:shadow-[0_0_0_1px_var(--color-brand)]"
                />
            </FormField>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="text-wb-14 font-medium text-wb-ntrl-8">
                        {t("settings.contacts.add_dialog.field.valid_till")}
                    </span>
                    <DateField
                        value={validTill}
                        onChange={onValidTillChange}
                        formatValue={formatValidTillChip}
                        placeholder="DD-MM-YYYY"
                        minIso={tomorrowIsoLocal()}
                        ariaLabelKey="settings.contacts.add_dialog.field.valid_till"
                    />
                </div>
                <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-wb-table-border bg-white px-2 text-wb-14 font-medium text-wb-red-07 hover:bg-black/[0.03]"
                >
                    <Trash2 className="size-4" strokeWidth={2} />
                    {t("settings.contacts.add_dialog.delete_changed_address")}
                </button>
            </div>
        </div>
    );
}
