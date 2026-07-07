/**
 * Static colgroup for the Card Transactions table. Column order mirrors the
 * legacy `card_0001_001` `table1` View Setting seed.
 *
 * <h3>Intentional exception to the "widths come from the DB `size`" rule
 * (CLAUDE.md §13)</h3>
 *
 * Unlike Approval Box / Account Inquiry / Transaction History, this table is
 * NOT (yet) View-Setting-driven for column order / visibility — it renders a
 * fixed 15-column layout, and `useViewSetting` feeds only the popover +
 * Excel export. Its widths therefore stay as `--w-wb-ct-*` tokens, which are
 * kept 1:1 with the `SYS_SCR_OPTION_WECMS` seed sizes (each token carries its
 * FIELD_ID in a comment in `globals.css`), with ONE deliberate divergence:
 * the `MEMO` action column is `--w-wb-ct-note: 48px` (icon-only) rather than
 * the seed's 100px — honoring the seed here would over-widen an icon slot.
 * `MEMO` / `CHECKBOX` are `VIEW_SETTING_SPECIAL_FIELD_IDS`, so they are
 * structural columns, not user-configurable widths.
 *
 * Migrating this table to the shared {@link ViewSettingColgroup} +
 * DB-`size`-driven widths is a follow-up that must land together with
 * View-Setting-driven column order / visibility for the body — a larger
 * change than a width swap. Until then the token↔seed parity above is the
 * contract; do not silently drift the tokens from the seed.
 */
export default function CardTransactionsTableColumns() {
    return (
        <colgroup>
            <col className="w-[var(--w-wb-ct-checkbox)]" />
            <col className="w-[var(--w-wb-ct-datetime)]" />
            <col className="w-[var(--w-wb-ct-card-number)]" />
            <col className="w-[var(--w-wb-ct-merchant)]" />
            <col className="w-[var(--w-wb-ct-nickname)]" />
            <col className="w-[var(--w-wb-ct-cardholder)]" />
            <col className="w-[var(--w-wb-ct-currency)]" />
            <col className="w-[var(--w-wb-ct-amount)]" />
            <col className="w-[var(--w-wb-ct-reporting)]" />
            <col className="w-[var(--w-wb-ct-status)]" />
            <col className="w-[var(--w-wb-ct-purpose)]" />
            <col className="w-[var(--w-wb-ct-link-ref)]" />
            <col className="w-[var(--w-wb-ct-description)]" />
            <col className="w-[var(--w-wb-ct-approval-ref)]" />
            <col className="w-[var(--w-wb-ct-note)]" />
        </colgroup>
    );
}

export const CT_COLUMN_COUNT = 15;
