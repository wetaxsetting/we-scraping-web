"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Lightweight anchored popover (click outside / ESC closes) used by the
 * WeInvoice filter dropdowns, row menus and header menus. Renders inline
 * under its trigger — use it for menus, not for modal flows.
 */
export function Popover({
    trigger,
    children,
    align = "left",
    width,
    className,
    open: controlledOpen,
    onOpenChange,
    rootClassName,
}: {
    rootClassName?: string;
    trigger: (args: { open: boolean; toggle: () => void }) => ReactNode;
    children: ReactNode | ((close: () => void) => ReactNode);
    align?: "left" | "right";
    width?: number;
    className?: string;
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
}) {
    const [inner, setInner] = useState(false);
    const open = controlledOpen ?? inner;
    const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInner(o));
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDoc);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            window.removeEventListener("keydown", onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const close = () => setOpen(false);
    return (
        <div ref={ref} className={cn("relative", rootClassName)} data-ignore-row-click>
            {trigger({ open, toggle: () => setOpen(!open) })}
            {open && (
                <div
                    className={cn(
                        "wb-fade-in absolute top-full z-40 mt-1 overflow-hidden rounded-md border border-wb-ntrl-4 bg-white shadow-wb-popup",
                        align === "right" ? "right-0" : "left-0",
                        rootClassName?.includes("w-full") && !width && "right-0",
                        className,
                    )}
                    style={width ? { width } : undefined}
                >
                    {typeof children === "function" ? children(close) : children}
                </div>
            )}
        </div>
    );
}

export function MenuItem({
    children,
    onClick,
    active,
    icon,
    hint,
    disabled,
}: {
    children: ReactNode;
    onClick?: () => void;
    active?: boolean;
    icon?: ReactNode;
    hint?: ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-wb-13 font-medium text-wb-ink hover:bg-wb-bg-sidebar disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
                active && "bg-brand-soft text-brand",
            )}
        >
            {icon}
            <span className="flex min-w-0 flex-1 flex-col">
                <span>{children}</span>
                {hint && <span className="text-wb-12 font-normal text-wb-ntrl-6">{hint}</span>}
            </span>
        </button>
    );
}
