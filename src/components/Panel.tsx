import * as React from "react";
import { cn } from "@/lib/utils";
import { BOX, CARD } from "@/lib/page-shell";
import { SettingBar } from "@/components/ui/setting-row";

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
        <header>
          <SettingBar
            action={action}
            description={description}
            className={children ? "mb-4" : undefined}
          >
            {title ? (
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {title}
              </h2>
            ) : null}
          </SettingBar>
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
