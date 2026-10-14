import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";
import { DIALOG_OVERLAY, DIALOG_SURFACE, DIALOG_TITLE } from "./dialog.js";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;

// The band, body and footer are `Dialog`'s own, so the two dialogs cannot drift apart.
export {
  DialogBody as AlertDialogBody,
  DialogFooter as AlertDialogFooter,
  DialogHeader as AlertDialogHeader,
} from "./dialog.js";

export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className={DIALOG_OVERLAY} />
      <AlertDialogPrimitive.Content className={cn(DIALOG_SURFACE, className)} {...props} />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return <AlertDialogPrimitive.Title className={cn(DIALOG_TITLE, className)} {...props} />;
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
