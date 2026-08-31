create or replace function public.students_by_class(p_token uuid, p_class_group text)
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
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', id,
      'name', coalesce(nullif(full_name, ''), btrim(first_name || ' ' || last_name), email),
      'email', email,
      'classGroup', class_group
    ) order by last_name, first_name, full_name), '[]'::jsonb)
    from public.app_users
    where role = 'student' and active = true and class_group = p_class_group
  );
end;
$$;

create or replace function public.session_details(p_token uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  s public.sessions;
  c public.cycles;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.id is null then raise exception 'La sessió ha caducat. Torna a entrar.'; end if;
  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null then raise exception 'Aquesta sessió no existeix.'; end if;
  select * into c from public.cycles where id = s.cycle_id limit 1;
  if u.role = 'teacher' and s.teacher_id <> u.id then raise exception 'No tens accés a aquesta sessió.'; end if;
  if u.role = 'student' and (s.status <> 'open' or c.class_group <> u.class_group) then raise exception 'Aquesta sessió no correspon a la teva classe.'; end if;

  return jsonb_build_object(
    'session', jsonb_build_object('id', s.id, 'cycleId', s.cycle_id, 'name', s.name, 'classGroup', c.class_group, 'accessCode', s.access_code, 'status', s.status),
    'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'classGroup', c.class_group, 'status', c.status),
    'behaviors', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name, 'description', b.description) order by b.position), '[]'::jsonb)
      from public.session_behaviors sb join public.behaviors b on b.id = sb.behavior_id
      where sb.session_id = s.id
    ),
    'students', (
      select coalesce(jsonb_agg(jsonb_build_object('id', st.id, 'name', coalesce(nullif(st.full_name, ''), btrim(st.first_name || ' ' || st.last_name), st.email), 'email', st.email, 'classGroup', st.class_group) order by st.last_name, st.first_name, st.full_name), '[]'::jsonb)
      from public.app_users st
      where st.role = 'student' and st.active = true and st.class_group = c.class_group
    ),
    'heteroStudentIds', (
      select coalesce(jsonb_agg(student_id), '[]'::jsonb) from public.session_students where session_id = s.id
    ),
    'existingRatings', (
      select coalesce(jsonb_agg(jsonb_build_object('evaluatedId', e.evaluated_id, 'behaviorId', e.behavior_id, 'value', e.value)), '[]'::jsonb)
      from public.evaluations e
      where e.session_id = s.id
        and e.evaluator_id = u.id
        and e.evaluator_type = case when u.role = 'student' then 'student' else 'teacher' end
    )
  );
end;
$$;

grant execute on function public.students_by_class(uuid, text) to anon;
grant execute on function public.session_details(uuid, uuid) to anon;;
