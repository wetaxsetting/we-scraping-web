import OverseasScheduledPaymentDetailPage from "@/components/payment/overseas-payment/ScheduledPaymentDetailPage";

export const metadata = {
    title: "Overseas Scheduled Payment Detail — WeCMS",
};

export default async function PaymentOverseasScheduledDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <OverseasScheduledPaymentDetailPage id={id} />;
}
