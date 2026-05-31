"use client";

import { useMemo } from "react";

import { useStickyLoading } from "@/hooks/useStickyLoading";

import {
    isSpecialViewSettingField,
    type UseViewSettingState,
    type ViewSettingItem,
} from "./useViewSetting";

/** Minimal column shape we touch — keeps the helper decoupled from the
 *  per-feature `PaymentListColumn<R>` / similar types. The page's column
 *  factory returns concrete columns; we extend them with the seed's
 *  `size` value and re-emit. */
type WidthedColumn = {
    key: string;
    width?: string;
};

/**
 * Single source of truth for "project View Setting items → table column
 * list with DB-driven widths". Centralizes the wait-for-VS + filter +
 * sort + merge-by-FIELD_ID + width-override + minWidth pattern that
 * every page repeated locally.
 *
 * <h3>Why this hook exists</h3>
 *
 * Pages historically did:
 *
 * <pre>
 * const liveItems = vs.items.length &gt; 0 ? vs.items : FALLBACK_COLUMNS;
 * const visible = liveItems.filter(useYn === "Y" &amp;&amp; !isSpecial).sort(byDispOrd);
 * const columns = visible.map(it =&gt; ({ ...byKey[FIELD_ID_TO_COLUMN_KEY[it.field_id]], width: it.size || base.width }));
 * </pre>
 *
 * That FALLBACK fallthrough is the cause of the 105→120 width-jump
 * reported in the UI: when admin updates the DB seed past what the
 * page-shipped FALLBACK lists, the first paint renders FALLBACK widths
 * and the second paint snaps to DB widths.
 *
 * <h3>What this hook does</h3>
 *
 * <ol>
 *   <li>Returns {@code columns: []} until {@code vs.items} populates —
 *       no FALLBACK fallback for the table column projection.</li>
 *   <li>Returns {@code loading: true} (sticky-wrapped via
 *       {@link useStickyLoading}) until VS resolves so the consumer can
 *       OR it into its existing loading flag and the shared shell
 *       renders "Loading…" instead of an empty table.</li>
 *   <li>Merges each visible View Setting item into the page's base
 *       column by matching {@code field_id} → {@code column.key}
 *       through {@link Config.fieldIdToColumnKey}, then overrides
 *       {@code width} with {@code it.size}. DB is the single source of
 *       truth for width — when {@code it.size} is non-empty, the
 *       factory's CSS-var default is never read.</li>
 *   <li>Computes {@code minWidth} as the sum of visible pixel widths so
 *       the table's horizontal-scroll threshold tracks the visible
 *       column set (hiding columns shrinks the threshold). Falls back
 *       to {@link Config.fallbackMinWidth} when no pixel widths resolve
 *       (rare — only when the seed ships non-px sizes).</li>
 * </ol>
 *
 * <h3>How pages adopt it</h3>
 *
 * <pre>
 * const { columns, minWidth, loading: vsLoading } = useViewSettingColumns({
 *     vs,
 *     baseColumns: resultDetailColumns(t, opts),
 *     fieldIdToColumnKey: FIELD_ID_TO_COLUMN_KEY,
 *     fallbackMinWidth: RESULT_DETAIL_MIN_WIDTH,
 * });
 * // ...
 * &lt;ResultDetailView
 *     columns={columns}
 *     tableMinWidth={minWidth}
 *     loading={stickyInitialLoading || vsLoading}
 * /&gt;
 * </pre>
 *
 * Pages MUST drop the local {@code FALLBACK_COLUMNS} fallthrough for
 * the table column projection. The {@code FALLBACK_COLUMNS} array MAY
 * stay for the View Setting popover seed only — that's a different
 * consumer that doesn't drive table widths.
 */
