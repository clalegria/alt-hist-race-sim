/**
 * Column formatting for the console tables every tool here prints.
 *
 * These were five copies of the same three functions, one per tool, which is
 * how `padRight` ended up meaning two different things: three tools truncated
 * an over-long name and two let it push the column out. Truncating is the one
 * that keeps a fixed-width table readable, so it is the one that survived — an
 * over-long cell was already producing a misaligned row in the other two.
 */

/** Left-aligned in a fixed-width column, clipped rather than allowed to overflow. */
export function padRight(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

/** Right-aligned in a fixed-width column. Numbers are never clipped. */
export function padLeft(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

/** A share of a total, to one decimal place. Zero out of zero is "0.0%". */
export function pct(value: number, total: number): string {
  return total === 0 ? "0.0%" : `${((value / total) * 100).toFixed(1)}%`;
}
