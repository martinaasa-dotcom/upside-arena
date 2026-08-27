import { Children, type ComponentProps, type ReactNode } from "react";
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
}: ComponentProps<"section"> & {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  const hasHeader = Boolean(title || action);
  /*
    `{false && x}` and `null` are not a body. Truthiness on `children` treated
    them as one, so the header grew a margin over an empty pane.
  */
  const hasBody = Children.toArray(children).length > 0;

  return (
    <section
      className={cn(BOX, hasHeader && hasBody && "flex flex-col gap-4", className)}
      {...props}
    >
      {hasHeader ? (
        <header>
          <SettingBar action={action} description={description}>
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
export function Well({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(CARD, className)} {...props} />;
}
