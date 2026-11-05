import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-wb-14 font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "bg-brand text-white hover:bg-brand-hover shadow-wb-brand-btn",
                destructive:
                    "bg-destructive text-white hover:bg-destructive/90",
                outline:
                    "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                ghost:
                    "hover:bg-accent hover:text-accent-foreground",
                link: "text-primary underline-offset-4 hover:underline",
                // WeInvoice / WeCMS button system (UI Spec v1.0 "Buttons"):
                //   primary — main CTA · brand — white + brand label (page action bar)
                //   neutral — Cancel / Close · danger — destructive · subtle — icon-only row action
                primary:
                    "bg-brand text-white hover:bg-brand-hover shadow-wb-brand-btn tracking-wb-tight cursor-pointer disabled:cursor-not-allowed",
                brand:
                    "bg-white text-brand hover:bg-brand-soft shadow-wb-btn tracking-wb-tight cursor-pointer disabled:cursor-not-allowed",
                neutral:
                    "bg-white text-wb-ink hover:bg-wb-bg-sidebar shadow-wb-btn tracking-wb-tight cursor-pointer disabled:cursor-not-allowed",
                danger:
                    "bg-white text-wb-red-07 hover:bg-wb-status-rejected-bg shadow-wb-warning-btn ring-1 ring-wb-red-04 tracking-wb-tight cursor-pointer disabled:cursor-not-allowed",
                subtle:
                    "bg-transparent text-wb-ntrl-7 hover:bg-black/5 tracking-wb-tight cursor-pointer disabled:cursor-not-allowed",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-8 px-3 text-wb-12",
                lg: "h-12 px-6 text-wb-16",
                icon: "h-10 w-10",
                // WeInvoice sizes — 32 px compact, 36 px default.
                "wb-sm": "h-8 px-3 text-wb-13",
                md: "h-9 px-4 text-wb-14",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
        /** Leading glyph rendered before the label (ignored with `asChild`). */
        icon?: React.ReactNode;
    };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    function Button({ className, variant, size, asChild = false, icon, children, ...props }, ref) {
        if (asChild) {
            return (
                <Slot
                    ref={ref}
                    data-slot="button"
                    className={cn(buttonVariants({ variant, size, className }))}
                    {...props}
                >
                    {children}
                </Slot>
            );
        }
        return (
            <button
                ref={ref}
                type="button"
                data-slot="button"
                className={cn(buttonVariants({ variant, size, className }))}
                {...props}
            >
                {icon}
                {children}
            </button>
        );
    },
);

export { Button, buttonVariants };
