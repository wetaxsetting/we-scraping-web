import VendorScheduledPaymentDetailPage from "@/components/payment/vendor-payment/ScheduledPaymentDetailPage";

export const metadata = {
    title: "Vendor Scheduled Payment Detail — WeCMS",
};

export default async function PaymentVendorScheduledDetailRoute({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <VendorScheduledPaymentDetailPage id={id} />;
}
