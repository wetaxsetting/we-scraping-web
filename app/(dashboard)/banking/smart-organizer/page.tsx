import SmartOrganizerPage from "@/components/banking/smart-organizer/SmartOrganizerPage";

export const metadata = {
    title: "Smart Organizer — WeCMS",
};

/**
 * Banking > Smart Organizer landing page. Refactor port of legacy
 * `fnsh_0200_001`. Empty state shows a "Go to Organizer Settings"
 * CTA that opens the rule-config dialog (legacy `fnsh_0200_002`).
 *
 * Client component composes filter row, table, and the popup —
 * see SmartOrganizerPage.tsx.
 */
export default function BankingSmartOrganizerPage() {
    return <SmartOrganizerPage />;
}
