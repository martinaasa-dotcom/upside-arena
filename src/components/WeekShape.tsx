import { formatPercent } from "@/lib/format";

/*
  A week as five bars.

  The single percentage says how it ended; this says how it went. That is the
  part worth looking at twice, and the part that makes a card worth posting
  when the ending was bad: a week that climbed all week and gave it back on
  Friday is a story, and "-1.2%" on its own is not.
*/
export function WeekShape({ marks }: { marks: number[] }) {
  if (marks.length === 0) return null;

  const low = Math.min(...marks, 0);
  const high = Math.max(...marks, 0);
  const range = high - low || 1;

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  return (
    <div className="flex items-end gap-2" aria-hidden="false">
      {marks.map((mark, index) => {
        // A floor, so a flat day still reads as a day rather than a gap.
        const height = Math.max(6, ((mark - low) / range) * 72);
        return (
          <div key={index} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-[72px] w-full items-end">
              <div
                className={`w-full rounded-sm ${mark >= 0 ? "bg-primary" : "bg-loss/85"}`}
                style={{ height }}
                title={`${days[index] ?? `Day ${index + 1}`}: ${formatPercent(mark)}`}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {days[index] ?? index + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}
