import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Panel, Well } from "@/components/Panel";
import { SeasonTable } from "@/components/SeasonTable";
import { TrackView } from "@/components/TrackView";
import { getSession } from "@/lib/profile";
import {
  MIN_WEEKS_TO_RANK,
  WEEKS_FOR_REGULAR,
  getSeasonView,
} from "@/lib/game/seasons";
import { PAGE, STACK } from "@/lib/page-shell";
import { formatDate, formatPercent, plural } from "@/lib/format";

/*
  The season.

  A quarter of weeks, added up. It exists because a game whose longest arc is
  five days gives somebody nothing in March they did not already have in
  January, and for no other reason: it changes nothing about how a week is
  scored and hands out nothing that affects one.

  Every figure here was settled on a Friday and has not been touched since.
*/

export const metadata = { title: "Season" };

export default async function SeasonPage() {
  const { user } = await getSession();
  if (!user) redirect("/");

  const view = await getSeasonView(user.id);

  if (!view) {
    return (
      <div className={`${PAGE} ${STACK}`}>
        <h1>Season</h1>
        <Panel
          title="The season starts with your first settled week"
          description="A season is a quarter of weeks added up. There is nothing in this one yet, because no week inside it has been scored. Play this week and it will be here on Friday."
        />
      </div>
    );
  }

  const { season, standings, you, weeksSettled, weeksUntilRanked } = view;
  const closed = season.status === "closed";

  return (
    <div className={`${PAGE} ${STACK}`}>
      <TrackView event="season_viewed" properties={{ season: season.name }} />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1>{season.name}</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(season.startsOn)} to {formatDate(season.endsOn)}
        </p>
      </div>

      <Panel>
        <div className="flex items-start gap-3">
          <CalendarRange
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            {closed
              ? `This season is finished. ${plural(weeksSettled, "week")} were played in it, and the table below is final.`
              : `${plural(weeksSettled, "week")} of this season have been scored so far. Everyone is ordered on how far ahead of the market they finish in an average week, so a good week counts the same whether it was your first or your tenth.`}
          </p>
        </div>
      </Panel>

      {you ? (
        <Panel title="Where you stand">
          <div className="grid gap-3 sm:grid-cols-3">
            <Well className="flex flex-col gap-1 py-3">
              <span className="text-xs text-muted-foreground">
                {closed ? "Finished" : "Standing"}
              </span>
              <span className="figure text-xl font-semibold">
                {you.ranked
                  ? `${you.rank ?? you.position} of ${standings.length}`
                  : "Not ranked yet"}
              </span>
            </Well>

            <Well className="flex flex-col gap-1 py-3">
              <span className="text-xs text-muted-foreground">
                Against the market, a week
              </span>
              <span className="figure text-xl font-semibold">
                {formatPercent(you.averageVersusMarket)}
              </span>
            </Well>

            <Well className="flex flex-col gap-1 py-3">
              <span className="text-xs text-muted-foreground">Weeks played</span>
              <span className="figure text-xl font-semibold">
                {you.weeksPlayed}
              </span>
            </Well>
          </div>

          {!you.ranked && !closed ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {plural(weeksUntilRanked, "more week")} and you are in the
              standings properly. {MIN_WEEKS_TO_RANK} weeks is the least a
              season can be judged on, because one very good week is luck and
              we would rather not call it anything else.
            </p>
          ) : null}

          {!closed && you.weeksPlayed < WEEKS_FOR_REGULAR ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Play {WEEKS_FOR_REGULAR} weeks of this season and you keep the
              season regular title, whoever you finish above.
            </p>
          ) : null}
        </Panel>
      ) : null}

      <Panel
        title="The table"
        description={
          closed
            ? "Final."
            : "Live, and settled one Friday at a time. Nothing here moves during the week."
        }
      >
        {standings.length > 0 ? (
          <SeasonTable standings={standings} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nobody has a settled week in this season yet.
          </p>
        )}
      </Panel>

      <Panel title="What a season is worth">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
          <li>
            Finishing a season first, or in the top three, earns a title. A
            title is decoration: it has never changed a score and never will.
          </li>
          <li>
            Playing {WEEKS_FOR_REGULAR} weeks of one season earns a title too,
            with no need to beat anybody. Turning up is worth something on its
            own.
          </li>
          <li>
            A season adds nothing to a week and takes nothing from one. Every
            week is still scored on its own, against the market, from the same
            starting balance as everybody else.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
