create or replace function public.keep_alive()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'ok', true,
    'checked_at', current_timestamp
  );
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon;
