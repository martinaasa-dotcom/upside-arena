import { LOCKUP_LIFT } from "@/lib/brand/mark";
import { cn } from "@/lib/utils";
import { ArenaMark } from "./ArenaMark";

/*
  Same lockup pattern as Lab's "UPSIDE LAB": bold brand word, regular product
  word, uppercase, tracking-wide.

  The type is derived from the mark rather than fixed, so the lockup scales as
  one object. At the header's 20px mark that reproduces the 14px type it has
  always used; a hero can ask for a bigger mark and the words come with it.
*/
export function ArenaWordmark({
  className,
  size = 20,
  markOnly = false,
}: {
  className?: string;
  size?: number;
  markOnly?: boolean;
}) {
  return (
    <span
      className={cn("flex items-center", className)}
      style={{ gap: size * 0.4 }}
    >
      <ArenaMark
        size={size}
        title={markOnly ? "Upside Arena" : undefined}
        /*
          Lifted off the row's centre line, and only when there is type to
          stand beside. Two triangles carry their weight along the baseline,
          so a mark centred by the numbers reads as having sagged next to the
          word: the row lines up the two boxes, and the eye lines up the
          masses. LOCKUP_LIFT is where that number comes from. A transform
          rather than a margin, so the lockup's own box does not move and
          nothing around it reflows.
        */
        style={
          markOnly
            ? undefined
            : { transform: `translateY(${-(size * LOCKUP_LIFT).toFixed(3)}px)` }
        }
      />
      {!markOnly ? (
        <span
          className="leading-none tracking-wide uppercase"
          style={{ fontSize: size * 0.7 }}
        >
          <span className="font-bold">Upside</span>{" "}
          <span className="font-normal">Arena</span>
        </span>
      ) : null}
    </span>
  );
}
