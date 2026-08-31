create or replace function public.keep_alive(p_request text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'ok', p_request = 'github-actions',
    'checked_at', current_timestamp
  );
$$;

revoke all on function public.keep_alive(text) from public;
grant execute on function public.keep_alive(text) to anon;

notify pgrst, 'reload schema';;
