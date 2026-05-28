"use client";

/**
 * Shared form field row for feature dialogs (New Firm Banking, Change
 * Password, future Settings forms). Renders the Figma label rhythm — a
 * `text-wb-14 / 500` label with the required red `*` — above an arbitrary
 * control (`children`). Extracted from the New Firm Banking dialog so every
 * compact modal form draws the same label / spacing / required-marker style
 * from one place (two-call rule — see wecms-web/CLAUDE.md §"Common
 * Reusability Rule").
 */
type ModalFieldProps = {
    label: string;
    /** Associates the label with the control's `id` for a11y + click-to-focus. */
    htmlFor?: string;
    /** Show the required red `*`. Defaults to `true` — every current consumer
     *  field is required; opt out for an optional field. */
    required?: boolean;
    children: React.ReactNode;
};

export default function ModalField({
    label,
    htmlFor,
    required = true,
    children,
}: ModalFieldProps) {
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={htmlFor} className="flex items-start gap-0.5">
                <span className="text-wb-14 font-medium leading-4 text-wb-ntrl-8">
                    {label}
                </span>
                {required && (
                    <span
                        aria-hidden
                        className="text-wb-14 font-medium leading-4 text-wb-status-rejected-text"
                    >
                        *
                    </span>
                )}
            </label>
            {children}
        </div>
    );
}

export type { ModalFieldProps };
