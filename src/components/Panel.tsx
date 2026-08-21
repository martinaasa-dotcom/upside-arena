import * as React from "react";
import { cn } from "@/lib/utils";
import { BOX, CARD } from "@/lib/page-shell";

/** Top-level panel. The ambient glow has to read through it. */
export function Panel({
  className,
  title,
  description,
  action,
  children,
  ...props
}: React.ComponentProps<"section"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn(BOX, className)} {...props}>
      {title || action ? (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Nested well. Use inside a Panel, never as a top-level surface. */
export function Well({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn(CARD, className)} {...props} />;
}
