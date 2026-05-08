"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import AuditLogsDialog, {
    type AuditLogRow,
} from "@/components/shared/popups/AuditLogsDialog";
import LoginIdPasswordDialog from "@/components/shared/popups/LoginIdPasswordDialog";
import SelectBankAccountsDialog from "@/components/shared/popups/SelectBankAccountsDialog";
import SelectBankDialog from "@/components/shared/popups/SelectBankDialog";
import type { BankOption } from "@/components/shared/popups/selectBankBanks";
import {
    ViewSettingPopover,
    type ViewSettingItem,
} from "@/components/shared/view-setting";
import { useTranslation } from "@/lib/i18n";

import { mockAuditLogs } from "./auditLogsMockData";
import BankAccountTable from "./BankAccountTable";
import BankBrandLogo from "./BankBrandLogo";
import {
    BANK_ACCOUNT_FIELD_LABEL_KEY,
    DEFAULT_BANK_ACCOUNT_VIEW_SETTING_ITEMS,
    type BankAccountFieldId,
} from "./columns";
import EditBankAccountDialog from "./EditBankAccountDialog";
import { mockBankAccountRows } from "./mockData";
import PermissionDialog, { type PermissionKind } from "./PermissionDialog";
import {
    VIEW_PERMISSION_INITIAL,
    WITHDRAWAL_PERMISSION_INITIAL,
} from "./permissionMockData";
import type { BankAccountRow } from "./types";

/**
 * Bank Account panel — Settings popup submenu (Figma 142:18741).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]      — title + description on the left, list-action icon
 *                   button on the right.
 *   [Table]       — single scroll region: vertical for tall row sets,
 *                   horizontal because the column set is wider than the
 *                   modal content area.
 *   [Add button]  — pinned BELOW the scroll region as a full-width
 *                   bordered "+ Add" row.
 *
 * Static UI: clicking the list icon opens the shared <ViewSettingPopover>
 * (Figma 142:19692) seeded with local mock items — Save / Reset are
 * no-ops on this static panel; the popover still surfaces the standard
 * confirmation + success dialogs so the chrome reads identical to the
 * main-page popover. CLAUDE.md §13 requires the shared component for any
 * View Setting surface; backend wiring (`useViewSetting` hook + Flyway
 * seed) lands when the settings API is ported.
 */
/**
 * Discriminated union for the popup currently visible in the +Add chain.
 * `null` keeps the chain closed — all three popups are mutually exclusive
 * children of the Settings modal, so they swap atomically rather than
 * stack on top of each other (CLAUDE.md §"Modal stacking convention" —
 * sibling-child pattern, all at level 2).
 */
type AddBankStep =
    | { kind: "select-bank" }
    | { kind: "login-id-pw" }
    | { kind: "select-bank-accounts" };

