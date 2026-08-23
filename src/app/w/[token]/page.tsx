import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArenaWordmark } from "@/components/brand/ArenaWordmark";
import { Panel, Well } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { WeekShape } from "@/components/WeekShape";
import { settledWeek } from "@/lib/game/shape";
import { TrackView } from "@/components/TrackView";
import { ShareCta } from "@/components/ShareCta";
import { getSharedCard, shareUrl } from "@/lib/game/share";
import { headline, ordinal, versusMarketLine, weekLabel } from "@/lib/share/card";
import { BOX, PAGE, PAGE_FRAME } from "@/lib/page-shell";
import { formatPercent, plural } from "@/lib/format";

/*
  Somebody else's week, seen by whoever they sent the link to.

  Signed out, and it must stay that way: a share link is posted into group
  chats, and a page that demanded an account first would be the end of the
  share loop before it started. It shows one frozen week and nothing else. No
  live standing, no other weeks, no way to walk from this player to anyone
  else, because none of that was what they chose to share.
*/


type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const card = await getSharedCard(token);

  if (!card) {
    return {
      title: "This card is no longer shared",
      robots: { index: false, follow: false },
    };
  }

  const { recap } = card;
  const description = [
    formatPercent(recap.returnPercent),
    versusMarketLine(recap.benchmarkDiff),
    recap.league
      ? `${ordinal(recap.league.rank)} of ${recap.league.size} in ${recap.league.name}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${recap.displayName}, week of ${weekLabel(recap.monday)}`,
    description,
    /*
      Kept out of search results. This is a link somebody handed to people
      they chose, and a page that turns up in a search for their name is not
      the thing they shared.
    */
    robots: { index: false, follow: false },
    openGraph: {
      title: `${recap.displayName}, week of ${weekLabel(recap.monday)}`,
      description,
      url: shareUrl(card.token),
      type: "article",
    },
    twitter: { card: "summary_large_image" },
  };
}

/*
  The frame is the same for every card, so it is prerendered and served from a
  CDN. Only the week itself waits, and the card it waits for is cached until
  the person who shared it takes it down.

  This is the page a stranger meets Arena through. It arrives now, and the
  numbers land in it.
*/
export default function SharedWeekPage({ params }: Props) {
  return (
    <div className={PAGE_FRAME}>
      <main id="main" className={`${PAGE} flex min-h-dvh flex-col justify-center py-16`}>
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
          <ArenaWordmark />
          <Suspense fallback={<Waiting />}>
            <Week params={params} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

/*
  The card's own shape while it is on its way. Sized to the real one, so the
  invitation below it does not jump when the week arrives.
*/
function Waiting() {
  return (
    <>
      <div className={`${BOX} h-64`} aria-busy="true">
        <span className="sr-only">Loading this week</span>
      </div>
      <Invitation />
    </>
  );
}

function Invitation() {
  return (
    <>
      <Panel
        title="Everyone starts Monday with the same money"
        description="Pick shares with play money, find out on Friday who did best. Free, no ads, and nothing to win but the bragging."
      >
        <ShareCta>Play a week</ShareCta>
      </Panel>

      <p className="text-center text-xs text-muted-foreground">
        Play money only. Nothing here is financial advice, and nothing here is
        redeemable for anything.
      </p>
    </>
  );
}

async function Week({ params }: Props) {
  const { token } = await params;
  const card = await getSharedCard(token);

  if (!card) {
    return (
      <>
        <TrackView event="shared_card_viewed" properties={{ live: false }} />
        <Panel
          title="This card is no longer shared"
          description="Whoever posted it has taken it down, or the link was mistyped. Nothing is wrong on your end."
        >
          <Button asChild>
            <Link href="/">See what Upside Arena is</Link>
          </Button>
        </Panel>
      </>
    );
  }

  const { recap } = card;
  const up = recap.returnPercent >= 0;
  const versus = versusMarketLine(recap.benchmarkDiff);

  return (
    <>
      {/*
        The top of the growth loop. How many strangers open one of these, and
        how many go on to play, is the only measure of whether the share card
        works at all.
      */}
      <TrackView event="shared_card_viewed" properties={{ live: true }} />

<Panel>
      <div className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <p className="truncate text-sm text-muted-foreground">
            {recap.displayName}
            {recap.title ? (
              <span className="text-primary"> · {recap.title}</span>
            ) : null}
          </p>
          <p className="shrink-0 text-sm text-muted-foreground">
            Week of {weekLabel(recap.monday)}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <p
            className={`figure text-5xl font-semibold tabular-nums ${
              up ? "text-gain" : "text-loss"
            }`}
          >
            {formatPercent(recap.returnPercent)}
          </p>
          <p className="text-lg font-semibold tracking-tight">{headline(recap)}</p>
          {versus ? (
            <p className="text-sm text-muted-foreground">{versus}</p>
          ) : null}
        </div>

        {recap.marks.length > 0 ? (
          <WeekShape days={settledWeek(recap.marks)} />
        ) : null}

        {recap.league || recap.streakDays > 0 ? (
          <Well className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            {recap.league ? (
              <p className="text-sm">
                <span className="text-muted-foreground">Finished </span>
                {ordinal(recap.league.rank)} of {recap.league.size}
                <span className="text-muted-foreground"> in {recap.league.name}</span>
              </p>
            ) : null}
            {recap.streakDays > 0 ? (
              <p className="text-sm text-muted-foreground">
                {plural(recap.streakDays, "day")} in a row
              </p>
            ) : null}
          </Well>
        ) : null}
        </div>
      </Panel>

      <Invitation />
    </>
  );
}
