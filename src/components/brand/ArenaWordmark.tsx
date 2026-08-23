import { LOCKUP, LOCKUP_LIFT } from "@/lib/brand/mark";
import { cn } from "@/lib/utils";
import { ArenaMark } from "./ArenaMark";

/*
  Same lockup pattern as Lab's "UPSIDE LAB": bold brand word, regular product
  word, uppercase, tracking-wide.

  `size` is the lockup's unit, and everything is derived from it (`LOCKUP`), so
  the whole thing scales as one object: at the header's 20 that is the 14px
  type it has always used, a 22.4px mark, and 10px between them. A hero asks
  for a bigger unit and all three come with it.

  The unit is not the mark's box. It was, and at that size the drawing stood
  0.875 of the type where Lab's stands 1.4, which is why Arena's lockup read
  as the smaller of the two. See LOCKUP.
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
  const mark = size * LOCKUP.mark;

  return (
    <span
      className={cn("flex items-center", className)}
      style={{ gap: size * LOCKUP.gap }}
    >
      <ArenaMark
        size={mark}
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
            : { transform: `translateY(${-(mark * LOCKUP_LIFT).toFixed(3)}px)` }
        }
      />
      {!markOnly ? (
        <span
          className="leading-none tracking-wide uppercase"
          style={{ fontSize: size * LOCKUP.type }}
        >
          <span className="font-bold">Upside</span>{" "}
          <span className="font-normal">Arena</span>
        </span>
      ) : null}
    </span>
  );
}
