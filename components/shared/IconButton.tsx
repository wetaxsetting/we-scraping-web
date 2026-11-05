import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** Square 32px icon-only button for table "Actions" cells and toolbars. `title` doubles as the aria-label. */
export function IconButton({ title, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            data-ignore-row-click
            className={cn(
                "inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-7 hover:bg-black/5 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
                className,
            )}
            {...rest}
        >
            {children}
        </button>
    );
}
