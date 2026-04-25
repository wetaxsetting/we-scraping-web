import TransferResultDetailPage from "@/components/payment/internal-transfer/TransferResultDetailPage";

export const metadata = {
    title: "Internal Transfer Result Detail — WeCMS",
};

export default async function PaymentInternalTransferResultDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <TransferResultDetailPage id={id} />;
}
