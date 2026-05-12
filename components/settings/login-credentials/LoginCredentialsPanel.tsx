"use client";

import { useState } from "react";

import { useDialog } from "@/components/shared/dialog";
import AuditLogsDialog, {
    type AuditLogRow,
} from "@/components/shared/popups/AuditLogsDialog";
import EditLoginIdPasswordDialog from "@/components/shared/popups/EditLoginIdPasswordDialog";
import GdtCredentialsDialog from "@/components/shared/popups/GdtCredentialsDialog";
import LoginIdPasswordDialog from "@/components/shared/popups/LoginIdPasswordDialog";
import PasswordConfirmationDialog from "@/components/shared/popups/PasswordConfirmationDialog";
import { userStorage } from "@/lib/auth/storage";
import LoginCredentialsRowMenu from "./LoginCredentialsRowMenu";
import RegisteredLoginCredentialsDialog, {
    type RegisteredCredentialEntry,
} from "@/components/shared/popups/RegisteredLoginCredentialsDialog";
import SelectBankAccountsDialog from "@/components/shared/popups/SelectBankAccountsDialog";
import SelectBankDialog from "@/components/shared/popups/SelectBankDialog";
import SelectLoginInstitutionDialog from "@/components/shared/popups/SelectLoginInstitutionDialog";
import type { BankOption } from "@/components/shared/popups/selectBankBanks";
import BankBrandLogo from "@/components/settings/bank-account/BankBrandLogo";
import { useTranslation } from "@/lib/i18n";

import { mockLoginCredentialAuditLogs } from "./auditLogsMockData";
import LoginCredentialsTable from "./LoginCredentialsTable";
import { mockLoginCredentialRows } from "./mockData";
import { buildRegisteredCredentialEntries } from "./registeredCredentialsMockData";
import type { LoginCredentialRow } from "./types";

/**
 * Discriminated union for the *child* popups that stack on top of the
 * Registered Login Credentials dialog.
 *
 * Stack semantics — match legacy `wecms.vn/fnsh_0001_001.act`:
 *
 *   Settings popup
 *     └─ Registered Login Credentials   ← stays mounted whenever the
 *                                         user is somewhere in this chain
 *         └─ Login ID/PW   |   Select Bank   |   Confirmation
 *                          (mutually exclusive among themselves)
 *
 * The three children are mutually exclusive — opening one closes any
 * other child — but none of them unmount Registered. Closing a child
 * returns the user to Registered, not to the bare Settings popup.
 *
 *   - login-id-pw          → Figma 1081:25293
 *   - select-bank          → Figma 1081:25861 (replaces login-id-pw on
 *                                               "Choose another bank")
 *   - select-bank-accounts → Figma 1081:25485 (opens after a successful
 *                                               Login click in login-id-pw)
 *   - edit-login-id-pw     → Figma 2781:23399 (opens from the pencil
 *                                               icon on a Registered row)
 *   - confirmation         → Figma 9198:7071  (eye-slash on a hidden password)
 */
type RegisteredChild =
    | { kind: "login-id-pw" }
    | { kind: "select-bank" }
    | { kind: "select-bank-accounts" }
    | { kind: "edit-login-id-pw"; entry: RegisteredCredentialEntry }
    | { kind: "confirmation"; entry: RegisteredCredentialEntry };

/**
 * Discriminated union for the Add-credentials flow opened from the
 * panel-header "Add" button. Mirrors `RegisteredChild` in shape — at
 * any moment exactly one popup in the chain is mounted, transitions
 * are atomic single-setState swaps, and the parent panel owns the
 * state so the popups stay reusable.
 *
 *   Add button
 *     └─ Select-a-login-institution   (Figma 1797:20561)
 *         ├─ Bank branch:
 *         │   └─ Select Bank          (Figma 1081:25861)
 *         │       └─ Login ID/PW       (Figma 1081:25293)
 *         │           └─ Select Bank Accounts (Figma 1081:25485)
 *         │               └─ Save → success dialog → close all
 *         └─ GDT branch:
 *             └─ GDT credentials       (Figma 2344:21946)
 *                 └─ Next → success dialog → close all
 *
 * Forward-arrows are atomic swaps. Cancel on any step ends the
 * entire flow back to the panel (no stack rewind). Login ID/PW's
 * "Choose another bank" rewinds to Select Bank; Select Bank Accounts'
 * Back rewinds to Login ID/PW.
 */