export default function BankAccountPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /**
     * Anchor rect of the icon button at the moment the popover opened.
     * The shared popover positions itself relative to this; clearing the
     * anchor closes the popover and unmounts the portal.
     */
    const [vsAnchor, setVsAnchor] = useState<DOMRect | null>(null);

    /**
     * Working draft for the popover. Initialised from the static defaults
     * each time the popover opens so cancel reliably discards local edits
     * (matches the main-page contract). Save / Reset replace the draft;
     * because this is static UI both branches just snap back to the
     * defaults, but routing them through state keeps the component
     * shape identical to the API-backed pages.
     */
    const [vsDraft, setVsDraft] = useState<ViewSettingItem[]>(
        DEFAULT_BANK_ACCOUNT_VIEW_SETTING_ITEMS,
    );

    /**
     * Row currently being edited via the Edit Bank Account dialog
     * (Figma 142:21385). `null` keeps the dialog closed; setting a row
     * opens it seeded with that row's values. The dialog itself is
     * static-UI — Save / Back / overlay-click all just clear this state.
     */
    const [editingAccount, setEditingAccount] = useState<BankAccountRow | null>(null);

    /**
     * Which permission dialog is open, if any. The same shared
     * <PermissionDialog> handles both kinds — the `kind` field selects
     * the title and the initial selection preset. `null` keeps both
     * popups closed.
     */
    const [permissionKind, setPermissionKind] = useState<PermissionKind | null>(null);

    /**
     * Whether the Audit Logs dialog is open. Static-UI: the dialog
     * shows the same mock log rows regardless of which row triggered
     * it — once the API lands, swap to `auditLogsRow: BankAccountRow`
     * so the dialog can fetch per-account history.
     */
    const [auditLogsOpen, setAuditLogsOpen] = useState(false);

    /**
     * +Add chain state — mirrors the Login Credentials Add flow exactly
     * (Figma 1081:25861 → 1081:25293 → 1081:25485). Three popups, only
     * one mounted at a time:
     *
     *   Select Bank → Login ID/PW → Select Bank Accounts → success dialog
     *
     * All three popups are level-2 children of the Settings modal and
     * swap atomically (sibling pattern) so neither flickers off-screen
     * alongside its replacement. The selected bank survives across the
     * chain so the downstream popups can render the bank's brand logo.
     *
     * Static-UI: Next on Select Bank advances to Login ID/PW; Login on
     * Login ID/PW advances to Select Bank Accounts; Save on Select
     * Bank Accounts opens the shared system success dialog and any
     * dismissal collapses the entire chain back to the panel.
     */
    const [addStep, setAddStep] = useState<AddBankStep | null>(null);
    const [addBankSearchValue, setAddBankSearchValue] = useState("");
    const [addSelectedBank, setAddSelectedBank] = useState<BankOption | null>(null);

    function openAddBank() {
        setAddBankSearchValue("");
        setAddSelectedBank(null);
        setAddStep({ kind: "select-bank" });
    }

    function closeAddChain() {
        setAddStep(null);
        setAddSelectedBank(null);
        setAddBankSearchValue("");
    }

    function handleOpenViewSetting(rect: DOMRect) {
        setVsDraft(DEFAULT_BANK_ACCOUNT_VIEW_SETTING_ITEMS);
        setVsAnchor(rect);
    }

    function closeViewSetting() {
        setVsAnchor(null);
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — title + description left, icon-only action button right.
               pt-14 drops the row below the shell's absolute Esc/X group
               (top-4 right-4) so the icon button can sit at the natural
               px-8 right edge without overlapping the close affordance. */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-8 pb-5 pt-14">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.bank_account.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.bank_account.description")}
                    </p>
                </div>
                {/* Bare icon button — matches the canonical style used by
                   <PageActionButtons> on the main pages: no border, no
                   shadow, no card wrapper; just rounded-md p-1 + a hover
                   tint. Captures its DOMRect to anchor the popover. */}
                <button
                    type="button"
                    aria-label={t("view_setting.aria.list_button")}
                    onClick={(e) =>
                        handleOpenViewSetting(
                            e.currentTarget.getBoundingClientRect(),
                        )
                    }
                    className="flex shrink-0 cursor-pointer items-center justify-center rounded-md p-1 hover:bg-black/5"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/assets/common/ico-list.svg"
                        alt=""
                        aria-hidden
                        className="size-5"
                    />
                </button>
            </div>

            {/* Scroll region — owns BOTH axes. Vertical scroll keeps the
               header sticky; horizontal scroll covers the wider column
               set. Padding lives on the inner wrapper so the scrollbar
               sits flush with the modal edges. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8">
                <div className="custom-scrollbar h-full overflow-auto">
                    <BankAccountTable
                        rows={mockBankAccountRows}
                        onAccountClick={setEditingAccount}
                        onViewPermissionClick={() => setPermissionKind("view")}
                        onWithdrawalPermissionClick={() =>
                            setPermissionKind("withdrawal")
                        }
                        onAuditLogsClick={() => setAuditLogsOpen(true)}
                    />
                </div>
            </div>

            {/* Fixed bottom — "+ Add" button (Figma 142:19306). The Figma
               spec uses the project's standard outline-button: rounded-md
               + default-button shadow stack (no dashed border), 14px
               medium label, 16px plus icon. Sits OUTSIDE the scroll
               container so it stays visible no matter how many rows the
               table contains. */}
            <div className="shrink-0 px-8 py-3">
                <button
                    type="button"
                    onClick={openAddBank}
                    className="flex h-8 w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-white px-3 text-wb-14-tight font-medium text-wb-ink shadow-wb-btn hover:bg-black/[0.03]"
                >
                    <Plus className="size-4" strokeWidth={2} />
                    {t("settings.bank_account.add")}
                </button>
            </div>

            {/* Select Bank popup — Figma 1081:25861, reused via the
               shared <SelectBankDialog>. Opened by the "+ Add" button
               above; sits at stackLevel=2 because it's a direct child
               of the Settings modal (no Registered popup in between).
               Cancel / X / overlay-click / ESC dismiss only this
               dialog per CLAUDE.md §"Modal stack — interaction & close
               behaviour". Next swaps the child to Login ID/PW
               atomically (single setState — no flicker between steps). */}
            {addStep?.kind === "select-bank" && (
                <SelectBankDialog
                    stackLevel={2}
                    value={addBankSearchValue}
                    onChange={setAddBankSearchValue}
                    onSelect={setAddSelectedBank}
                    nextDisabled={!addSelectedBank}
                    onNext={() => setAddStep({ kind: "login-id-pw" })}
                    onCancel={closeAddChain}
                />
            )}

            {/* Login ID/PW popup — Figma 1081:25293, reused via the
               shared <LoginIdPasswordDialog>. Sibling of Select Bank +
               Select Bank Accounts (mutually exclusive). Choose Another
               Bank rewinds to Select Bank with the prior selection
               cleared. Login swaps the child to Select Bank Accounts
               atomically. Cancel / X / overlay-click / ESC collapse
               the chain. */}
            {addStep?.kind === "login-id-pw" && addSelectedBank && (
                <LoginIdPasswordDialog
                    key={`add-login-${addSelectedBank.id}`}
                    stackLevel={2}
                    bankName={addSelectedBank.name}
                    bankLogo={<BankBrandLogo bankName={addSelectedBank.name} />}
                    onChooseAnotherBank={() => {
                        setAddBankSearchValue("");
                        setAddSelectedBank(null);
                        setAddStep({ kind: "select-bank" });
                    }}
                    onLogin={() => setAddStep({ kind: "select-bank-accounts" })}
                    onCancel={closeAddChain}
                />
            )}

            {/* Select Bank Accounts popup — Figma 1081:25485, reused via
               the shared <SelectBankAccountsDialog>. Sibling of Select
               Bank + Login ID/PW (mutually exclusive). Back swaps the
               child back to Login ID/PW; the selected bank survives so
               the form re-renders with the same logo. Save fires the
               shared system success dialog; any dismissal of that
               dialog (OK / X / ESC / backdrop) collapses the entire
               chain back to the panel. The Settings modal is owned by
               the shell and stays mounted regardless. */}
            {addStep?.kind === "select-bank-accounts" && addSelectedBank && (
                <SelectBankAccountsDialog
                    key={`add-bank-accounts-${addSelectedBank.id}`}
                    stackLevel={2}
                    bankName={addSelectedBank.name}
                    bankLogo={<BankBrandLogo bankName={addSelectedBank.name} />}
                    onBack={() => setAddStep({ kind: "login-id-pw" })}
                    onSave={() => {
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t(
                                "settings.login_credentials.select_bank_accounts.save_success",
                            ),
                            onConfirm: closeAddChain,
                            onClose: closeAddChain,
                        });
                    }}
                />
            )}

            {/* Edit Bank Account dialog — Figma 142:21385. Opens when the
               user clicks an account-name link in the table. Conditional
               mount + `key` re-seed the form state from the clicked row
               — switching from row A to row B remounts the dialog rather
               than leaking row A's draft into row B. */}
            {editingAccount && (
                <EditBankAccountDialog
                    key={editingAccount.id}
                    account={editingAccount}
                    onClose={() => setEditingAccount(null)}
                />
            )}

            {/* View / Withdrawal Permission dialogs — Figma 166:24840 /
               166:25059. Single shared component, parameterised by
               `kind`. Conditional mount + `key={kind}` re-seeds the
               selection state when the user opens a different popup
               so View's draft never leaks into Withdrawal. */}
            {permissionKind && (
                <PermissionDialog
                    key={permissionKind}
                    kind={permissionKind}
                    initial={
                        permissionKind === "view"
                            ? VIEW_PERMISSION_INITIAL
                            : WITHDRAWAL_PERMISSION_INITIAL
                    }
                    onClose={() => setPermissionKind(null)}
                />
            )}

            {/* Audit Logs dialog — Figma 166:25291. Conditional mount so
               the inner dialog state resets cleanly between opens. The
               shared dialog renders pre-translated strings, so the
               activity vocabulary is resolved here before passing in. */}
            {auditLogsOpen && (
                <AuditLogsDialog
                    title={t("settings.bank_account.audit_logs.title")}
                    description={t("settings.bank_account.audit_logs.description")}
                    rows={mockAuditLogs.map<AuditLogRow>((row) => ({
                        id: row.id,
                        date: row.date,
                        time: row.time,
                        user: row.user,
                        activity: t(
                            `settings.bank_account.audit_logs.activity.${row.activity}`,
                        ),
                        details: row.details,
                    }))}
                    onClose={() => setAuditLogsOpen(false)}
                />
            )}

            {/* Shared View Setting popover — Figma 142:19692.
               Static-UI handlers: Save snapshots the draft (no API), Reset
               restores defaults locally. The popover still walks through
               its built-in confirmation + success dialogs so the visual
               chrome matches the main-page popover. */}
            {vsAnchor && (
                <ViewSettingPopover
                    anchorRect={vsAnchor}
                    items={vsDraft}
                    onItemsChange={setVsDraft}
                    getLabel={(item) => {
                        const key =
                            BANK_ACCOUNT_FIELD_LABEL_KEY[
                                item.field_id as BankAccountFieldId
                            ];
                        return key ? t(key) : item.field_nm;
                    }}
                    onSave={() => {
                        closeViewSetting();
                    }}
                    onReset={() => {
                        setVsDraft(DEFAULT_BANK_ACCOUNT_VIEW_SETTING_ITEMS);
                    }}
                    onClose={closeViewSetting}
                />
            )}
        </div>
    );
}
