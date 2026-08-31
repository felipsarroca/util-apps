create or replace function public.bootstrap_for_user(u public.app_users, p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $function$
  with skills_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'code', s.code,
      'name', s.name,
      'description', s.description,
      'color', s.color,
      'position', s.position,
      'behaviors', (
        select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name, 'description', b.description, 'position', b.position) order by b.position), '[]'::jsonb)
        from public.behaviors b
        where b.skill_id = s.id and b.active = true
      )
    ) order by s.position), '[]'::jsonb) value
    from public.skills s
  ),
  classes_json as (
    select coalesce(jsonb_agg(class_group order by class_group), '[]'::jsonb) value
    from (select distinct class_group from public.app_users where role = 'student' and active = true and class_group is not null and class_group <> '') classes
  ),
  cycles_json as (
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'classGroup', c.class_group, 'status', c.status, 'startsOn', c.starts_on, 'endsOn', c.ends_on, 'notes', c.notes, 'createdAt', c.created_at) order by c.created_at desc), '[]'::jsonb) value
    from public.cycles c
    where u.role in ('teacher', 'admin') and (u.role = 'admin' or c.teacher_id = u.id)
  ),
  sessions_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'cycleId', s.cycle_id,
      'name', s.name,
      'classGroup', c.class_group,
      'accessCode', s.access_code,
      'status', s.status,
      'sessionDate', s.session_date,
      'locked', s.locked_at is not null,
      'lockedAt', s.locked_at,
      'progress', jsonb_build_object(
        'totalStudents', (select count(*) from public.app_users st where st.role = 'student' and st.active = true and st.class_group = c.class_group),
        'respondents', (select count(distinct e.evaluator_id) from public.evaluations e where e.session_id = s.id and e.evaluator_type = 'student'),
        'pending', greatest((select count(*) from public.app_users st where st.role = 'student' and st.active = true and st.class_group = c.class_group) - (select count(distinct e.evaluator_id) from public.evaluations e where e.session_id = s.id and e.evaluator_type = 'student'), 0),
        'evaluationsCount', (select count(*) from public.evaluations e where e.session_id = s.id)
      )
    ) order by s.created_at desc), '[]'::jsonb) value
    from public.sessions s
    join public.cycles c on c.id = s.cycle_id
    where u.role in ('teacher', 'admin') and s.status <> 'closed' and (u.role = 'admin' or s.teacher_id = u.id)
  )
  select jsonb_build_object('token', p_token, 'user', public.user_json(u), 'classes', (select value from classes_json), 'skills', (select value from skills_json), 'cycles', (select value from cycles_json), 'activeSessions', (select value from sessions_json))
$function$;

create or replace function public.session_details(p_token uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  s public.sessions;
  c public.cycles;
  evaluations_count integer;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.id is null then raise exception 'La sessió ha caducat. Torna a entrar.'; end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null then raise exception 'Aquesta sessió no existeix.'; end if;

  select * into c from public.cycles where id = s.cycle_id limit 1;
  if u.role = 'teacher' and s.teacher_id <> u.id then raise exception 'No tens accés a aquesta sessió.'; end if;
  if u.role = 'student' and (s.status <> 'open' or s.locked_at is not null or c.class_group <> u.class_group) then raise exception 'Aquesta sessió no està disponible.'; end if;

  select count(*) into evaluations_count from public.evaluations e where e.session_id = s.id;

  return jsonb_build_object(
    'session', jsonb_build_object('id', s.id, 'cycleId', s.cycle_id, 'name', s.name, 'classGroup', c.class_group, 'accessCode', s.access_code, 'status', s.status, 'sessionDate', s.session_date, 'locked', s.locked_at is not null, 'lockedAt', s.locked_at, 'evaluationsCount', evaluations_count),
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
    'heteroStudentIds', (select coalesce(jsonb_agg(student_id), '[]'::jsonb) from public.session_students where session_id = s.id),
    'existingRatings', (
      select coalesce(jsonb_agg(jsonb_build_object('evaluatedId', e.evaluated_id, 'behaviorId', e.behavior_id, 'value', e.value)), '[]'::jsonb)
      from public.evaluations e
      where e.session_id = s.id and e.evaluator_id = u.id and e.evaluator_type = case when u.role = 'student' then 'student' else 'teacher' end
    )
  );
end;
$function$;;
