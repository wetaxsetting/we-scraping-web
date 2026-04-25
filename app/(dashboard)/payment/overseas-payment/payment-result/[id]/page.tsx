import OverseasPaymentResultDetailPage from "@/components/payment/overseas-payment/PaymentResultDetailPage";

export const metadata = {
    title: "Overseas Payment Result Detail — WeCMS",
};

export default async function PaymentOverseasResultDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <OverseasPaymentResultDetailPage id={id} />;
}
