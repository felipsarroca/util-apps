create or replace function public.teacher_home_stats(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then
    raise exception 'Només el professorat pot fer aquesta acció.';
  end if;

  return (
    with teacher_sessions as (
      select s.id
      from public.sessions s
      where s.status = 'open'
        and (u.role = 'admin' or s.teacher_id = u.id)
    ),
    scoped_evaluations as (
      select e.evaluated_id, e.behavior_id
      from public.evaluations e
      join teacher_sessions ts on ts.id = e.session_id
    )
    select jsonb_build_object(
      'evaluatedStudents', count(distinct evaluated_id),
      'evaluatedBehaviors', count(distinct behavior_id)
    )
    from scoped_evaluations
  );
end;
$$;

grant execute on function public.teacher_home_stats(uuid) to anon;;
