import Link from "next/link";
import { ArrowRight, Trophy, Users, Wallet } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

/*
  The sixty seconds section 4 asks for, and not a second more.

  It sits on the home screen rather than between signing up and getting here,
  because every step before the first live number is somewhere to lose
  somebody. They can already see their money above this; these three lines
  explain what to do with it, and the button is the thing to do.

  It disappears the moment they make a trade. An explainer that stays after it
  has been understood is an advert for something they already own.
*/
export function FirstRun({
  startingBalance,
  leagueName,
  inviteCode,
}: {
  startingBalance: number;
  leagueName: string | null;
  inviteCode: string | null;
}) {
  const points = [
    {
      icon: Wallet,
      text: `You have ${formatMoney(startingBalance)} of pretend money. It is not real, and nothing here ever becomes real.`,
    },
    {
      icon: Trophy,
      text: "Buy shares with it. On Friday the week is scored on how you did against the market, not on who started with more.",
    },
    {
      icon: Users,
      text: leagueName
        ? `We made you a league called ${leagueName}. Send the code to someone and you have a race.`
        : "Start a league and send the code to someone. That is where it gets interesting.",
    },
  ];

  return (
    <Panel
      title="How this works"
      description="Three things, then you are done reading."
    >
      <div className="flex flex-col gap-3">
        {points.map(({ icon: Icon, text }) => (
          <Well key={text} className="flex items-start gap-3 py-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{text}</p>
          </Well>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/trade">
              Buy your first share
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>

          {inviteCode ? (
            <Button asChild variant="outline">
              <Link href="/leagues">Invite someone</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
