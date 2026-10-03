import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border-border hover:bg-accent border bg-transparent",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-accent bg-transparent",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

/**
 * A button's look, for something that must not be a `<button>`: a link that
 * navigates but sits among the actions, styled as one of them. Links go
 * somewhere, buttons do something — the element follows what it does.
 */
export function buttonClass(variant: ButtonVariant = "primary", className?: string): string {
  return cn(
    "focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    className,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  readonly variant?: ButtonVariant;
}

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />;
}