export type UseViewSettingColumnsConfig<C extends WidthedColumn> = {
    /** Result of {@link useViewSetting}. */
    vs: UseViewSettingState;
    /** Columns produced by the page's per-feature factory (e.g.
     *  {@code resultDetailColumns(t)}, {@code scheduledDetailColumns(t)}).
     *  Keys must match the values in {@link fieldIdToColumnKey}. */
    baseColumns: readonly C[];
    /** Map each View Setting {@code FIELD_ID} to the matching column
     *  {@code key} from {@link baseColumns}. FIELD_IDs missing from this
     *  map are dropped from the column list (they may still appear in
     *  the popover via {@link useViewSetting}'s {@code items}). */
    fieldIdToColumnKey: Readonly<Record<string, string>>;
    /** CSS value (e.g. {@code "1500px"} or {@code var(--w-wb-xyz)}) used
     *  for {@code minWidth} when no visible column carries a pixel size.
     *  Pages typically pass their factory's {@code XYZ_MIN_WIDTH}
     *  constant. */
    fallbackMinWidth: string;
};

export type UseViewSettingColumnsResult<C extends WidthedColumn> = {
    /** Projected column list — empty array while {@link loading}. Once
     *  VS resolves, this is the visible-and-known column set with each
     *  column's {@code width} overridden by the seed's {@code size}. */
    columns: C[];
    /** Sum of visible pixel widths, or {@link Config.fallbackMinWidth}
     *  when nothing resolves. Pass directly to the shared shell's
     *  {@code tableMinWidth} / {@code minWidth} prop. */
    minWidth: string;
    /** Sticky-wrapped View Setting loading flag — true on first mount,
     *  false once the GET resolves (held visible ≥ 400 ms by
     *  {@link useStickyLoading} so the loading state doesn't flicker on
     *  fast LANs). Consumers OR this into their existing data-loading
     *  flag and pass to the shell. */
    loading: boolean;
};

export function useViewSettingColumns<C extends WidthedColumn>(
    config: UseViewSettingColumnsConfig<C>,
): UseViewSettingColumnsResult<C> {
    const { vs, baseColumns, fieldIdToColumnKey, fallbackMinWidth } = config;

    // Sticky-wrap the VS loading state so a fast LAN doesn't strobe
    // the loading skeleton on/off. Consumers OR this with their own
    // data-loading flag.
    const stickyVsLoading = useStickyLoading(vs.loading);

    // Visible items — filtered, sorted, no FALLBACK fallthrough. When
    // `vs.items` is empty (first mount, VS still loading), `visible`
    // is `[]` and `columns` is `[]` → the shared shell renders the
    // "Loading…" empty state via the consumer's `loading` flag.
    const visible: ViewSettingItem[] = useMemo(
        () =>
            vs.items
                .filter(
                    (it) =>
                        it.use_yn === "Y" &&
                        !isSpecialViewSettingField(it.field_id) &&
                        fieldIdToColumnKey[it.field_id] !== undefined,
                )
                .slice()
                .sort((a, b) => a.disp_ord - b.disp_ord),
        [vs.items, fieldIdToColumnKey],
    );

    // Index base columns by key so the projection step is a single map
    // lookup per item. Stable across renders unless the factory output
    // changes — pages that pass new objects every render (e.g. closures
    // capturing translation state) will recompute this every render,
    // which is cheap.
    const columnByKey = useMemo(() => {
        const map = new Map<string, C>();
        for (const c of baseColumns) map.set(c.key, c);
        return map;
    }, [baseColumns]);

    const columns: C[] = useMemo(() => {
        return visible
            .map((it) => {
                const key = fieldIdToColumnKey[it.field_id];
                const base = columnByKey.get(key);
                if (!base) return null;
                // `it.size` wins when present (DB single source of
                // truth). Falls back to the factory's CSS-var default
                // ONLY when the seed ships an empty `size` — should
                // never happen in practice with V###-aligned seeds.
                return { ...base, width: it.size || base.width };
            })
            .filter((c): c is C => c !== null);
    }, [visible, columnByKey, fieldIdToColumnKey]);

    const minWidth: string = useMemo(() => {
        const total = visible.reduce((sum, it) => {
            const m = (it.size ?? "").match(/^(\d+(?:\.\d+)?)px$/);
            return m ? sum + parseFloat(m[1]) : sum;
        }, 0);
        return total > 0 ? `${total}px` : fallbackMinWidth;
    }, [visible, fallbackMinWidth]);

    return { columns, minWidth, loading: stickyVsLoading };
}
