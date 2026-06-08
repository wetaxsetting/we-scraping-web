import { redirect } from "next/navigation";

export const metadata = {
    title: "Own Account Transfer — WeCMS",
};

/**
 * Legacy composer route. As of the 2026-06-06 consolidation the Own
 * Account Transfer page lives at the canonical menu route
 * `/banking/transfer-own-accounts`, which renders the same composer
 * component and opens the transfer popup in place. This route is kept
 * only so existing bookmarks / `?sourceAccountNo=` deep-links don't
 * 404 — it permanently redirects to the canonical route, forwarding the
 * `sourceAccountNo` query param so the Option-A deep-link still
 * preselects the account and auto-opens the composer there.
 *
 * Next.js 16: `searchParams` is a Promise and must be awaited.
 */
export default async function BankingOwnAccountTransferLegacyRedirect({
    searchParams,
}: {
    searchParams: Promise<{ sourceAccountNo?: string }>;
}) {
    const { sourceAccountNo } = await searchParams;
    const target = sourceAccountNo
        ? `/banking/transfer-own-accounts?sourceAccountNo=${encodeURIComponent(sourceAccountNo)}`
        : "/banking/transfer-own-accounts";
    redirect(target);
}
