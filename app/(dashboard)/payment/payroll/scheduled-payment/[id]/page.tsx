import PayrollScheduledPaymentDetailPage from "@/components/payment/payroll/ScheduledPaymentDetailPage";

export const metadata = {
    title: "Payroll Scheduled Payment Detail — WeCMS",
};

export default async function PaymentPayrollScheduledDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <PayrollScheduledPaymentDetailPage id={id} />;
}
