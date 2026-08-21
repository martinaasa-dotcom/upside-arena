import * as React from "react";
import { cn } from "@/lib/utils";
import { SCORE_CELL } from "@/lib/page-shell";

/** Score cards sit in a gap-4 grid, never a hairline bar of numbers. */
export function Scoreboard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}
      {...props}
    />
  );
}

export function Score({
  label,
  value,
  hint,
  tone = "neutral",
  // A figure is set in tabular mono. Words standing in for a figure that does
  // not exist yet are prose, and reading them in mono makes them look broken.
  as = "figure",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "neutral" | "gain" | "loss";
  as?: "figure" | "text";
}) {
  return (
    <div className={cn(SCORE_CELL, "flex flex-col gap-1", className)} {...props}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-2xl font-bold",
          as === "figure" ? "figure" : "text-muted-foreground",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss"
        )}
      >
        {value}
      </span>
      {hint ? <span className="text-sm text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
