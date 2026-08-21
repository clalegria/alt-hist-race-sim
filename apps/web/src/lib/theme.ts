/**
 * Light and dark, chosen explicitly rather than inherited from the system.
 *
 * Dark is the default and is what plain `:root` carries in `index.css`; light is
 * an override hung off `data-theme="light"` on the document element. That way
 * the common case needs no attribute at all, and a page with JavaScript disabled
 * still renders the intended theme rather than an unstyled one.
 */

export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

/** Where the choice is remembered between visits. */
const STORAGE_KEY = "alt-hist-theme";

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Reads a stored value, falling back for anything that is not a known theme. */
export function parseTheme(raw: string | null): Theme {
  return raw === "light" || raw === "dark" ? raw : DEFAULT_THEME;
}

/**
 * The theme to start in.
 *
 * Storage access is wrapped because it throws outright in a few real
 * situations — Safari's private browsing, and any embedding that blocks
 * third-party storage — and a theme preference is never worth a blank page.
 */
export function readTheme(): Theme {
  if (typeof localStorage === "undefined") {
    return DEFAULT_THEME;
  }
  try {
    return parseTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Puts a theme on the document and remembers it. Safe to call before hydration. */
export function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Remembering is a convenience; failing to is not worth surfacing.
  }
}
