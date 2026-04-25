import ExpenseScheduledPaymentDetailPage from "@/components/payment/expense-payment/ScheduledPaymentDetailPage";

export const metadata = {
    title: "Expense Scheduled Payment Detail — WeCMS",
};

export default async function PaymentExpenseScheduledDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <ExpenseScheduledPaymentDetailPage id={id} />;
}
