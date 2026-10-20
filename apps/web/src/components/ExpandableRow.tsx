/**
 * A table row that opens, and what it opens into.
 *
 * **Each row holds its own open state**, so any number can be open at once: a
 * reader comparing two drivers' seasons or two years of an era opens both. The
 * WAI-ARIA disclosure pattern, one button per region, rather than an accordion.
 * The state is view state and only this row's, so it lives here, not in the
 * table or the store.
 *
 * `row` draws the cells and is handed the state, for the `DisclosureButton` it
 * places among them; `expansion` is drawn only while the row is open, so what
 * it derives is not worked out for every shut row.
 */

import { type ReactNode, useState } from "react";
import { cn } from "../lib/utils.js";
import type { Disclosure } from "./DisclosureButton.js";
import { TableRow } from "./ui/table.js";

export function ExpandableRow({
  defaultOpen = false,
  className,
  row,
  expansion,
}: {
  /** Open from the start: a test renders an opened row without a click. */
  defaultOpen?: boolean | undefined;
  /** The row's own classes; a fill here wins over the opened row's. */
  className?: string | undefined;
  row: (disclosure: Disclosure) => ReactNode;
  /** Under the row while it is open: a `TableExpansion`, or rows of its own. */
  expansion: () => ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const disclosure: Disclosure = {
    open,
    onToggle: () => {
      setOpen(!open);
    },
  };
  return (
    <>
      <TableRow className={cn(open && "bg-muted/60", className)}>{row(disclosure)}</TableRow>
      {open ? expansion() : null}
    </>
  );
}
