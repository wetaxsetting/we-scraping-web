import VendorPaymentResultDetailPage from "@/components/payment/vendor-payment/PaymentResultDetailPage";

export const metadata = {
    title: "Vendor Payment Result Detail — WeCMS",
};

export default async function PaymentVendorResultDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <VendorPaymentResultDetailPage id={id} />;
}
