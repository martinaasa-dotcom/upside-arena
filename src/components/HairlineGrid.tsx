import * as React from "react";
import { Children } from "react";
import { cn } from "@/lib/utils";

/*
  Chip row drawn with hairline gaps rather than borders.

  The column count must divide the child count exactly, otherwise the grid
  leaves an empty cell that renders as a stray filled block. This picks the
  largest allowed column count that divides evenly, so a leftover cell cannot
  happen by accident.
*/
const ALLOWED_COLUMNS = [2, 3, 4] as const;

export function HairlineGrid({
  className,
  children,
  maxColumns = 4,
  ...props
}: React.ComponentProps<"div"> & { maxColumns?: 2 | 3 | 4 }) {
  const count = Children.count(children);
  const columns =
    [...ALLOWED_COLUMNS]
      .filter((c) => c <= maxColumns && count % c === 0)
      .pop() ?? 1;

  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-lg bg-border",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function HairlineCell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 bg-[color-mix(in_oklch,var(--muted),transparent_50%)] p-4",
        className
      )}
      {...props}
    />
  );
}
