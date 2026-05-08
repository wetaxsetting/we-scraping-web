"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { useTranslation } from "@/lib/i18n";

import EditFirmBankingDetailsDialog from "./EditFirmBankingDetailsDialog";
import FirmBankingAutomationSettings from "./FirmBankingAutomationSettings";
import FirmBankingDetailsDialog from "./FirmBankingDetailsDialog";
import FirmBankingLinkedAccounts from "./FirmBankingLinkedAccounts";
import FirmBankingRowMenu from "./FirmBankingRowMenu";
import NewFirmBankingDialog from "./NewFirmBankingDialog";
import { mockAutomationSettings, mockLinkedAccounts } from "./mockData";
import type {
    FirmBankingAutomationKey,
    FirmBankingAutomationSetting,
    FirmBankingLinkedAccount,
} from "./types";

/**
 * Firm Banking Settings panel — Figma 134:17061 (Settings popup submenu).
 *
 * Layout (top → bottom, all inside the modal's right column):
 *   [Header]              — title + description (left) and brand "+ Add"
 *                           button (right). pr-24 clears the shell's Esc/X.
 *   [Scrolling content]   — Automation Settings + Linked Accounts. The
 *                           container owns the only scroll region so the
 *                           header stays visible when the list grows.
 *
 * Static UI: the toggles flip in local state, but no API call fires; the
 * + Add button and the per-row kebab are wired as no-ops until the backend
 * lands. Mirrors the FirmBankingHistoryPanel scroll shape so future API
 * hooks slot in without restructuring the layout.
 */
