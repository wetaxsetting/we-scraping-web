import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type UserFormFieldProps = {
    label: string;
    required?: boolean;
    className?: string;
    children: ReactNode;
};

/**
 * Label + optional red asterisk + control wrapper used by every Users
 * form field (`<UserDetailView>` view-mode + `<AddUserInfoForm>` edit-
 * mode). Extracted here so the two consumers share one label
 * typography rule — `text-wb-14-tight font-medium text-wb-ntrl-8` —
 * and one required-asterisk colour.
 */
export default function UserFormField({
    label,
    required,
    className,
    children,
}: UserFormFieldProps) {
    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <span className="flex items-start gap-0.5 text-wb-13 font-medium text-wb-ntrl-8">
                {label}
                {required ? (
                    <span aria-hidden className="text-destructive">
                        *
                    </span>
                ) : null}
            </span>
            {children}
        </div>
    );
}
