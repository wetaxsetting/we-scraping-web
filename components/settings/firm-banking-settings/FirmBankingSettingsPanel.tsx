"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { useDialog } from "@/components/shared/dialog";
import { useEnvironmentSettings } from "@/hooks/useEnvironmentSettings";
import { ApiCallError } from "@/lib/api/banking";
import {
    ENV_AUTO_MATCH_CD,
    ENV_AUTO_TRANSFER_CD,
} from "@/lib/api/environmentSettings";
import {
    deleteFirmBankingSetting,
    fetchFirmBankingSettings,
} from "@/lib/api/firmBankingSettings";
import { mapFirmBankingSettingRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useTranslation } from "@/lib/i18n";

import EditFirmBankingDetailsDialog from "./EditFirmBankingDetailsDialog";
import FirmBankingAutomationSettings from "./FirmBankingAutomationSettings";
import FirmBankingDetailsDialog from "./FirmBankingDetailsDialog";
import FirmBankingLinkedAccounts from "./FirmBankingLinkedAccounts";
import FirmBankingRowMenu from "./FirmBankingRowMenu";
import NewFirmBankingDialog from "./NewFirmBankingDialog";
import { mockLinkedAccounts } from "./mockData";
import type {
    FirmBankingAutomationKey,
    FirmBankingAutomationSetting,
    FirmBankingLinkedAccount,
} from "./types";

/**
 * UI-side registry for Automation Settings rows. Each entry binds a
 * legacy {@code BUSI_ENV_SET_INFM.ENV_SET_INF} code to the React
 * row's semantic key + label translation key. Order here is render
 * order on screen — first row is "Match …", second row is
 * "Transfer …" (Figma 134:17083). Adding a new row means appending
 * to this array and seeding the env-settings store on the backend
 * — no change to the panel composition.
 */
const AUTOMATION_REGISTRY: ReadonlyArray<{
    key: FirmBankingAutomationKey;
    envCd: string;
    labelKey: string;
}> = [
    {
        key: "match_payment_after_history",
        envCd: ENV_AUTO_MATCH_CD,
        labelKey:
            "settings.firm_banking_settings.automation.match_payment_after_history",
    },
    {
        key: "transfer_after_full_approval",
        envCd: ENV_AUTO_TRANSFER_CD,
        labelKey:
            "settings.firm_banking_settings.automation.transfer_after_full_approval",
    },
];

/** Stable codes-array passed to the {@code useEnvironmentSettings}
 *  hook — module-scoped so its reference does not change between
 *  panel renders, which would otherwise re-fire the load effect. */
const AUTOMATION_CODES: ReadonlyArray<string> = AUTOMATION_REGISTRY.map(
    (r) => r.envCd,
);

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
 * Automation toggles route through {@link useEnvironmentSettings} —
 * legacy {@code BUSI_ENV_SET_INFM} codes {@code 00078} / {@code 00079},
 * immediate-save semantics with optimistic update + revert on backend
 * rejection. The linked-accounts list is the live API path with a mock
 * fallback for offline dev.
 */
