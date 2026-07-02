"use client";

import { useMemo, useState } from "react";

import { MemoDrawer, type Memo, type MemoColor } from "@/components/shared/memo";
import { ApiCallError } from "@/lib/api/banking";
import {
    createMemo,
    deleteMemo,
    fetchMemos,
    updateMemo,
    updateMemoColor,
} from "@/lib/api/cardTransactions";
import { useApiData } from "@/lib/api/useApiData";
import { useDialog } from "@/components/shared/dialog";
import { formatUtcDtmByLanguage } from "@/lib/datetime";
import { useTranslation, type Locale } from "@/lib/i18n";
import type { MemoColor as WireMemoColor } from "@/lib/types/api";

/* ============================================================================
 *  Card Transactions memo drawer — data + persistence container around the
 *  shared <MemoDrawer>. Wires the drawer to the live memo API (legacy
 *  `comm_0105_001` on `MEMO_INFM`, `WEB_SVC_ID="card_0001_001"`,
 *  `REF_NO=CARD_SEQ_NO`). The presentation drawer stays static-only; this
 *  container owns fetch, color mapping, and the confirm / error dialogs.
 *
 *  Row-level color: the sticker color is a property of the card transaction
 *  row (all its memos share one color). The header color tab both persists
 *  the color across the whole thread (legacy u003) and is the color used for
 *  the next Add (legacy c002 propagates it).
 * ========================================================================== */

type CardMemoDrawerProps = {
    /** {@code CARD_TRNS_HSTR.CARD_SEQ_NO} this memo thread attaches to. */
    cardSeqNo: string;
    onClose:   () => void;
    /** Fired after any successful memo mutation (add / edit / delete /
     *  color) so the parent Card Transactions list can refetch and the
     *  row's memo icon color/count updates. */
    onChanged?: () => void;
};

/** Wire sticker token → shared-drawer semantic color (bijection over the
 *  six tags; the drawer's PNG assets map back through mockData.MEMO_COLORS). */
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

/** yyyyMMddHHmmss (UTC) → `<localized date> HH:mm:ss`. Memo REG_DTM is
 *  stored UTC by the backend; convert to the active language's local view. */
function formatDtm14(value: string, locale: Locale): string {
    if (!value || value.length < 12) return "";
    const { date, time } = formatUtcDtmByLanguage(value, locale);
    return date ? `${date} ${time}` : "";
}

export default function CardMemoDrawer({ cardSeqNo, onClose, onChanged }: CardMemoDrawerProps) {
    const { t, locale } = useTranslation();
    const sysDialog = useDialog();

    const [refreshKey, setRefreshKey] = useState(0);
    // Refetch the drawer's own list AND signal the parent grid so its
    // row-level memo icon (color + count) updates after every mutation.
    const bump = () => {
        setRefreshKey((k) => k + 1);
        onChanged?.();
    };

    const state = useApiData(() => fetchMemos(cardSeqNo), [cardSeqNo, refreshKey]);
    const rows = useMemo(() => state.data?.rows ?? [], [state.data]);

    // Map wire rows → shared-drawer memos (newest-first order preserved).
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

    // Row-level color (derived, not effect state to avoid setState-in-effect):
    // the header tag reflects the thread's current color unless the user has
    // picked one this session. A pick is persisted across the whole thread and
    // used for the next Add; on refetch the row color converges to that value.
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
            await createMemo({ ref_no: cardSeqNo, memo: text, color: SEMANTIC_TO_WIRE[color] });
            bump();
        } catch (err) {
            showError(err, "payment.card.memo.error.save_failed");
        }
    };

    const handleEdit = async (id: string, text: string) => {
        try {
            await updateMemo(id, { memo: text });
            bump();
        } catch (err) {
            showError(err, "payment.card.memo.error.edit_failed");
        }
    };

    const handleDelete = (id: string) => {
        sysDialog.open({
            type:        "confirmation",
            title:       t("dialog.confirmation"),
            description: t("payment.card.memo.confirm_delete"),
            confirmText: t("dialog.continue"),
            cancelText:  t("dialog.cancel"),
            onConfirm: async () => {
                try {
                    await deleteMemo(id);
                    bump();
                } catch (err) {
                    showError(err, "payment.card.memo.error.delete_failed");
                }
            },
        });
    };

    const handleSelectColor = async (color: MemoColor) => {
        setColorOverride(color); // immediate UI feedback (derived selectedColor)
        try {
            await updateMemoColor({ ref_no: cardSeqNo, color: SEMANTIC_TO_WIRE[color] });
            bump();
        } catch (err) {
            showError(err, "payment.card.memo.error.color_failed");
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
