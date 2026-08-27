import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  Label left, one control right, one row at every width.

  Ported from Lab. A paragraph next to a search field still wants to stack
  on a phone. A setting, a menu row or a list action does not: the button
  belongs under the thumb, and wrapping it onto its own line is how the
  Account page grew a column of left-aligned blocks.

  Truncate titles on the child (`truncate`), not on this column.

  `w-full min-w-0` is what lets the row shrink inside a panel. Flex items
  default to `min-width: auto`, so without that a long label holds the row
  wider than the pane and the control is the thing that wraps or overflows.
*/
export const SETTING_ROW =
  "flex w-full min-w-0 flex-row flex-nowrap items-center justify-between gap-3";
export const SETTING_COPY = "min-w-0 flex-1";
/*
  Shrink-0 so a long label ellipsises instead of shoving the control onto
  the next line. The page gutter, the panel pad and the body's safe-area
  inset keep this off the iOS edge-swipe and off a classic scrollbar.
*/
export const SETTING_ACTIONS =
  "flex shrink-0 items-center justify-end gap-2";
/** Title row, then the sentence. Never put that sentence in the title column. */
export const SETTING_STACK = "flex flex-col gap-1.5";

function hasCopy(node: ReactNode) {
  return Children.toArray(node).length > 0;
}

/** Title | control. A `description` sits under the row, never beside the control. */
export function SettingBar({
  children,
  action,
  description,
  align = "center",
  className,
}: {
  children?: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  align?: "center" | "start";
  className?: string;
}) {
  const copy = hasCopy(children);
  const bar = (
    <div
      className={cn(
        SETTING_ROW,
        align === "start" && "items-start",
        !copy && "justify-end",
        description == null && className
      )}
    >
      {copy ? <div className={SETTING_COPY}>{children}</div> : null}
      {action != null ? <div className={SETTING_ACTIONS}>{action}</div> : null}
    </div>
  );
  if (description == null) return bar;
  return (
    <div className={cn(SETTING_STACK, className)}>
      {bar}
      {typeof description === "string" ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : (
        description
      )}
    </div>
  );
}
