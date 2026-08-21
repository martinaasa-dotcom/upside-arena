"use client";

import { useActionState, useId, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/Panel";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { LEAGUE_ICONS } from "@/lib/game";
import {
  submitCreateLeague,
  submitJoinLeague,
  type LeagueState,
} from "@/app/(app)/leagues/actions";

export function CreateLeagueForm() {
  const [state, formAction, pending] = useActionState<LeagueState, FormData>(
    submitCreateLeague,
    {}
  );
  const [icon, setIcon] = useState<string>(LEAGUE_ICONS[0]);
  const nameId = useId();

  /*
    Only the attempt and the refusal are recorded here. A league that is
    actually created redirects away, so there is no render left to report it
    from, and counting them from the database is both easier and true for the
    people who declined measurement.
  */
  useEffect(() => {
    if (state.error) track("league_join_failed", { at: "create" });
  }, [state.error]);

  return (
    <Panel
      title="Start a league"
      description="Name it, then send the code to the people you want to beat."
    >
      <form
        action={formAction}
        onSubmit={() => track("league_create_started")}
        className="flex flex-col gap-5"
      >
        <input type="hidden" name="icon" value={icon} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameId}>League name</Label>
          <Input
            id={nameId}
            name="name"
            maxLength={40}
            required
            placeholder="Sunday Roasters"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Icon</Label>
          <div className="flex flex-wrap gap-1">
            {LEAGUE_ICONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setIcon(option)}
                aria-label={`Use ${option} as the icon`}
                aria-pressed={icon === option}
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg text-lg transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  icon === option
                    ? "bg-primary text-primary-foreground"
                    : "glass-well hover:bg-accent"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-loss">
            {state.error}
          </p>
        ) : null}

        <div>
          <Button type="submit" disabled={pending}>
            <Plus />
            {pending ? "Creating" : "Create league"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function JoinLeagueForm() {
  const [state, formAction, pending] = useActionState<LeagueState, FormData>(
    submitJoinLeague,
    {}
  );
  const codeId = useId();

  useEffect(() => {
    // A wrong or expired code is the most useful thing this screen can say:
    // it means somebody was invited and could not get in.
    if (state.error) track("league_join_failed", { at: "join" });
  }, [state.error]);

  return (
    <Panel
      title="Join a league"
      description="Someone sent you a code? Put it in here."
    >
      <form
        action={formAction}
        onSubmit={() => track("league_join_started")}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={codeId}>Invite code</Label>
          <Input
            id={codeId}
            name="code"
            maxLength={8}
            required
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCD2345"
            className="figure uppercase"
          />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-loss">
            {state.error}
          </p>
        ) : null}

        <div>
          <Button type="submit" variant="outline" disabled={pending}>
            <Users />
            {pending ? "Joining" : "Join league"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
