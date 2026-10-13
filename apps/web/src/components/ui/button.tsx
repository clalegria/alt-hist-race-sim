import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

/**
 * Every variant carries a border, so a filled button and an outlined one are
 * the same size. Disabled drops the fill and reads in `text-subtle`: opacity
 * would fade the text below its apparent contrast (`web-styling.md`).
 */
const VARIANTS = {
  primary:
    "border-primary bg-primary text-primary-foreground hover:bg-primary/90 disabled:border-border disabled:bg-transparent",
  /** Confirms throwing work away, in the red kept for that and for errors. */
  destructive:
    "border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:border-border disabled:bg-transparent",
  outline: "border-border hover:bg-accent bg-transparent",
  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent bg-transparent",
} as const;

const SIZES = {
  default: "h-9 px-4 text-sm",
  sm: "h-8 gap-1.5 px-3 text-xs",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

/**
 * A button's look, for something that must not be a `<button>`: a link that
 * navigates but sits among the actions, styled as one of them. Links go
 * somewhere, buttons do something — the element follows what it does.
 */
export function buttonClass(
  variant: ButtonVariant = "primary",
  className?: string,
  size: ButtonSize = "default",
): string {
  return cn(
    "focus-visible:ring-ring narrow inline-flex cursor-pointer items-center justify-center border font-bold tracking-wide uppercase transition focus-visible:ring-2 focus-visible:outline-none disabled:text-subtle disabled:pointer-events-none",
    SIZES[size],
    VARIANTS[variant],
    className,
  );
}

interface ButtonProps extends ComponentProps<"button"> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonProps) {
  return <button type="button" className={buttonClass(variant, className, size)} {...props} />;
}
