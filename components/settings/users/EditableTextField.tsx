import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EditableTextFieldProps = {
    placeholder?: string;
    defaultValue?: string;
    type?: "text" | "email" | "tel" | "password";
    /** Optional leading affix (e.g. the search icon Figma puts on Full
     *  Name). Renders inline before the `<input>`, inside the same
     *  outlined chip. */
    leadingIcon?: ReactNode;
    /** When true, the input flips to the disabled / view-mode skin
     *  (`bg-wb-bg-sidebar` + `text-wb-ntrl-5`) — used by the Edit form
     *  for the immutable login `ID` field. */
    disabled?: boolean;
    className?: string;
    /** Underlying `name` attribute on the `<input>` — used by the
     *  parent form's `FormData`-based collector to read the value
     *  without controlling it. */
    name?: string;
    /** Optional autocomplete hint — `new-password` on password fields
     *  inside the admin-create form so browsers don't offer to autofill
     *  the admin's OWN credentials into the new user's password slot. */
    autoComplete?: string;
};

/**
 * Outlined editable input chip — Figma 142:17631 form field.
 *
 * Shared by `<AddUserInfoForm>` and `<EditUserInfoForm>` so both modes
 * carry identical input chrome (height, padding, focus ring, leading
 * icon slot). Edit mode sets `disabled` on the ID field; otherwise
 * inputs render with the editable white-bg skin.
 *
 * The wrapper owns the visual chrome (`shadow-wb-outline` + bg) so a
 * leading icon can sit inside the chip without breaking the focus
 * ring. The `<input>` itself is `bg-transparent` and inherits the
 * chip's bg colour.
 */
export default function EditableTextField({
    placeholder,
    defaultValue,
    type = "text",
    leadingIcon,
    disabled = false,
    className,
    name,
    autoComplete,
}: EditableTextFieldProps) {
    return (
        <div
            className={cn(
                "flex h-8 w-full min-w-0 items-center gap-1 rounded-md px-2 shadow-wb-outline",
                disabled
                    ? "bg-wb-bg-sidebar"
                    : "bg-white focus-within:shadow-wb-focus",
                className,
            )}
        >
            {leadingIcon}
            <input
                type={type}
                name={name}
                defaultValue={defaultValue}
                placeholder={placeholder}
                aria-label={placeholder}
                disabled={disabled}
                autoComplete={autoComplete}
                className={cn(
                    "min-w-0 flex-1 bg-transparent text-wb-14-tight font-medium outline-none placeholder:text-wb-ntrl-5",
                    disabled
                        ? "cursor-default text-wb-ntrl-6"
                        : "text-wb-ink",
                )}
            />
        </div>
    );
}
