import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "border-input bg-card focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}
