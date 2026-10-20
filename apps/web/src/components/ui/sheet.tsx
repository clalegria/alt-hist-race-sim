import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";
import { DIALOG_OVERLAY, DIALOG_TITLE } from "./dialog.js";

/**
 * A bottom sheet: the mobile drawer pattern, a panel that rises from the foot of
 * the screen over a dimmed page. A Radix Dialog underneath, so it brings the
 * focus trap, Escape, scroll lock and the backdrop tap for free; only the
 * placement differs from `DialogContent`'s centred panel. Bottom only, which is
 * the one side anything here needs.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** Capped at four fifths of the screen, so the page behind still shows above it. */
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={DIALOG_OVERLAY} />
      <DialogPrimitive.Content
        className={cn(
          "bg-card text-card-foreground border-border fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col border-t shadow-xl outline-none",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** The head band: the title, and the ✕ at its right. */
export function SheetHeader({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card-header border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label="Close"
        className="text-muted-foreground hover:text-foreground -mr-2 px-2 py-1 text-lg leading-none"
      >
        <span aria-hidden="true">✕</span>
      </DialogPrimitive.Close>
    </div>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn(DIALOG_TITLE, className)} {...props} />;
}

/** What the sheet holds; it scrolls inside the cap, the head band staying put. */
export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
}
