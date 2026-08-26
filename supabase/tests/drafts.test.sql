-- Draft night: picking a battle's holdings in turn, off a board that runs out.
--
-- Five things are load-bearing here, and every one of them is a way a room of
-- friends could end up with a contest that was decided by something other than
-- their picks:
--
--   1. A name can be taken once. Two phones in the same room tapping the same
--      company inside the same second is the ordinary case, not the exotic
--      one, so the refusal has to be the database's rather than a screen's.
--
--   2. It is your turn or it is not. A running order that any member could
--      pick out of is not a running order.
--
--   3. Everybody gets the same number of picks. The sequence is the snake and
--      lives in TypeScript; the *count* is a contest-deciding property and is
--      checked here.
--
--   4. You hold what you drafted. A drafted battle takes no trades, or the
--      board runs out on Sunday and is undone at 09:31 on Monday.
--
--   5. The fill is equal weight, whole shares, and nothing is dropped quietly.

\set ON_ERROR_STOP on
\o /dev/null

insert into auth.users (id, email, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'ana@example.com', '{}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'ben@example.com', '{}'::jsonb),
  ('cccccccc-0000-0000-0000-00000000000c', 'cal@example.com', '{}'::jsonb),
  ('dddddddd-0000-0000-0000-00000000000d', 'dee@example.com', '{}'::jsonb);

-- Ana's league. Ben and Cal are in it. Dee is not.
select public.create_league(
  'aaaaaaaa-0000-0000-0000-00000000000a', 'Draft Room', null, 3, 20
);

select public.join_league(
  'bbbbbbbb-0000-0000-0000-00000000000b',
  (select invite_code from public.leagues where name = 'Draft Room'),
  10
);

select public.join_league(
  'cccccccc-0000-0000-0000-00000000000c',
  (select invite_code from public.leagues where name = 'Draft Room'),
  10
);

-- ---------------------------------------------------------------------------
-- Opening one
-- ---------------------------------------------------------------------------

select public.create_draft(
  'aaaaaaaa-0000-0000-0000-00000000000a',
  (select id from public.leagues where name = 'Draft Room'),
  'silicon', 'long', 'week',
  '2026-08-31', '2026-09-04',
  100000, 'SOXX', null,
  2, 60
);

select public.assert(
  (select drafted from public.weekly_cycles
   where league_id = (select id from public.leagues where name = 'Draft Room')),
  'opening a draft creates a battle marked as drafted'
);

select public.assert(
  (select count(*) from public.draft_seats
   where draft_id = (select id from public.drafts)) = 1,
  'whoever opens it is already sitting in it'
);

-- A draft holds the league's one battle slot, exactly as a battle does.
do $$
declare
  failed boolean := false;
begin
  begin
    perform public.create_battle(
      'bbbbbbbb-0000-0000-0000-00000000000b',
      (select id from public.leagues where name = 'Draft Room'),
      'banks', 'long', 'week', '2026-08-31', '2026-09-04', 100000, 'XLF', 40.00
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'a draft blocks a second contest in the same league');
end
$$;

-- ---------------------------------------------------------------------------
-- The lobby
-- ---------------------------------------------------------------------------

select public.join_draft(
  'bbbbbbbb-0000-0000-0000-00000000000b',
  (select id from public.drafts),
  12
);

select public.join_draft(
  'cccccccc-0000-0000-0000-00000000000c',
  (select id from public.drafts),
  12
);

select public.assert(
  (select count(*) from public.draft_seats
   where draft_id = (select id from public.drafts)) = 3,
  'league members can take a seat while the lobby is open'
);

-- Joining twice is not two seats.
select public.join_draft(
  'bbbbbbbb-0000-0000-0000-00000000000b',
  (select id from public.drafts),
  12
);

select public.assert(
  (select count(*) from public.draft_seats
   where draft_id = (select id from public.drafts)) = 3,
  'joining twice does not deal a second seat'
);

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.join_draft(
      'dddddddd-0000-0000-0000-00000000000d', (select id from public.drafts), 12
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'somebody outside the league cannot sit down');
end
$$;

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.leave_draft(
      'aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.drafts)
    );
  exception when others then failed := true;
  end;
  perform public.assert(
    failed,
    'the person who opened it calls it off rather than leaving it ownerless'
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Dealing the seats
-- ---------------------------------------------------------------------------
-- An order that hands somebody an extra pick is the one thing about a running
-- order that decides a contest, so it is refused here rather than trusted to
-- whoever built it.

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.start_draft(
      'aaaaaaaa-0000-0000-0000-00000000000a',
      (select id from public.drafts),
      array['aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'cccccccc-0000-0000-0000-00000000000c']::uuid[],
      -- Ana three times, Cal once. Six picks, so the length is right and the
      -- share is not.
      array['aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'cccccccc-0000-0000-0000-00000000000c',
            'aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'aaaaaaaa-0000-0000-0000-00000000000a']::uuid[],
      24, 2, 12, now()
    );
  exception when others then failed := true;
  end;
  perform public.assert(
    failed, 'a running order that gives somebody an extra pick is refused'
  );
end
$$;

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.start_draft(
      'aaaaaaaa-0000-0000-0000-00000000000a',
      (select id from public.drafts),
      array['aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'cccccccc-0000-0000-0000-00000000000c']::uuid[],
      array['aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'cccccccc-0000-0000-0000-00000000000c',
            'cccccccc-0000-0000-0000-00000000000c',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'aaaaaaaa-0000-0000-0000-00000000000a']::uuid[],
      -- A board of five will not carry three people picking twice.
      5, 2, 12, now()
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'a board too small for the room is refused');
end
$$;

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.start_draft(
      'bbbbbbbb-0000-0000-0000-00000000000b',
      (select id from public.drafts),
      array['aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'cccccccc-0000-0000-0000-00000000000c']::uuid[],
      array['aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'cccccccc-0000-0000-0000-00000000000c',
            'cccccccc-0000-0000-0000-00000000000c',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'aaaaaaaa-0000-0000-0000-00000000000a']::uuid[],
      24, 2, 12, now()
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'only the person who opened it can start it');
end
$$;

-- The real one. Ana, Ben, Cal, then the snake back up.
select public.start_draft(
  'aaaaaaaa-0000-0000-0000-00000000000a',
  (select id from public.drafts),
  array['aaaaaaaa-0000-0000-0000-00000000000a',
        'bbbbbbbb-0000-0000-0000-00000000000b',
        'cccccccc-0000-0000-0000-00000000000c']::uuid[],
  array['aaaaaaaa-0000-0000-0000-00000000000a',
        'bbbbbbbb-0000-0000-0000-00000000000b',
        'cccccccc-0000-0000-0000-00000000000c',
        'cccccccc-0000-0000-0000-00000000000c',
        'bbbbbbbb-0000-0000-0000-00000000000b',
        'aaaaaaaa-0000-0000-0000-00000000000a']::uuid[],
  24, 2, 12, now()
);

select public.assert(
  (select status = 'picking' and current_pick = 0 and deadline is not null
   from public.drafts),
  'starting it opens the first turn and starts the clock'
);

select public.assert(
  (select count(*) from public.draft_picks
   where draft_id = (select id from public.drafts)) = 6,
  'the whole running order is written down before the first pick'
);

select public.assert(
  (select count(*) from public.draft_seats
   where draft_id = (select id from public.drafts) and seat is null) = 0,
  'and everybody has a seat number'
);

-- ---------------------------------------------------------------------------
-- Picking
-- ---------------------------------------------------------------------------

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.make_pick(
      'bbbbbbbb-0000-0000-0000-00000000000b',
      (select id from public.drafts), 'AMD', now()
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'you cannot pick out of turn');
end
$$;

select public.make_pick(
  'aaaaaaaa-0000-0000-0000-00000000000a',
  (select id from public.drafts), 'NVDA', now()
);

select public.assert(
  (select current_pick = 1 and deadline is not null from public.drafts),
  'a pick moves the turn on and resets the clock'
);

-- The whole drama of a draft, and the database is what decides it.
do $$
declare
  failed boolean := false;
begin
  begin
    perform public.make_pick(
      'bbbbbbbb-0000-0000-0000-00000000000b',
      (select id from public.drafts), 'nvda', now()
    );
  exception when others then failed := true;
  end;
  perform public.assert(
    failed, 'a name that has gone has gone, whatever case it is typed in'
  );
end
$$;

select public.make_pick(
  'bbbbbbbb-0000-0000-0000-00000000000b',
  (select id from public.drafts), 'AMD', now()
);

-- Cal picks twice in a row, which is what the snake is for.
select public.make_pick(
  'cccccccc-0000-0000-0000-00000000000c',
  (select id from public.drafts), 'TSM', now()
);

select public.make_pick(
  'cccccccc-0000-0000-0000-00000000000c',
  (select id from public.drafts), 'AVGO', now()
);

-- ---------------------------------------------------------------------------
-- The clock
-- ---------------------------------------------------------------------------
-- Ben has put his phone down. Nothing happens while the turn is still his.

select public.assert(
  public.clock_pick((select id from public.drafts), 'INTC', now()) is null,
  'the clock does nothing while the turn is still live'
);

update public.drafts set deadline = now() - interval '1 second';

select public.assert(
  (select by_clock from public.clock_pick(
    (select id from public.drafts), 'INTC', now()
  )),
  'once the turn has run out the clock takes a name and says it did'
);

select public.assert(
  (select user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'
   from public.draft_picks
   where draft_id = (select id from public.drafts) and pick_number = 4),
  'and the name belongs to the person whose turn it was'
);

-- Five phones firing the same expired turn is the ordinary case, not a race
-- to guard against: the first one moves it on and the rest find nothing to do.
select public.assert(
  public.clock_pick((select id from public.drafts), 'MU', now()) is null,
  'a second screen firing the same expired turn does nothing'
);

-- Ana's last pick closes it.
select public.make_pick(
  'aaaaaaaa-0000-0000-0000-00000000000a',
  (select id from public.drafts), 'MU', now()
);

select public.assert(
  (select status = 'picked' and deadline is null and picked_at is not null
   from public.drafts),
  'the last pick ends the draft and stops the clock'
);

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.make_pick(
      'aaaaaaaa-0000-0000-0000-00000000000a',
      (select id from public.drafts), 'LRCX', now()
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'a finished draft takes no more picks');
end
$$;

-- ---------------------------------------------------------------------------
-- Monday: the fill
-- ---------------------------------------------------------------------------
-- Every pick is worth the same money, whole shares, and what will not divide
-- stays as cash. One pick each of a hundred thousand over two rounds is
-- fifty thousand.

select public.fill_draft(
  (select id from public.drafts),
  jsonb_build_object(
    'NVDA', 180.00,
    'AMD', 160.00,
    'TSM', 240.00,
    'AVGO', 300.00,
    'MU', 120.00
    -- INTC deliberately absent: a name nobody could price that morning.
  ),
  50000,
  '2026-08-31'
);

select public.assert(
  (select shares = 277 and outcome = 'filled'
   from public.draft_picks
   where draft_id = (select id from public.drafts) and symbol = 'NVDA'),
  'a pick buys as many whole shares as its budget covers'
);

select public.assert(
  (select outcome = 'no_price' and shares is null
   from public.draft_picks
   where draft_id = (select id from public.drafts) and symbol = 'INTC'),
  'a name with no opening price is recorded rather than dropped quietly'
);

select public.assert(
  (select status = 'filled' from public.drafts),
  'and the draft is done'
);

-- Ana drafted NVDA at 180 and MU at 120: 277 shares and 416 shares, which is
-- 49,860 and 49,920 of her hundred thousand. The rest stays as cash rather
-- than being rounded into money she never had.
select public.assert(
  (select round(cash) = 220
   from public.portfolios
   where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
     and cycle_id = (select cycle_id from public.drafts)),
  'what the budget will not divide into stays as cash'
);

select public.assert(
  (select count(*) = 2
   from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
     and p.cycle_id = (select cycle_id from public.drafts)),
  'and the holdings are the names she picked'
);

-- Filling twice must not buy twice. It is the same rule the lineup has and the
-- same reason: whatever runs this is something nobody is watching.
select public.fill_draft(
  (select id from public.drafts),
  jsonb_build_object('NVDA', 180.00, 'AMD', 160.00, 'TSM', 240.00,
                     'AVGO', 300.00, 'MU', 120.00),
  50000,
  '2026-08-31'
);

select public.assert(
  (select quantity = 277
   from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
     and p.cycle_id = (select cycle_id from public.drafts)
     and h.symbol = 'NVDA'),
  'filling a draft twice does not buy it twice'
);

-- ---------------------------------------------------------------------------
-- You hold what you drafted
-- ---------------------------------------------------------------------------
-- Without this the board is theatre: it runs out on Sunday evening and is
-- undone at half past nine on Monday morning.

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.execute_trade(
      'aaaaaaaa-0000-0000-0000-00000000000a',
      (select cycle_id from public.drafts),
      'NVDA', 'sell', 10, 185.00
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'a drafted battle takes no sale');
end
$$;

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.execute_trade(
      'aaaaaaaa-0000-0000-0000-00000000000a',
      (select cycle_id from public.drafts),
      'LRCX', 'buy', 10, 100.00
    );
  exception when others then failed := true;
  end;
  perform public.assert(failed, 'and it takes no purchase either');
end
$$;

-- The ordinary week is untouched by any of it.
select public.ensure_cycle('2026-08-31', 100000, 776.18);

select public.execute_trade(
  'aaaaaaaa-0000-0000-0000-00000000000a',
  (select id from public.weekly_cycles
   where monday = '2026-08-31' and league_id is null),
  'NVDA', 'buy', 10, 180.00
);

select public.assert(
  (select count(*) = 1
   from public.holdings h
   join public.portfolios p on p.id = h.portfolio_id
   where p.user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'
     and p.cycle_id = (select id from public.weekly_cycles
                       where monday = '2026-08-31' and league_id is null)),
  'the house week still takes trades as it always did'
);

-- ---------------------------------------------------------------------------
-- A drafted contest is not announced as a battle
-- ---------------------------------------------------------------------------
-- The message that tells a league one of its members started something exists
-- because everybody is in a battle from the moment it is made. A draft breaks
-- that premise: you are in it only if you turned up. Announcing one would tell
-- somebody they are in a contest they are not in.

select public.assert(
  (select count(*) = 0
   from public.weekly_cycles
   where league_id is not null and status = 'open' and drafted = false),
  'a drafted contest is excluded from the battles worth announcing'
);

-- ---------------------------------------------------------------------------
-- Calling one off
-- ---------------------------------------------------------------------------

select public.assert(
  (select count(*) from public.drafts) = 1,
  'a filled draft is still there to read'
);

do $$
declare
  failed boolean := false;
begin
  begin
    perform public.cancel_draft(
      'aaaaaaaa-0000-0000-0000-00000000000a', (select id from public.drafts)
    );
  exception when others then failed := true;
  end;
  perform public.assert(
    failed, 'a draft with money in it cannot be called off'
  );
end
$$;

\o
select 'drafts.test.sql passed' as result;
