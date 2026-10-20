import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "bg-card text-card-foreground border-border z-50 w-72 border p-4 shadow-xl outline-none",
          // Radix flips a panel above or below but never slides it up or down, so one
          // too tall for either side ran off the top; capped, it scrolls instead.
          "max-h-(--radix-popover-content-available-height) overflow-y-auto",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/**
 * The head band, darker than the panel as a card's and a dialog's are: the title
 * at the left, and at the right whatever is said of it (an age, a count, a car).
 *
 * The band runs to the panel's edges, so a popover that wears one sets
 * `PopoverContent` to `p-0` and pads what is under the band with `PopoverBody`.
 */
export function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-card-header border-border flex items-center justify-between gap-2 border-b px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

/** What is under the band, padded as the panel was before it had one. */
export function PopoverBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}
