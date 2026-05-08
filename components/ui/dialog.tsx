"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { modalStack } from "@/lib/modalStack";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Dialog primitive — Radix-backed, portal-rendered.
 *
 * Used for feature-specific popups (detail views, forms). System-level alerts
 * (warning / error / success / confirmation) still go through `useDialog()` —
 * see components/shared/dialog/. The Settings popup has its own bespoke shell
 * because the legacy WeCMS card is fixed at 1300 × 760.
 *
 * # Standard modal anatomy (Settings + feature popups)
 *
 * Every feature dialog in the app — TransferDialog, EditBankAccountDialog,
 * any future Settings popup (User Add/Edit, Preference edit, …) — composes
 * the primitive in the same shape:
 *
 *   <Dialog open={...} onOpenChange={...}>
 *     <DialogContent className="max-w-[Npx]">  // ONLY width is per-feature
 *       <DialogHeader>                          // px-6 pt-6 pr-14, gap-1
 *         <DialogTitle />                       // text-wb-18 / 600
 *         <DialogDescription />                 // text-wb-13 / 400 muted
 *       </DialogHeader>
 *       <DialogBody>                            // px-6 py-4
 *         {feature content}
 *       </DialogBody>
 *       <DialogFooter>                          // border-t, px-6 py-3, gap-2
 *         <button>{secondary — Cancel/Back}</button>  // h-9, white + shadow-wb-btn
 *         <button>{primary — Save}</button>            // h-9, bg-brand
 *       </DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 *
 * Per-feature overrides MUST be limited to:
 *   1. `max-w-*` on `<DialogContent>` (default 500 px; multi-column forms widen)
 *   2. The body's child layout (grid / flex / form rows)
 *   3. Field-specific input variants (height stays h-9, text stays text-wb-13)
 *
 * Do NOT override:
 *   - DialogHeader / DialogBody / DialogFooter padding (px-6 / pt-6 / py-4 / py-3)
 *   - DialogFooter `border-t` (gives the modal its standard separator)
 *   - Button heights (h-9), spacing (gap-2), or right-aligned order
 *   - Title / description typography
 *
 * Buttons follow `secondary → primary` left→right; both at `h-9 rounded-md
 * px-4 text-wb-14 font-medium`. Secondary uses `bg-white shadow-wb-btn`,
 * primary uses `bg-brand text-white shadow-wb-brand-btn`.
 */

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/**
 * Modal stack ramp for nested feature dialogs.
 *
 *   Level 1 — root dialog or standalone feature dialog (Settings, Edit
 *             Bank Account, …). Renders its own `bg-black/45` backdrop.
 *   Level 2 — first child stacked on top of a level-1 dialog (e.g.
 *             Registered Login Credentials over the Settings popup).
 *   Level 3 — second-tier child (e.g. Login ID/PW, Select Bank, or
 *             Password Confirmation over Registered).
 *   Level 4 — top-of-stack feedback dialog (Warning / Error / Success /
 *             Confirmation) opened above an already-stacked chain.
 *
 * # Why TWO z-index ramps (overlay vs content)
 *
 * Each level uses TWO z-indexes — overlay one notch BELOW its own
 * content — so the panel is unambiguously on top of its own backdrop
 * regardless of portal mount order, stacking-context resolution, or
 * any future ancestor that happens to create a new stacking context.
 *
 * The earlier implementation gave overlay and content the same z (both
 * `z-[70]` for L3) and relied on DOM order (content rendered after
 * overlay). That works most of the time, but a momentary inversion —
 * Radix re-mounting the portal during state transitions, or a wrapper
 * promoting its compositor layer — paints the overlay's `bg-black/20`
 * ON TOP of the panel's `bg-white`, producing a washed-out look. The
 * +1 gap between overlay and content at the same level eliminates
 * that ambiguity entirely; higher levels' overlays still cleanly
 * cover lower levels' content (60 > 50, 70 > 61, 80 > 71).
 *
 * # Per-level backdrop alpha
 *
 * Each level paints its OWN visible backdrop so opening a child clearly
 * dims its parent — without that, a child popup reads as floating in
 * mid-air over a fully-bright parent (Figma comp + dev.wecms.vn behaviour).
 * Levels 2-4 use `bg-black/20` (lighter than the root's `bg-black/45`) so
 * cumulative darkness stays readable as the stack grows:
 *   L1 alone           ≈ 45 %
 *   L1+L2              ≈ 56 %
 *   L1+L2+L3           ≈ 65 %
 *   L1+L2+L3+L4        ≈ 72 %
 *   L1+L2+L3+L4+L5     ≈ 78 %
 * Per-dialog overrides via `overlayClassName` are still honoured for
 * special cases.
 */
const STACK_Z_OVERLAY = {
    1: "z-50",
    2: "z-[60]",
    3: "z-[70]",
    4: "z-[80]",
    5: "z-[90]",
} as const;

const STACK_Z_CONTENT = {
    1: "z-50",       // L1 keeps content == overlay for parity with the
                      // historical Radix default (every standalone dialog
                      // in the app relies on it; touching this would
                      // ripple regression risk to unrelated screens).
    2: "z-[61]",
    3: "z-[71]",
    4: "z-[81]",
    5: "z-[91]",
} as const;

const STACK_OVERLAY_BG = {
    1: undefined, // inherit DialogOverlay's bg-black/45 default
    2: "bg-black/20",
    3: "bg-black/20",
    4: "bg-black/20",
    5: "bg-black/20",
} as const;

