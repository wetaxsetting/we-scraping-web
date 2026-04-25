import ExpensePaymentResultDetailPage from "@/components/payment/expense-payment/PaymentResultDetailPage";

export const metadata = {
    title: "Expense Payment Result Detail — WeCMS",
};

export default async function PaymentExpenseResultDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <ExpensePaymentResultDetailPage id={id} />;
}
