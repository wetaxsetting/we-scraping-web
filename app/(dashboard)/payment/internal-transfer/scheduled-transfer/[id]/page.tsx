import ScheduledTransferDetailPage from "@/components/payment/internal-transfer/ScheduledTransferDetailPage";

export const metadata = {
    title: "Internal Scheduled Transfer Detail — WeCMS",
};

export default async function PaymentInternalScheduledTransferDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <ScheduledTransferDetailPage id={id} />;
}
