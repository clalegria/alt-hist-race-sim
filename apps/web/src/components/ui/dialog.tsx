import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";
import { cn, DISPLAY_CAPS } from "../../lib/utils.js";

/**
 * A modal that holds a form, as opposed to `AlertDialog`, which asks a
 * question about throwing something away. The same surface as that one, so the
 * two read as one family; wider by default is the caller's call.
 *
 * Drawn as a panel is: a head band (`DialogHeader`) with the title, a body
 * (`DialogBody`), and the buttons on a strip of their own (`DialogFooter`).
 */
export const Dialog = DialogPrimitive.Root;
export const DialogClose = DialogPrimitive.Close;

export const DIALOG_OVERLAY =
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50";

/** Both dialogs' panel. No padding: the band, body and footer bring their own. */
export const DIALOG_SURFACE = cn(
  "bg-card text-card-foreground border-border fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto border shadow-xl outline-none",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
);

export function DialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={DIALOG_OVERLAY} />
      <DialogPrimitive.Content className={cn(DIALOG_SURFACE, className)} {...props} />
    </DialogPrimitive.Portal>
  );
}

/** The head band, darker than the panel as a card's is; it holds the title alone. */
export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("bg-card-header border-border shrink-0 border-b px-5 py-3", className)}
      {...props}
    />
  );
}

export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-4 px-5 py-4", className)} {...props} />;
}

export const DIALOG_TITLE = cn(DISPLAY_CAPS, "text-xl leading-tight");

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn(DIALOG_TITLE, className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/** The dialog's buttons, the confirming one last, at the right where the run bar's are. */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}
