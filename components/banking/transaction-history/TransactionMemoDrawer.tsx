"use client";

import { useMemo, useState } from "react";

import { MemoDrawer, type Memo, type MemoColor } from "@/components/shared/memo";
import {
    ApiCallError,
    createTransactionMemo,
    deleteTransactionMemo,
    fetchTransactionMemos,
    updateTransactionMemo,
    updateTransactionMemoColor,
    type TransactionMemoScope,
} from "@/lib/api/banking";
import { useApiData } from "@/lib/api/useApiData";
import { useDialog } from "@/components/shared/dialog";
import { formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import type { MemoColor as WireMemoColor } from "@/lib/types/api";

/* ============================================================================
 *  Transaction History memo drawer — data + persistence container around the
 *  shared <MemoDrawer>. Mirrors the Card Transactions `CardMemoDrawer` pattern
 *  (legacy `comm_0105_001` on `MEMO_INFM`), but keys the thread with the 4-key
 *  BANK_CD/ACCT_NO/TRSC_DT/ACCT_SEQ_NO coordinate, derived server-side from
 *  the account route (`acctSeqNo`) + the transaction (`trnsSeqNo`). The
 *  `scope` (VND / FCY) selects the memo WEB_SVC_ID.
 *
 *  The shared <MemoDrawer> stays presentation-only; this container owns fetch,
 *  wire↔semantic color mapping, and the confirm / error dialogs.
 * ========================================================================== */

type TransactionMemoDrawerProps = {
    /** Account route slug (`BANK_CD_ACCT_NO`) the transaction belongs to. */
    acctSeqNo: string;
    /** The transaction's `ACCT_SEQ_NO` (list row `trnsSeqNo`). */
    trnsSeqNo: string;
    /** VND / FCY screen scope → memo WEB_SVC_ID. */
    scope: TransactionMemoScope;
    onClose:   () => void;
    /** Fired after any successful memo mutation so the parent list can
     *  refetch and the row's memo icon color/count updates. */
    onChanged?: () => void;
};

/** Wire sticker token → shared-drawer semantic color (same bijection as
 *  `CardMemoDrawer`; the drawer's PNG assets map back via mockData.MEMO_COLORS). */
const WIRE_TO_SEMANTIC: Record<WireMemoColor, MemoColor> = {
    fileG: "green",
    fileB: "blue",
    fileY: "yellow",
    fileW: "gray",
    fileR: "pink",
    fileP: "purple",
};
const SEMANTIC_TO_WIRE: Record<MemoColor, WireMemoColor> = {
    green:  "fileG",
    blue:   "fileB",
    yellow: "fileY",
    gray:   "fileW",
    pink:   "fileR",
    purple: "fileP",
};

/** yyyyMMddHHmmss (UTC) → `<localized date> HH:mm:ss`. */
function formatDtm14(value: string, locale: Locale): string {
    if (!value || value.length < 12) return "";
    const { date, time } = formatUtcDtmByLanguage(value, locale);
    return date ? `${date} ${time}` : "";
}

export default function TransactionMemoDrawer({
    acctSeqNo,
    trnsSeqNo,
    scope,
    onClose,
    onChanged,
}: TransactionMemoDrawerProps) {
    const { t, locale } = useTranslation();
    const sysDialog = useDialog();

    const [refreshKey, setRefreshKey] = useState(0);
    const bump = () => {
        setRefreshKey((k) => k + 1);
        onChanged?.();
    };

    const state = useApiData(
        () => fetchTransactionMemos(acctSeqNo, trnsSeqNo, scope),
        [acctSeqNo, trnsSeqNo, scope, refreshKey],
    );
    const rows = useMemo(() => state.data?.rows ?? [], [state.data]);

    const memos: Memo[] = useMemo(
        () =>
            rows.map((r) => ({
                id:       r.seq_no,
                author:   r.reg_nm || r.reg_id,
                message:  r.memo,
                datetime: formatDtm14(r.reg_dtm, locale),
                canEdit:  r.can_edit,
            })),
        [rows, locale],
    );

    const rowColorWire: WireMemoColor | null = rows.length > 0 ? rows[0].color : null;
    const rowColorSemantic: MemoColor = rowColorWire ? WIRE_TO_SEMANTIC[rowColorWire] : "gray";
    const [colorOverride, setColorOverride] = useState<MemoColor | null>(null);
    const selectedColor = colorOverride ?? rowColorSemantic;

    const showError = (err: unknown, fallbackKey: string) => {
        const code = err instanceof ApiCallError ? err.code : "WBE9999";
        const msg  = err instanceof ApiCallError ? err.message : t(fallbackKey);
        sysDialog.open({ type: "error", title: t("dialog.error"), description: msg, errorCode: code });
    };

    const handleAdd = async (text: string, color: MemoColor) => {
        try {
            await createTransactionMemo(acctSeqNo, trnsSeqNo, scope, {
                memo:  text,
                color: SEMANTIC_TO_WIRE[color],
            });
            bump();
        } catch (err) {
            showError(err, "txn_history.memo.error.save_failed");
        }
    };

    const handleEdit = async (id: string, text: string) => {
        try {
            await updateTransactionMemo(acctSeqNo, trnsSeqNo, scope, id, { memo: text });
            bump();
        } catch (err) {
            showError(err, "txn_history.memo.error.edit_failed");
        }
    };

    const handleDelete = (id: string) => {
        sysDialog.open({
            type:        "confirmation",
            title:       t("dialog.confirmation"),
            description: t("txn_history.memo.confirm_delete"),
            confirmText: t("dialog.continue"),
            cancelText:  t("dialog.cancel"),
            onConfirm: async () => {
                try {
                    await deleteTransactionMemo(acctSeqNo, trnsSeqNo, scope, id);
                    bump();
                } catch (err) {
                    showError(err, "txn_history.memo.error.delete_failed");
                }
            },
        });
    };

    const handleSelectColor = async (color: MemoColor) => {
        setColorOverride(color); // immediate UI feedback (derived selectedColor)
        try {
            await updateTransactionMemoColor(acctSeqNo, trnsSeqNo, scope, {
                color: SEMANTIC_TO_WIRE[color],
            });
            bump();
        } catch (err) {
            showError(err, "txn_history.memo.error.color_failed");
        }
    };

    return (
        <MemoDrawer
            onClose={onClose}
            memos={memos}
            selectedColor={selectedColor}
            loading={state.loading}
            onAddMemo={handleAdd}
            onEditMemo={handleEdit}
            onDeleteMemo={handleDelete}
            onSelectColor={handleSelectColor}
        />
    );
}
