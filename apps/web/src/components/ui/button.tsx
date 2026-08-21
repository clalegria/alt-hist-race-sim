import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border-border hover:bg-accent border bg-transparent",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-accent bg-transparent",
} as const;

export interface ButtonProps extends ComponentProps<"button"> {
  readonly variant?: keyof typeof VARIANTS;
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
