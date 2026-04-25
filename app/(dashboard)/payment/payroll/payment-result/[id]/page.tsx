import PayrollPaymentResultDetailPage from "@/components/payment/payroll/PaymentResultDetailPage";

export const metadata = {
    title: "Payroll Payment Result Detail — WeCMS",
};

export default async function PaymentPayrollResultDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <PayrollPaymentResultDetailPage id={id} />;
}
