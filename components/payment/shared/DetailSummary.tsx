import { cn } from "@/lib/utils";

export type DetailSummaryField = {
    label: string;
    value: React.ReactNode;
};

type DetailSummaryProps = {
    fields: DetailSummaryField[];
    className?: string;
};

/**
 * Summary card for a Payment detail page — a single row of label/value
 * pairs (Withdrawal Bank, Account No, Total Transfer Amount, Approval Ref.,
 * Requestor in the live system). Wraps to a column stack below `md`.
 *
 * Typography per Figma 8:599:
 *   label → `text-wb-13 font-medium text-wb-ntrl-6`
 *   value → `text-wb-13 font-semibold text-wb-ink`
 * Both label and value are 13 px — values are NOT 14 px.
 */
export default function DetailSummary({ fields, className }: DetailSummaryProps) {
    return (
        <div
            className={cn(
                "flex shrink-0 flex-wrap gap-x-12 gap-y-4",
                className,
            )}
        >
            {fields.map((f) => (
                <div key={f.label} className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-wb-13 font-medium text-wb-ntrl-6">
                        {f.label}
                    </span>
                    <span className="text-wb-13 font-semibold text-wb-ink">
                        {f.value}
                    </span>
                </div>
            ))}
        </div>
    );
}
