"use client";

/**
 * Centered empty-state copy rendered below the table header when a
 * Payment list / detail table resolves to zero rows. Matches the
 * `<AccountInquiryPage>` pattern: same flex slot, same typography
 * tokens (`text-wb-13 font-medium text-wb-ntrl-6`), same vertical
 * padding — so every Payment page reads as one product.
 *
 * Caller passes a pre-translated string so the shell stays i18n-free
 * (translation happens at the consumer page via `t(...)`).
 */
export default function TableEmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-1 items-center justify-center px-3 py-12 text-wb-13 font-medium text-wb-ntrl-6">
            {message}
        </div>
    );
}
