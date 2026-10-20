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

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(MONO_LABEL, "h-9 px-3 text-left align-middle whitespace-nowrap", className)}
      {...props}
    />
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
        <div className={cn("bg-muted/40 border-border border-y px-3 py-3", className)}>
          {children}
        </div>
      </TableCell>
    </TableRow>
  );
}
