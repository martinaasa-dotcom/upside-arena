import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { SETTING_COPY, SettingBar } from "@/components/ui/setting-row";

/*
  The first week, as four things to do rather than three things to read.

  This used to be a paragraph that explained the game and then disappeared the
  moment somebody made a trade -- which is the moment they had done exactly one
  of the four things that make Arena worth having. They had pretend money and
  a company, no opponent, no reason to come back on Wednesday, and nothing left
  on screen suggesting there was more to it.

  So it is a list now, and it goes when the list is done. Each line is a thing
  that changes the game rather than a thing that explains it:

    buying something is what makes the number move,
    somebody else in your league is what makes the number matter,
    saying what you are going to do is the one mechanic that reliably works,
    and a battle is what stops the fourth week being the first week again.

  It still never nags. Nothing here expires, nothing is worth points, and a
  person who does one of the four and stops has lost nothing at all.
*/
export type FirstWeekStep = {
  done: boolean;
  title: string;
  detail: string;
  href: string;
  action: string;
};

export function FirstRun({
  startingBalance,
  leagueName,
  inviteCode,
  leagueHref,
  hasTraded,
  hasCompany,
  hasGoal,
  hasBattle,
}: {
  startingBalance: number;
  leagueName: string | null;
  inviteCode: string | null;
  /** Where "invite someone" and "start a battle" should go. */
  leagueHref: string;
  hasTraded: boolean;
  /** True once somebody else is in one of their leagues. */
  hasCompany: boolean;
  hasGoal: boolean;
  hasBattle: boolean;
}) {
  const steps: FirstWeekStep[] = [
    {
      done: hasTraded,
      title: "Buy something",
      detail: `You have ${formatMoney(
        startingBalance
      )} of pretend money. It is not real and it never becomes real. Cash earns nothing, so leaving it all in cash is a decision.`,
      href: "/trade",
      action: "Buy your first share",
    },
    {
      done: hasCompany,
      title: "Get somebody else in",
      detail: leagueName
        ? `${leagueName} is yours and it has an invite code. One other person is enough, and until then the table is a list with you on it.`
        : "Start a league and send the code to one person. Two people is a game; one is a spreadsheet.",
      href: leagueHref,
      action: inviteCode ? "Send the code" : "Start a league",
    },
    {
      done: hasGoal,
      title: "Say what you are doing this week",
      detail:
        "Beat the market, finish up, finish top three, or just show up every day. It earns nothing and costs nothing. Saying it to people who will see whether you did is the whole point.",
      href: leagueHref,
      action: "Say it",
    },
    {
      done: hasBattle,
      title: "Try a different rule book",
      detail:
        "Semiconductors only. One company all week. Pick the losers instead of the winners. A battle runs beside the ordinary week and touches nothing about your record.",
      href: leagueHref,
      action: "Start a battle",
    },
  ];

  const next = steps.find((step) => !step.done);
  if (!next) return null;

  const done = steps.filter((step) => step.done).length;

  return (
    <Panel
      title="Your first week"
      description={
        done === 0
          ? "Four things, and none of them takes a minute."
          : `${done} of ${steps.length} done. This goes when the list does.`
      }
    >
      <div className="flex flex-col gap-3">
        {steps.map((step) => {
          const current = step === next;

          return (
            <Well
              key={step.title}
              className={cn("py-3", step.done && "opacity-60")}
            >
              <SettingBar
                action={
                  current ? (
                    <Button asChild size="sm">
                      <Link href={next.href}>
                        {next.action}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : undefined
                }
                description={step.done ? undefined : step.detail}
              >
                <span className={`flex items-center gap-3 ${SETTING_COPY}`}>
                  {step.done ? (
                    <Check className="size-4 shrink-0 text-gain" aria-hidden="true" />
                  ) : (
                    <Circle
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate text-sm font-medium">
                    {step.title}
                    {step.done ? <span className="sr-only">, done</span> : null}
                  </span>
                </span>
              </SettingBar>
            </Well>
          );
        })}

        <Link href="/how" className="text-sm text-muted-foreground underline">
          How Arena works
        </Link>
      </div>
    </Panel>
  );
}
