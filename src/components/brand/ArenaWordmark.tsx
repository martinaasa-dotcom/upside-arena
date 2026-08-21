import { cn } from "@/lib/utils";
import { ArenaMark } from "./ArenaMark";

/*
  Same lockup pattern as Lab's "UPSIDE LAB": bold brand word, regular product
  word, uppercase, tracking-wide, header size 14px.
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
    <span className={cn("flex items-center gap-2", className)}>
      <ArenaMark size={size} title={markOnly ? "Upside Arena" : undefined} />
      {!markOnly ? (
        <span className="text-[14px] leading-none tracking-wide uppercase">
          <span className="font-bold">Upside</span>{" "}
          <span className="font-normal">Arena</span>
        </span>
      ) : null}
    </span>
  );
}