type AddChild =
    | { kind: "institution" }
    | { kind: "bank" }
    | { kind: "login-id-pw" }
    | { kind: "select-bank-accounts" }
    | { kind: "gdt" };

/**
 * Login Credentials panel — Settings popup submenu (Figma 999:21715).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description on the left, "Add" primary button
 *                   plus gear icon (bordered) on the right.
 *   [Table]       — single scroll region (vertical + horizontal as needed).
 *                   Each row carries one or more (loginId, password) pairs.
 *                   Clicking the Login ID/PW cell opens a floating popover
 *                   listing every account with an eye toggle for the
 *                   masked password.
 *
 * Popup state model — TWO independent slots:
 *
 *   `registeredRow`   the Registered Login Credentials parent. Stays
 *                     mounted as long as the user is inside the
 *                     Registered → child chain.
 *   `registeredChild` which child (if any) is stacked on top of
 *                     Registered. Mutually exclusive across the three
 *                     child kinds; switching is a single setState call.
 *
 * Audit Logs is a SEPARATE flow — opens from the table's Audit Logs
 * link, not from inside the Registered chain — and keeps its own
 * boolean state.
 */
export default function LoginCredentialsPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();
    const [openRowId, setOpenRowId] = useState<string | null>(null);
    const [registeredRow, setRegisteredRow] = useState<LoginCredentialRow | null>(null);
    const [registeredChild, setRegisteredChild] = useState<RegisteredChild | null>(null);
    const [auditLogsOpen, setAuditLogsOpen] = useState(false);
    /** Open row-action menu (Figma 2236:30291) state. Stores the
     *  row id together with the kebab's bounding rect so the menu —
     *  rendered via portal at the panel level — can position itself
     *  with `position: fixed` based on the trigger. Single-menu-at-
     *  a-time: clicking row B's kebab while row A's menu is open
     *  closes A and opens B in a single setState. */
    const [openMenu, setOpenMenu] = useState<
        { rowId: string; rect: DOMRect } | null
    >(null);
    /** Active step in the Add-credentials flow opened from the
     *  panel-header Add button. `null` = flow is not active. Mirrors
     *  the `registeredChild` shape — single state slot, mutually
     *  exclusive children, atomic swaps. Distinct from the
     *  Registered chain so the two flows never collide on shared
     *  draft state. */
    const [addChild, setAddChild] = useState<AddChild | null>(null);
    /** Controlled value of the Select Bank dialog's search input
     *  inside the Add flow. */
    const [addBankSearchValue, setAddBankSearchValue] = useState("");
    /** Bank picked inside Select Bank during the Add flow — drives
     *  Next-enabled on Select Bank and surfaces in Login ID/PW +
     *  Select Bank Accounts as the institution identity. */
    const [addSelectedBank, setAddSelectedBank] = useState<BankOption | null>(
        null,
    );
    /** Controlled value of the password confirmation dialog's input. */
    const [confirmValue, setConfirmValue] = useState("");
    /** Controlled value of the Select Bank dialog's search input. */
    const [bankSearchValue, setBankSearchValue] = useState("");
    /** Bank picked inside Select Bank — drives Next-enabled and is kept
     *  available for downstream popups (Login ID/PW) per the flow. Null
     *  while no row has been clicked. */
    const [selectedBank, setSelectedBank] = useState<BankOption | null>(null);

    // Pre-translate audit-log rows for the shared dialog. The shared
    // dialog renders `activity` as plain text — translation lives here so
    // the dialog stays page-agnostic.
    const auditLogRows: AuditLogRow[] = mockLoginCredentialAuditLogs.map((row) => ({
        id: row.id,
        date: row.date,
        time: row.time,
        user: row.user,
        activity: t(`settings.login_credentials.audit_logs.activity.${row.activity}`),
        details: row.details,
    }));

    function closeRegistered() {
        // Closing the parent always tears down any child too — a stale
        // child without its parent would render as an orphan modal.
        setRegisteredRow(null);
        setRegisteredChild(null);
    }

    function closeChild() {
        setRegisteredChild(null);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — title + description sit alone on row 1 (Figma
               183:25777); the Add + gear toolbar sits on row 2,
               right-aligned, separated by gap-5 (Figma 183:25789).
               pt-14 drops the title row below the shell's absolute
               Esc/X group at top-4 right-4. */}
            <div className="flex shrink-0 flex-col gap-5 px-8 pb-5 pt-14">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.login_credentials.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.login_credentials.description")}
                    </p>
                </div>

                {/* Toolbar — primary "Add" button, right-aligned on
                   its own row per Figma 183:25789. Opens the
                   Select-a-login-institution popup as the first step
                   of the add-credentials flow. */}
                <div className="flex items-center justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            setAddBankSearchValue("");
                            setAddSelectedBank(null);
                            setAddChild({ kind: "institution" });
                        }}
                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                    >
                        {t("settings.login_credentials.add")}
                    </button>
                </div>
            </div>

            {/* Scroll region — table body + thead share a single overflow
               wrapper. The thead is `sticky top-0` so it stays pinned
               while the body scrolls. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar h-full overflow-auto">
                    <LoginCredentialsTable
                        rows={mockLoginCredentialRows}
                        openRowId={openRowId}
                        onOpenPopover={setOpenRowId}
                        onClosePopover={() => setOpenRowId(null)}
                        onInstitutionClick={(row) => {
                            // GDT routes to the Account Management
                            // popup (the same `<GdtCredentialsDialog>`
                            // the Add → Select Institution → GDT chain
                            // opens). Bank rows keep the Registered
                            // Login Credentials chain.
                            if (row.institution === "GDT") {
                                setAddChild({ kind: "gdt" });
                                return;
                            }
                            setRegisteredRow(row);
                            setRegisteredChild(null);
                        }}
                        onAuditLogsClick={() => setAuditLogsOpen(true)}
                        openMenuRowId={openMenu?.rowId ?? null}
                        onRowMenuToggle={(rowId, rect) => {
                            // Atomic swap — clicking row B's kebab
                            // while row A's menu is open closes A and
                            // opens B in a single render. Clicking the
                            // same row's kebab again toggles closed.
                            setOpenMenu((prev) =>
                                prev?.rowId === rowId
                                    ? null
                                    : { rowId, rect },
                            );
                        }}
                    />
                </div>
            </div>

            {/* Row-action menu — Figma 2236:30291. Rendered at the
               panel level (not inside the table cell) so it can portal
               to document.body and use position: fixed anchored to the
               kebab's bounding rect — escapes the table's scroll
               container without being clipped. The menu owns its own
               ESC + outside-click dismissal. */}
            {openMenu && (() => {
                const row = mockLoginCredentialRows.find(
                    (r) => r.id === openMenu.rowId,
                );
                if (!row) return null;
                return (
                    <LoginCredentialsRowMenu
                        anchorRect={openMenu.rect}
                        institution={row.institution}
                        onEdit={() => {
                            // GDT routes to the Account Management
                            // popup; bank rows surface in the existing
                            // Registered chain. Real edit wiring lands
                            // when the row-edit endpoint exists.
                            if (row.institution === "GDT") {
                                setAddChild({ kind: "gdt" });
                                return;
                            }
                            setRegisteredRow(row);
                            setRegisteredChild(null);
                        }}
                        onDelete={() => {
                            // Static UI: route through the shared
                            // confirmation dialog so the destructive
                            // action requires explicit acknowledgement.
                            // Real DELETE wiring lands later.
                            dialog.open({
                                type: "confirmation",
                                title: t("dialog.confirmation"),
                                description: t(
                                    "settings.login_credentials.delete_confirm",
                                ),
                                confirmText: t("dialog.continue"),
                                cancelText: t("dialog.cancel"),
                            });
                        }}
                        onClose={() => setOpenMenu(null)}
                    />
                );
            })()}

            {/* Audit Logs dialog — Figma 3435:22565. Independent flow,
               opens from the table's Audit Logs link; not part of the
               Registered chain. */}
            {auditLogsOpen && (
                <AuditLogsDialog
                    title={t("settings.login_credentials.audit_logs.title")}
                    description={t("settings.login_credentials.audit_logs.description")}
                    rows={auditLogRows}
                    onClose={() => setAuditLogsOpen(false)}
                />
            )}

            {/* Add-credentials flow — Figma chain Add button →
               Select-a-login-institution → Select Bank → Login ID/PW
               → Select Bank Accounts → Save → success → close all.
               Mirrors the Registered chain's downstream behaviour
               (each transition is a single atomic `setAddChild`
               swap so React commits unmount + mount in the same
               render — no flicker). Cancel on any step ends the
               whole flow and returns the user to the panel; Settings
               stays mounted regardless. */}

            {addChild?.kind === "institution" && (
                <SelectLoginInstitutionDialog
                    onCancel={() => setAddChild(null)}
                    onNext={(institutionId) => {
                        // Branch on the stable institution id so the
                        // chain is locale-independent. GDT collapses
                        // the bank-side multi-step chain into a
                        // single Account Management popup.
                        if (institutionId === "GDT") {
                            setAddChild({ kind: "gdt" });
                            return;
                        }
                        // Atomic swap to Select Bank — clear any
                        // bank draft from a previous run so the
                        // dropdown opens fresh.
                        setAddBankSearchValue("");
                        setAddSelectedBank(null);
                        setAddChild({ kind: "bank" });
                    }}
                />
            )}

            {/* GDT credentials popup — Figma 2344:21946. Sibling of
               the Bank-branch's Select Bank step (both follow the
               institution picker). Static UI: Next fires the shared
               success dialog and collapses the entire Add chain
               back to the panel; Cancel / X / ESC dismiss back to
               the panel without firing success. */}
            {addChild?.kind === "gdt" && (
                <GdtCredentialsDialog
                    onCancel={() => setAddChild(null)}
                    onNext={() => {
                        const collapseChain = () => {
                            setAddChild(null);
                            setAddSelectedBank(null);
                            setAddBankSearchValue("");
                        };
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t(
                                "settings.login_credentials.gdt.save_success",
                            ),
                            onConfirm: collapseChain,
                            onClose: collapseChain,
                        });
                    }}
                />
            )}

            {addChild?.kind === "bank" && (
                <SelectBankDialog
                    value={addBankSearchValue}
                    onChange={setAddBankSearchValue}
                    onSelect={setAddSelectedBank}
                    nextDisabled={!addSelectedBank}
                    onNext={() => setAddChild({ kind: "login-id-pw" })}
                    onCancel={() => setAddChild(null)}
                />
            )}

            {addChild?.kind === "login-id-pw" && addSelectedBank && (
                <LoginIdPasswordDialog
                    key={`add-login-${addSelectedBank.id}`}
                    bankName={addSelectedBank.name}
                    bankLogo={<BankBrandLogo bankName={addSelectedBank.name} />}
                    onChooseAnotherBank={() => {
                        // Rewind to Select Bank — drop the prior
                        // selection so the user can pick a different
                        // bank cleanly.
                        setAddBankSearchValue("");
                        setAddSelectedBank(null);
                        setAddChild({ kind: "bank" });
                    }}
                    onLogin={() =>
                        setAddChild({ kind: "select-bank-accounts" })
                    }
                    onCancel={() => setAddChild(null)}
                />
            )}

            {addChild?.kind === "select-bank-accounts" && addSelectedBank && (
                <SelectBankAccountsDialog
                    key={`add-bank-accounts-${addSelectedBank.id}`}
                    bankName={addSelectedBank.name}
                    bankLogo={<BankBrandLogo bankName={addSelectedBank.name} />}
                    onBack={() => setAddChild({ kind: "login-id-pw" })}
                    onSave={() => {
                        // Mirror the Registered flow's success
                        // pattern. Any dismissal of the success
                        // popup (OK / X / ESC / backdrop) commits
                        // the save and tears down the entire Add
                        // chain back to the panel.
                        const collapseChain = () => {
                            setAddChild(null);
                            setAddSelectedBank(null);
                            setAddBankSearchValue("");
                        };
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t(
                                "settings.login_credentials.select_bank_accounts.save_success",
                            ),
                            onConfirm: collapseChain,
                            onClose: collapseChain,
                        });
                    }}
                />
            )}

            {/* Registered Login Credentials dialog — Figma 3881:22605.
               Stays mounted as the parent of the entire chain. `key`
               re-seeds the per-row password reveal state when switching
               from row A to row B. */}
            {registeredRow && (
                <RegisteredLoginCredentialsDialog
                    key={`registered-${registeredRow.id}`}
                    institutionName={registeredRow.institution}
                    logo={<BankBrandLogo bankName={registeredRow.institution} />}
                    entries={buildRegisteredCredentialEntries(registeredRow)}
                    onClose={closeRegistered}
                    onPasswordIconClick={(entry) => {
                        // Open Confirmation as a CHILD on top of
                        // Registered. Registered stays mounted behind.
                        setConfirmValue("");
                        setRegisteredChild({ kind: "confirmation", entry });
                    }}
                    onEdit={(entry) => {
                        // Open Edit Login ID/PW as a CHILD on top of
                        // Registered, seeded with the row's loginId for
                        // the read-only ID field. Registered stays
                        // mounted behind.
                        setRegisteredChild({
                            kind: "edit-login-id-pw",
                            entry,
                        });
                    }}
                    onAddLogin={() => {
                        // Open Login ID/PW as a CHILD on top of
                        // Registered. Registered stays mounted behind.
                        setRegisteredChild({ kind: "login-id-pw" });
                    }}
                />
            )}

            {/* Login ID/PW form popup — Figma 1081:25293. Renders as a
               child Radix dialog over Registered. Login auto-enables
               inside the dialog when all 3 fields are filled; clicking
               Login swaps the child to Select Bank Accounts (single
               atomic setState — same pattern as Choose another bank). */}
            {registeredRow && registeredChild?.kind === "login-id-pw" && (
                <LoginIdPasswordDialog
                    key={`add-login-${registeredRow.id}`}
                    bankName={registeredRow.institution}
                    bankLogo={<BankBrandLogo bankName={registeredRow.institution} />}
                    onChooseAnotherBank={() => {
                        // Replace the child WITH Select Bank — Registered
                        // stays mounted behind. Single setState call so
                        // the Login ID/PW unmount and Select Bank mount
                        // are atomic with respect to React's commit.
                        setBankSearchValue("");
                        setSelectedBank(null);
                        setRegisteredChild({ kind: "select-bank" });
                    }}
                    onLogin={() => {
                        setRegisteredChild({ kind: "select-bank-accounts" });
                    }}
                    onCancel={closeChild}
                />
            )}

            {/* Select Bank popup — Figma 1081:25861. Sibling child of
               Login ID/PW (mutually exclusive); both share Registered as
               the parent. Next swaps the child back to Login ID/PW —
               same atomic-setState pattern as the reverse transition,
               so neither popup ever flickers off-screen alongside its
               replacement. `selectedBank` is intentionally NOT cleared
               here so a future Login ID/PW pass can read it. */}
            {registeredRow && registeredChild?.kind === "select-bank" && (
                <SelectBankDialog
                    value={bankSearchValue}
                    onChange={setBankSearchValue}
                    onSelect={setSelectedBank}
                    nextDisabled={!selectedBank}
                    onNext={() => setRegisteredChild({ kind: "login-id-pw" })}
                    onCancel={closeChild}
                />
            )}

            {/* Select Bank Accounts popup — Figma 1081:25485. Sibling of
               Login ID/PW + Select Bank + Confirmation. Back swaps the
               child back to Login ID/PW (single atomic setState — Login
               ID/PW remounts via its `key` so the form fields are reset).
               Save fires the shared system success dialog; OK collapses
               the entire Registered chain back to the Login Credentials
               panel — the parent Settings modal is owned by the shell
               and stays mounted regardless. */}
            {registeredRow && registeredChild?.kind === "select-bank-accounts" && (
                <SelectBankAccountsDialog
                    key={`select-bank-accounts-${registeredRow.id}`}
                    bankName={selectedBank?.name ?? registeredRow.institution}
                    bankLogo={
                        <BankBrandLogo
                            bankName={
                                selectedBank?.name ?? registeredRow.institution
                            }
                        />
                    }
                    onBack={() => setRegisteredChild({ kind: "login-id-pw" })}
                    onSave={() => {
                        // Tear down every popup in the Registered chain so
                        // the user lands back on the Login Credentials
                        // panel inside the still-mounted Settings modal.
                        // Wired to BOTH `onConfirm` (OK click) and
                        // `onClose` (X / ESC / backdrop click) so any
                        // dismissal of the success popup commits the
                        // save outcome — the success dialog is
                        // confirm-only, there is no "cancel and stay
                        // on Select Bank Accounts" branch.
                        const collapseChain = () => {
                            setRegisteredChild(null);
                            setRegisteredRow(null);
                            setSelectedBank(null);
                            setBankSearchValue("");
                        };
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t(
                                "settings.login_credentials.select_bank_accounts.save_success",
                            ),
                            onConfirm: collapseChain,
                            onClose: collapseChain,
                        });
                    }}
                />
            )}

            {/* Edit Login ID/PW popup — Figma 2781:23399. Sibling of
               Login ID/PW + Select Bank + Select Bank Accounts +
               Confirmation. The ID field is rendered read-only (gray)
               from the row's loginId; only the password fields are
               editable. Cancel + Save both close back to Registered.
               `key` re-seeds the form state when switching between
               rows so opening row B after row A doesn't carry row A's
               draft password. */}
            {registeredRow && registeredChild?.kind === "edit-login-id-pw" && (
                <EditLoginIdPasswordDialog
                    key={`edit-login-${registeredChild.entry.loginId}`}
                    idValue={registeredChild.entry.loginId}
                    onCancel={closeChild}
                    onSave={() => {
                        // Static UI: Save just returns to Registered.
                        // Real PATCH wiring lands when the credentials
                        // endpoint exists.
                        closeChild();
                    }}
                />
            )}

            {/* Password confirmation popup — Figma 83:12764 (Lock Screen).
               Identity strings come from the logged-in user (companyName,
               Tax ID via userId, userName as the email line). Static UI:
               Save stays disabled, so closing returns the user to
               Registered with the row still masked. */}
            {registeredRow && registeredChild?.kind === "confirmation" && (() => {
                const user = userStorage.get();
                return (
                    <PasswordConfirmationDialog
                        accessibleTitle={t("settings.login_credentials.confirmation.title")}
                        companyName={user?.companyName ?? ""}
                        companyId={user?.taxId || undefined}
                        userEmail={user?.userName ?? user?.userId ?? ""}
                        passwordAriaLabel={t("settings.login_credentials.confirmation.label")}
                        value={confirmValue}
                        onChange={setConfirmValue}
                        onClose={closeChild}
                    />
                );
            })()}
        </div>
    );
}
