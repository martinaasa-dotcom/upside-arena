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
      <ArenaMark size={size} title={markOnly ? "Upside Arena" : undefined} />
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
