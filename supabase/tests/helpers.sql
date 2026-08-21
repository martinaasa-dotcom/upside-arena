-- Shared test helpers. Applied before every suite.

create or replace function public.assert(condition boolean, label text)
returns void
language plpgsql
as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok: %', label;
end;
$$;

grant execute on function public.assert(boolean, text) to authenticated, anon;
