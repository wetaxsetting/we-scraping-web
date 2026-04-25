import { fcyRows } from "@/components/banking/account-inquiry-fcy/mockData";
import AccountInquiryPage from "@/components/shared/AccountInquiryPage";

export const metadata = {
    title: "Account Inquiry (FCY) — WeCMS",
};

export default function BankingAccountInquiryFcyPage() {
    return (
        <AccountInquiryPage
            titleKey="account_inquiry.title_fcy"
            totalLabelKey="account_inquiry.total_label_fcy"
            rows={fcyRows}
            availableBalance="$87,420.00"
            balance="$87,420.00"
            bankFilterLabel="All Currencies"
        />
    );
}
