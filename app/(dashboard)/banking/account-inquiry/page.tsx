import AccountInquiryClient from "./AccountInquiryClient";

export const metadata = {
    title: "Account Inquiry (VND) — WeCMS",
};

export default function BankingAccountInquiryPage() {
    return <AccountInquiryClient currency="VND" />;
}
