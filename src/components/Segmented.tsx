"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = { value: T; label: string };

/** Filled toggle row. Active segment is the warm-yellow pill with black type. */
export function Segmented<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "h-8 rounded-lg px-3 text-sm font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
              "max-[1023px]:[@media(pointer:coarse)]:h-11",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