export default function FirmBankingSettingsPanel() {
    const { t } = useTranslation();
    const dialog = useDialog();

    // Tenant environment-settings — legacy BUSI_ENV_SET_INFM, codes
    // 00078 (Auto Transfer) + 00079 (Auto Match). The hook fires one
    // GET per code in parallel on mount (mirrors legacy
    // comm_0600_001_r001 single-row contract with COALESCE(BUSI, SYS)
    // fallback) and exposes optimistic-update semantics matching
    // legacy comm_0220_001.ts:111 (immediate save on click, revert
    // on backend rejection).
    const env = useEnvironmentSettings(AUTOMATION_CODES);
    const automation: FirmBankingAutomationSetting[] = useMemo(
        () =>
            AUTOMATION_REGISTRY.map((row) => ({
                key: row.key,
                envCd: row.envCd,
                labelKey: row.labelKey,
                enabled: env.values[row.envCd] ?? false,
            })),
        [env.values],
    );

    // Refetch trigger — bumped after a successful delete to re-run the
    // list loader. `useApiData` re-fires its loader whenever a `deps`
    // entry changes; passing `refetchToken` here is the cheapest way
    // to trigger a refresh without restructuring the hook.
    const [refetchToken, setRefetchToken] = useState(0);

    // Live list — Phase 3 (Path A) + Delete slice. The panel stays
    // mounted while the fetch is in flight; the existing rounded
    // wrapper renders an empty state until rows arrive. On failure
    // (network outage, backend not running, auth-token expiry) the
    // panel falls back to the static mock so offline development
    // still sees a working layout. The fallback IS observable — the
    // user sees stale-looking data — and the next backend MR should
    // route `list.error` through `dialog.open({ type: "error" })`
    // mirroring the firm-banking-history pattern. Tracked as Major
    // Finding #1 in the 2026-05-09 review.
    const list = useApiData(fetchFirmBankingSettings, [refetchToken]);
    const accounts: FirmBankingLinkedAccount[] = useMemo(() => {
        if (list.data) return list.data.list.map(mapFirmBankingSettingRow);
        if (list.error) return mockLinkedAccounts;
        return [];
    }, [list.data, list.error]);

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

    /**
     * Routes both menu Delete actions (row kebab + details-modal
     * kebab) through the shared destructive confirmation dialog. On
     * Continue, fires the live DELETE call, surfaces success / error
     * through the shared dialog, and (on success) refetches the list.
     * Wired 2026-05-09 once the backend DELETE endpoint shipped — per
     * OQ-2 the path writes no audit row, so it has no shared
     * AuditLogService dependency.
     */
    const openDeleteConfirm = useCallback(
        (account: FirmBankingLinkedAccount) =>
            dialog.open({
                type: "confirmation",
                title: t("dialog.confirmation"),
                description: t(
                    "settings.firm_banking_settings.confirm_delete.description",
                ),
                confirmText: t("dialog.continue"),
                cancelText: t(
                    "settings.firm_banking_settings.confirm_delete.cancel",
                ),
                onConfirm: async () => {
                    try {
                        await deleteFirmBankingSetting(
                            account.outBankCd,
                            account.wdrlActNo,
                        );
                        // Close any details/edit modals pinned to the
                        // now-deleted row so the user does not look at
                        // a stale dialog after the row vanishes from
                        // the list.
                        setDetailsAccount((prev) =>
                            prev?.id === account.id ? null : prev,
                        );
                        setEditingAccount((prev) =>
                            prev?.id === account.id ? null : prev,
                        );
                        setOpenMenu((prev) =>
                            prev?.accountId === account.id ? null : prev,
                        );
                        setRefetchToken((n) => n + 1);
                        dialog.open({
                            type: "success",
                            title: t("dialog.success"),
                            description: t(
                                "settings.firm_banking_settings.delete_success",
                            ),
                        });
                    } catch (err) {
                        const code =
                            err instanceof ApiCallError ? err.code : "WBE9999";
                        const message =
                            err instanceof Error
                                ? err.message
                                : t("common.error.unknown");
                        dialog.open({
                            type: "error",
                            title: t("dialog.error"),
                            description: message,
                            errorCode: code,
                        });
                    }
                },
            }),
        [dialog, t],
    );

    const handleAutomationToggle = useCallback(
        async (key: FirmBankingAutomationKey, next: boolean) => {
            const entry = AUTOMATION_REGISTRY.find((r) => r.key === key);
            if (!entry) return;
            try {
                await env.setEnabled(entry.envCd, next);
            } catch (err) {
                const code = err instanceof ApiCallError ? err.code : "WBE9999";
                const message =
                    err instanceof Error
                        ? err.message
                        : t("common.error.unknown");
                dialog.open({
                    type: "error",
                    title: t("dialog.error"),
                    description: message,
                    errorCode: code,
                });
            }
        },
        [dialog, env, t],
    );

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
                <NewFirmBankingDialog
                    onClose={() => setIsAdding(false)}
                    onCreated={() => {
                        // Bump the panel's refetch token so the live
                        // list re-fires with the newly-added row. The
                        // dialog's own success toast triggers onClose
                        // when dismissed, so no setIsAdding(false) is
                        // needed here — same lifecycle as Edit.
                        setRefetchToken((n) => n + 1);
                    }}
                />
            )}

            {editingAccount && (
                <EditFirmBankingDetailsDialog
                    // Namespaced key — when Edit opens from inside
                    // Details, both dialogs are mounted as siblings of
                    // the panel root with the SAME account. React
                    // requires unique keys per sibling slot regardless
                    // of component type, so prefix the dialog name.
                    key={`edit-${editingAccount.id}`}
                    account={editingAccount}
                    onClose={() => setEditingAccount(null)}
                    onSaved={() => {
                        // Bump the panel's refetch token so the live
                        // list re-fires and the row reflects the
                        // saved state. The dialog itself opens the
                        // success toast and triggers onClose when the
                        // user dismisses, so no UI close needed here.
                        setRefetchToken((n) => n + 1);
                    }}
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
                    account={detailsAccount}
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
                        // still-open Details modal — except on a
                        // successful Delete, where the confirmation's
                        // onConfirm closes Details + refetches the
                        // list (see openDeleteConfirm).
                        openDeleteConfirm(detailsAccount);
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
                        onDelete={() => openDeleteConfirm(account)}
                        onClose={() => setOpenMenu(null)}
                    />
                );
            })()}

            {/* Scroll region — Automation + Linked Accounts stack and scroll
               together once the list grows past the modal height. */}
            <div className="min-h-0 flex-1 overflow-hidden px-8 pb-6">
                <div className="custom-scrollbar h-full overflow-y-auto pr-1">
                    <div className="flex flex-col gap-5">
                        {env.loading ? (
                            <p
                                role="status"
                                className="px-2.5 py-3 text-wb-13 font-medium text-wb-ntrl-6"
                            >
                                {t(
                                    "settings.firm_banking_settings.automation.loading",
                                )}
                            </p>
                        ) : env.loadError ? (
                            <p
                                role="alert"
                                className="px-2.5 py-3 text-wb-13 font-medium text-wb-ntrl-6"
                            >
                                {t(
                                    "settings.firm_banking_settings.automation.load_failed",
                                )}
                            </p>
                        ) : (
                            <FirmBankingAutomationSettings
                                settings={automation}
                                onToggle={handleAutomationToggle}
                            />
                        )}
                        {list.loading ? (
                            <p
                                role="status"
                                className="px-2.5 py-3 text-wb-13 font-medium text-wb-ntrl-6"
                            >
                                {t("settings.firm_banking_settings.list.loading")}
                            </p>
                        ) : accounts.length === 0 ? (
                            <p className="px-2.5 py-3 text-wb-13 font-medium text-wb-ntrl-6">
                                {t("settings.firm_banking_settings.list.empty")}
                            </p>
                        ) : (
                            <FirmBankingLinkedAccounts
                                accounts={accounts}
                                onItemClick={setDetailsAccount}
                                onMore={handleMore}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
