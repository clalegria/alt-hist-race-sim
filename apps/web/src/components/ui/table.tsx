import type { ComponentProps, ReactNode } from "react";
import { cn, MONO_LABEL } from "../../lib/utils.js";

/**
 * A table that scrolls horizontally rather than squashing its columns, which
 * matters on a phone: the championship has eight numeric columns and none of
 * them are worth wrapping.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-card-header border-border border-b", className)} {...props} />;
}

/** `striped` alternates the rows' fill; the rule is in `index.css`, under the accent. */
export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("striped [&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-border hover:bg-muted/60 border-b transition-colors", className)}
      {...props}
    />
  );
}

/** A column's head; `scope` defaults to the column, so a screen reader reads it with each cell. */
export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(MONO_LABEL, "h-9 px-3 text-left align-middle whitespace-nowrap", className)}
      {...props}
    />
  );
}

/**
 * A header row a screen reader reads and the page does not draw, for a table
 * whose columns its look already makes plain (a position block, a name, a figure).
 */
export function HiddenTableHeader({ columns }: { columns: readonly string[] }) {
  return (
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col" className="h-0 p-0">
            <span className="sr-only">{column}</span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-2 align-middle whitespace-nowrap", className)} {...props} />;
}

/**
 * A row's rank, drawn as a block in the header's fill: the first cell of a
 * classification or a championship. The accent goes on through `className`
 * (`STANDOUT_POSITION`, `PODIUM_POSITION`), never as a tint on the row.
 * `min-w` as well as `w`: beside a `w-full` cell, an auto-layout table shrinks
 * a plain width to its content, and the block to a sliver.
 */
export function TablePosition({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "bg-card-header w-10 min-w-10 px-0 py-2 text-center align-middle font-semibold whitespace-nowrap tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/**
 * What an opened row shows, across the whole table beneath it. Marked
 * `data-expansion` so the stripes skip it and keep their order below.
 *
 * **An opened row never widens the table it opens in.** A table cell is never
 * narrower than its content, so a table inside it that wanted more room than
 * the screen spread the row's own columns apart. The box asks for no width
 * (`w-0`) and then fills the cell (`min-w-full`), so the columns are sized by
 * the rows alone; anything still too wide scrolls inside the box.
 */
export function TableExpansion({
  colSpan,
  className,
  children,
}: {
  colSpan: number;
  /** For the box inside the cell, which holds the opened content. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <TableRow data-expansion="" className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0">
        <div
          className={cn("bg-muted/40 border-border w-0 min-w-full border-y px-3 py-3", className)}
        >
          {children}
        </div>
      </TableCell>
    </TableRow>
  );
}
