import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { CONTROL_CAPS, cn } from "../../lib/utils.js";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "bg-card text-card-foreground border-border z-50 min-w-56 border p-1 shadow-xl outline-none",
          // As the popover: capped to the room on its side, so it scrolls rather than run off screen.
          "max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/**
 * An entry in narrow capitals, as the nav and the buttons are. `destructive`
 * throws work away: red, and filled as the confirm button is under the cursor,
 * since red text on the accent fill falls short of 4.5:1 in light.
 */
export function DropdownMenuItem({
  className,
  destructive = false,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        CONTROL_CAPS,
        "flex cursor-pointer items-center px-3 py-2 text-sm outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:text-subtle",
        destructive
          ? "text-destructive focus:bg-destructive focus:text-destructive-foreground"
          : "focus:bg-accent",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}