export type DialogStackLevel = keyof typeof STACK_Z_OVERLAY;

const DialogOverlay = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            className,
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
        /** Hide the default close (X) affordance in the top-right. */
        hideClose?: boolean;
        /**
         * Stack depth for this dialog. Drives both the content and overlay
         * z-index, and switches the overlay backdrop to transparent at
         * levels 2+ so the root's dim isn't compounded. Defaults to `1`
         * (z-50, bg-black/45) — matches the historical standalone behavior.
         */
        stackLevel?: DialogStackLevel;
        /**
         * Optional className passed through to the dialog's overlay layer.
         * Takes precedence over the stack-level defaults — use for custom
         * backdrops (e.g. an explicit lighter dim on a Level-2 dialog).
         */
        overlayClassName?: string;
        /**
         * When `false`, pointer-down on the overlay/backdrop does NOT close
         * the dialog. Stacked dialogs (`stackLevel >= 2`) default to
         * `false` — a click that lands on the lighter overlay near the
         * panel edge would otherwise dismiss a nested popup by mistake,
         * which is the canonical "child popup closed when I clicked
         * around" complaint. Standalone dialogs (`stackLevel === 1`)
         * default to `true` to preserve historical Radix behaviour.
         */
        closeOnOutsideClick?: boolean;
        /**
         * When `false`, pressing Escape does NOT close the dialog.
         * Defaults to `true` at every level — Escape is the only
         * keyboard close path for users who can't reach the Cancel
         * button, so disable explicitly (e.g. for an in-progress
         * destructive flow).
         */
        closeOnEscape?: boolean;
    }
>((
    {
        className,
        children,
        hideClose = false,
        stackLevel = 1,
        overlayClassName,
        closeOnOutsideClick,
        closeOnEscape = true,
        onPointerDownOutside,
        onInteractOutside,
        onEscapeKeyDown,
        ...props
    },
    ref,
) => {
    const zOverlay = STACK_Z_OVERLAY[stackLevel];
    const zContent = STACK_Z_CONTENT[stackLevel];
    const overlayBg = STACK_OVERLAY_BG[stackLevel];
    // L1 keeps Radix's "click outside to dismiss" behaviour; nested
    // dialogs default to button-only close. Either default is overridable
    // per-call via `closeOnOutsideClick`.
    const dismissOnOutside = closeOnOutsideClick ?? stackLevel === 1;
    // Register in the shared modal stack so ESC only dismisses the
    // top-most modal — keeps Radix dialogs in lockstep with the custom
    // SettingsModal / SystemDialog shells. See lib/modalStack.ts. Push
    // lives inside the effect (not render) so StrictMode's double-
    // invoke cycle balances push/pop correctly.
    const stackIdRef = React.useRef<number | null>(null);
    React.useEffect(() => {
        const id = modalStack.push();
        stackIdRef.current = id;
        return () => {
            modalStack.pop(id);
            stackIdRef.current = null;
        };
    }, []);
    return (
        <DialogPortal>
            <DialogOverlay className={cn(zOverlay, overlayBg, overlayClassName)} />
            <DialogPrimitive.Content
                ref={ref}
                className={cn(
                    // Feature modals default to 500px max (matches useDialog cap).
                    // Callers pass their own `max-w-*` / `w-*` when they need more.
                    "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-32px)] w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-white shadow-[0_2px_30px_0_rgba(0,0,0,0.08)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                    zContent,
                    className,
                )}
                onPointerDownOutside={(event) => {
                    onPointerDownOutside?.(event);
                    if (!dismissOnOutside && !event.defaultPrevented) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    onInteractOutside?.(event);
                    if (!dismissOnOutside && !event.defaultPrevented) {
                        event.preventDefault();
                    }
                }}
                onEscapeKeyDown={(event) => {
                    onEscapeKeyDown?.(event);
                    // Only the top-most modal in the shared stack
                    // responds to Escape — prevents a single keypress
                    // from cascading through multiple stacked modals.
                    if (
                        stackIdRef.current !== null &&
                        !modalStack.isTop(stackIdRef.current) &&
                        !event.defaultPrevented
                    ) {
                        event.preventDefault();
                        return;
                    }
                    if (!closeOnEscape && !event.defaultPrevented) {
                        event.preventDefault();
                    }
                }}
                {...props}
            >
                {children}
                {!hideClose && (
                    <DialogPrimitive.Close
                        className="absolute right-4 top-4 flex size-6 cursor-pointer items-center justify-center rounded-sm text-wb-ink outline-none ring-offset-white transition-opacity hover:bg-black/5 focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:pointer-events-none"
                        aria-label="Close"
                    >
                        <X className="size-[18px]" strokeWidth={2} />
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPortal>
    );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "flex flex-col gap-1 px-6 pt-6 pr-14 text-left",
                className,
            )}
            {...props}
        />
    );
}

function DialogBody({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("px-6 py-4", className)} {...props} />;
}

function DialogFooter({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "flex flex-row items-center justify-end gap-2 border-t border-wb-border-sidebar px-6 py-3",
                className,
            )}
            {...props}
        />
    );
}

const DialogTitle = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn(
            "text-wb-18 font-semibold tracking-wb-tight text-wb-dark",
            className,
        )}
        {...props}
    />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-wb-13 font-normal text-wb-muted", className)}
        {...props}
    />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Dialog,
    DialogTrigger,
    DialogPortal,
    DialogClose,
    DialogOverlay,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogTitle,
    DialogDescription,
};
