import { useEffect, useState } from "react";
import { applyTheme, otherTheme, readTheme, type Theme } from "../lib/theme.js";
import { cn } from "../lib/utils.js";

/** Hand-drawn rather than pulling in an icon set for two glyphs. */
function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
      />
    </svg>
  );
}

/**
 * Switches between the two themes and remembers the choice.
 *
 * The icon shows where the button *goes*, not where you are — a sun means
 * "switch to light" — which is the convention nearly every site follows, and the
 * label says so outright for anyone the icon does not tell.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Read once, on mount. The document already carries the right theme by then:
  // a blocking script in index.html sets it before first paint, so there is no
  // flash of the wrong palette to correct here.
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const next = otherTheme(theme);

  return (
    <button
      type="button"
      title={`Switch to ${next} theme`}
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        setTheme(next);
      }}
      className={cn(
        "border-border text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
    >
      <span className="h-4 w-4">{next === "light" ? <SunIcon /> : <MoonIcon />}</span>
    </button>
  );
}
