import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/*
  Lab's shipped button: h-8, rounded-lg, gold fill with near-black type,
  hover mixes 10% white into the accent plus a small scale lift.
  Coarse pointers get a 2.75rem target, desktop stays dense.
*/
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,transform,box-shadow] outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:scale-[1.015]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),white_10%)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),white_8%)]",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-accent",
        ghost: "bg-transparent text-foreground hover:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklch,var(--destructive),white_10%)]",
        link: "bg-transparent text-primary underline underline-offset-4 hover:no-underline motion-safe:hover:scale-100",
      },
      size: {
        default: "h-8 px-3 py-1 max-[1023px]:[@media(pointer:coarse)]:h-11",
        sm: "h-7 gap-1.5 px-2.5 text-xs max-[1023px]:[@media(pointer:coarse)]:h-10",
        lg: "h-9 px-4 max-[1023px]:[@media(pointer:coarse)]:h-11",
        // Landing call to action only.
        cta: "h-11 rounded-full px-5 text-sm",
        icon: "size-8 max-[1023px]:[@media(pointer:coarse)]:size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
