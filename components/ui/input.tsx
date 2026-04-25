import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function Input({ className, type, ...props }, ref) {
        return (
            <input
                ref={ref}
                type={type}
                data-slot="input"
                className={cn(
                    "flex h-11 w-full min-w-0 rounded-[6px] bg-background px-3 py-3 text-wb-14 shadow-wb-outline transition-[color,box-shadow] outline-none",
                    "placeholder:text-muted-foreground",
                    "focus-visible:shadow-wb-focus",
                    "aria-invalid:shadow-[0px_0px_0px_1px_var(--color-destructive)]",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-wb-14 file:font-medium",
                    className,
                )}
                {...props}
            />
        );
    },
);

export { Input };