export default function FirmBankingSettingsPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    /** Routes both menu Delete actions (row kebab + details-modal
     *  kebab) through the shared destructive confirmation dialog. The
     *  callback is a no-op on confirm — real DELETE wiring lands when
     *  the backend endpoint exists. */
    const openDeleteConfirm = () =>
        dialog.open({
            type: "confirmation",
            destructive: true,
            title: t(
                "settings.firm_banking_settings.confirm_delete.title",
            ),
            description: t(
                "settings.firm_banking_settings.confirm_delete.description",
            ),
            confirmText: t(
                "settings.firm_banking_settings.confirm_delete.confirm",
            ),
            cancelText: t(
                "settings.firm_banking_settings.confirm_delete.cancel",
            ),
        });

    const [automation, setAutomation] = useState<FirmBankingAutomationSetting[]>(
        mockAutomationSettings,
    );
    const [accounts] = useState<FirmBankingLinkedAccount[]>(mockLinkedAccounts);
    const [isAdding, setIsAdding] = useState(false);
    /** Open row-menu state — Figma 5936:24741. Stores the account id +
     *  kebab DOMRect so the portal-rendered menu can pin itself with
     *  `position: fixed`. Single-menu-at-a-time: clicking row B's
     *  kebab while row A's menu is open closes A and opens B in one
     *  setState. */
    const [openMenu, setOpenMenu] = useState<
        { accountId: string; rect: DOMRect } | null
    >(null);
    /** The account currently being edited via the row-menu's Edit
     *  action. Drives the EditFirmBankingDetailsDialog. Keyed remount
     *  on `account.id` so opening row B after row A starts with a
     *  fresh draft. */
    const [editingAccount, setEditingAccount] =
        useState<FirmBankingLinkedAccount | null>(null);
    /** The account whose Firm Banking Details modal is currently
     *  open (row click → details). Independent from editingAccount —
     *  the two modals are mutually exclusive at the UI level but the
     *  states are tracked separately so opening one doesn't reset the
     *  other accidentally. */
    const [detailsAccount, setDetailsAccount] =
        useState<FirmBankingLinkedAccount | null>(null);

    const handleAutomationToggle = (key: FirmBankingAutomationKey, next: boolean) => {
        setAutomation((prev) =>
            prev.map((row) => (row.key === key ? { ...row, enabled: next } : row)),
        );
    };

    const handleMore = (account: FirmBankingLinkedAccount, rect: DOMRect) => {
        setOpenMenu((prev) =>
            prev?.accountId === account.id ? null : { accountId: account.id, rect },
        );
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {/* Header — title + description (left) and Add button (right).
               `pt-[calc(var(--spacing)*14)]` (= 56 px) drops the title
               row below the shell's absolute Esc/X group (y=16–40), so
               the Add button can occupy the natural right edge
               (`px-8` → 32 px from the modal edge). Esc/X stacks ABOVE
               the title row at the same right edge, matching Figma
               134:17070 (Title + Add row) layered under 134:17065
               (Esc/X). No extra `pr-24` reservation — the vertical
               offset alone keeps the two corners distinct. */}
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 px-8 pb-5 pt-[calc(var(--spacing)*14)]">
                <div className="min-w-0">
                    <h3 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
                        {t("settings.firm_banking_settings.title")}
                    </h3>
                    <p className="mt-1 text-wb-13 font-normal text-wb-muted">
                        {t("settings.firm_banking_settings.description")}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
                >
                    <Plus className="size-4" strokeWidth={2.25} />
                    {t("settings.firm_banking_settings.add")}
                </button>
            </div>

            {isAdding && (
                <NewFirmBankingDialog onClose={() => setIsAdding(false)} />
            )}

            {editingAccount && (
                <EditFirmBankingDetailsDialog
                    // Namespaced key — when Edit opens from inside
                    // Details, both dialogs are mounted as siblings of
                    // the panel root with the SAME account. React
                    // requires unique keys per sibling slot regardless
                    // of component type, so prefix the dialog name.
                    key={`edit-${editingAccount.id}`}
                    onClose={() => setEditingAccount(null)}
                    // When Edit opens from the Details modal, Details
                    // is still mounted underneath — Edit must stack at
                    // L3 so its overlay lines up above Details (L2)
                    // per components/ui/dialog.tsx. When Edit opens
                    // from a row kebab (no Details), it stays at L2.
                    stackLevel={detailsAccount ? 3 : 2}
                />
            )}

            {detailsAccount && (
                <FirmBankingDetailsDialog
                    key={`details-${detailsAccount.id}`}
                    onClose={() => setDetailsAccount(null)}
                    onEdit={() => {
                        // Open Edit on TOP of Details — Details stays
                        // mounted (the user can ESC out of Edit and
                        // land back on Details). The previous
                        // implementation closed Details too, which
                        // accidentally collapsed the chain.
                        setEditingAccount(detailsAccount);
                    }}
                    onDelete={() => {
                        // Open the destructive confirmation on top of
                        // Details. SystemDialog renders at z-[100],
                        // above every feature stackLevel, so it
                        // naturally covers Details without us closing
                        // it. Cancel / Delete return the user to the
                        // still-open Details modal.
                        openDeleteConfirm();
                    }}
                />
            )}

            {/* Row-action menu — Figma 5936:24741. Rendered at the
               panel level (not inside the row cell) so it can portal
               to document.body and use position: fixed anchored to
               the kebab's bounding rect — escapes the panel's
               overflow-hidden without being clipped. The menu owns
               its own ESC + outside-click dismissal. */}
            {openMenu && (() => {
                const account = accounts.find(
                    (a) => a.id === openMenu.accountId,
                );
                if (!account) return null;
                return (
                    <FirmBankingRowMenu
                        anchorRect={openMenu.rect}
                        bankLabel={account.bankName}
                        onEdit={() => setEditingAccount(account)}
                        onDelete={openDeleteConfirm}
                        onClose={() => setOpenMenu(null)}
                    />
                );
            })()}

            {/* Scroll region — Automation + Linked Accounts stack and scroll
               together once the list grows past the modal height. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar h-full overflow-y-auto pr-1">
                    <div className="flex flex-col gap-5">
                        <FirmBankingAutomationSettings
                            settings={automation}
                            onToggle={handleAutomationToggle}
                        />
                        <FirmBankingLinkedAccounts
                            accounts={accounts}
                            onItemClick={setDetailsAccount}
                            onMore={handleMore}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
