alter table public.sessions
  add column if not exists locked_at timestamptz;

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
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', b.id,
          'code', b.code,
          'name', b.name,
          'description', b.description,
          'position', b.position
        ) order by b.position), '[]'::jsonb)
        from public.behaviors b
        where b.skill_id = s.id and b.active = true
      )
    ) order by s.position), '[]'::jsonb) value
    from public.skills s
  ),
  classes_json as (
    select coalesce(jsonb_agg(class_group order by class_group), '[]'::jsonb) value
    from (
      select distinct class_group
      from public.app_users
      where role = 'student' and active = true and class_group is not null and class_group <> ''
    ) classes
  ),
  cycles_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'classGroup', c.class_group,
      'status', c.status,
      'startsOn', c.starts_on,
      'endsOn', c.ends_on,
      'notes', c.notes,
      'createdAt', c.created_at
    ) order by c.created_at desc), '[]'::jsonb) value
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
  select jsonb_build_object(
    'token', p_token,
    'user', public.user_json(u),
    'classes', (select value from classes_json),
    'skills', (select value from skills_json),
    'cycles', (select value from cycles_json),
    'activeSessions', (select value from sessions_json)
  )
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
    'session', jsonb_build_object(
      'id', s.id,
      'cycleId', s.cycle_id,
      'name', s.name,
      'classGroup', c.class_group,
      'accessCode', s.access_code,
      'status', s.status,
      'locked', s.locked_at is not null,
      'lockedAt', s.locked_at,
      'evaluationsCount', evaluations_count
    ),
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
$function$;

create or replace function public.session_by_code(p_token uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  s public.sessions;
  c public.cycles;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role <> 'student' then raise exception 'Aquesta acció és només per a alumnat.'; end if;

  select * into s from public.sessions where access_code = btrim(p_code) limit 1;
  if s.id is null then raise exception 'Aquest codi no existeix.'; end if;
  if s.status = 'draft' then raise exception 'Aquesta sessió encara no està oberta.'; end if;
  if s.status = 'closed' or s.locked_at is not null then raise exception 'La sessió ja està bloquejada.'; end if;

  select * into c from public.cycles where id = s.cycle_id limit 1;
  if c.class_group <> u.class_group then raise exception 'Aquesta sessió no correspon a la teva classe.'; end if;

  return public.session_details(p_token, s.id);
end;
$function$;

create or replace function public.lock_session(p_token uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  s public.sessions;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then raise exception 'No tens accés a aquesta sessió.'; end if;

  update public.sessions set locked_at = now(), updated_at = now() where id = p_session_id;
  return public.session_details(p_token, p_session_id);
end;
$function$;

create or replace function public.unlock_session(p_token uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  s public.sessions;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then raise exception 'No tens accés a aquesta sessió.'; end if;

  update public.sessions set locked_at = null, updated_at = now() where id = p_session_id;
  return public.session_details(p_token, p_session_id);
end;
$function$;

create or replace function public.delete_session(p_token uuid, p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  s public.sessions;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then raise exception 'No tens accés a aquesta sessió.'; end if;

  delete from public.sessions where id = p_session_id;
  return public.bootstrap_for_user(u, p_token);
end;
$function$;

create or replace function public.duplicate_session(p_token uuid, p_session_id uuid, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  source_session public.sessions;
  new_session public.sessions;
  code text;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;

  select * into source_session from public.sessions where id = p_session_id limit 1;
  if source_session.id is null or (u.role <> 'admin' and source_session.teacher_id <> u.id) then raise exception 'No tens accés a aquesta sessió.'; end if;

  loop
    code := lpad((floor(random() * 900000 + 100000))::int::text, 6, '0');
    exit when not exists (select 1 from public.sessions where access_code = code);
  end loop;

  insert into public.sessions (cycle_id, name, session_date, access_code, status, teacher_id)
  values (source_session.cycle_id, coalesce(nullif(btrim(p_name), ''), 'Còpia de ' || source_session.name), source_session.session_date, code, 'draft', u.id)
  returning * into new_session;

  insert into public.session_behaviors (session_id, behavior_id)
  select new_session.id, behavior_id
  from public.session_behaviors
  where session_id = source_session.id
  on conflict do nothing;

  insert into public.session_students (session_id, student_id)
  select new_session.id, student_id
  from public.session_students
  where session_id = source_session.id
  on conflict do nothing;

  return public.session_details(p_token, new_session.id);
end;
$function$;

create or replace function public.update_session(p_token uuid, p_session_id uuid, p_data jsonb)
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
  behavior_code text;
  student_id text;
  only_name boolean;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then raise exception 'No tens accés a aquesta sessió.'; end if;

  if not coalesce(p_data ? 'name', false) or nullif(btrim(p_data->>'name'), '') is null then
    raise exception 'Cal escriure el nom de la sessió.';
  end if;

  select count(*) into evaluations_count from public.evaluations e where e.session_id = p_session_id;
  only_name := evaluations_count > 0;

  if only_name and not coalesce((p_data->>'clearEvaluations')::boolean, false) then
    raise exception 'Aquesta sessió ja té valoracions. Confirma que vols esborrar-les abans de canviar-la.';
  end if;

  if only_name then
    delete from public.evaluations where session_id = p_session_id;
    update public.sessions
    set name = btrim(p_data->>'name'), updated_at = now()
    where id = p_session_id;
    return public.session_details(p_token, p_session_id);
  end if;

  select * into c from public.cycles where id = coalesce(nullif(p_data->>'cycleId', '')::uuid, s.cycle_id) limit 1;
  if c.id is null or (u.role <> 'admin' and c.teacher_id <> u.id) then raise exception 'No tens accés a aquest cicle.'; end if;

  update public.sessions
  set cycle_id = c.id,
      name = btrim(p_data->>'name'),
      session_date = nullif(p_data->>'sessionDate', '')::date,
      status = case when coalesce((p_data->>'openNow')::boolean, s.status = 'open') then 'open' else 'draft' end,
      updated_at = now()
  where id = p_session_id;

  delete from public.session_behaviors where session_id = p_session_id;
  for behavior_code in select jsonb_array_elements_text(coalesce(p_data->'behaviorCodes', '[]'::jsonb)) loop
    insert into public.session_behaviors (session_id, behavior_id)
    select p_session_id, b.id
    from public.behaviors b
    where b.code = behavior_code or b.id = behavior_code
    on conflict do nothing;
  end loop;

  delete from public.session_students where session_id = p_session_id;
  for student_id in select jsonb_array_elements_text(coalesce(p_data->'studentIds', '[]'::jsonb)) loop
    insert into public.session_students (session_id, student_id)
    values (p_session_id, student_id)
    on conflict do nothing;
  end loop;

  return public.session_details(p_token, p_session_id);
end;
$function$;

create or replace function public.submit_student_evaluations(p_token uuid, p_code text, p_ratings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  s public.sessions;
  c public.cycles;
  rating jsonb;
  evaluated text;
  behavior text;
  numeric_value integer;
  saved_count integer := 0;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role <> 'student' then raise exception 'Aquesta acció és només per a alumnat.'; end if;

  select * into s from public.sessions where access_code = btrim(p_code) and status = 'open' and locked_at is null limit 1;
  if s.id is null then raise exception 'La sessió no està oberta o està bloquejada.'; end if;

  select * into c from public.cycles where id = s.cycle_id limit 1;
  if c.class_group <> u.class_group then raise exception 'Aquesta sessió no correspon a la teva classe.'; end if;

  for rating in select * from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) loop
    evaluated := rating->>'evaluatedId';
    behavior := rating->>'behaviorId';
    numeric_value := (rating->>'value')::integer;
    if numeric_value < 1 or numeric_value > 5 then raise exception 'Les valoracions han de ser entre 1 i 5.'; end if;
    if not exists (select 1 from public.app_users st where st.id = evaluated and st.role = 'student' and st.class_group = c.class_group and st.active = true) then raise exception 'S’ha intentat valorar un alumne que no pertany a la sessió.'; end if;
    if not exists (select 1 from public.session_behaviors where session_id = s.id and behavior_id = behavior) then raise exception 'S’ha intentat valorar un comportament que no és en aquesta sessió.'; end if;

    insert into public.evaluations (session_id, cycle_id, class_group, evaluator_id, evaluator_type, evaluated_id, behavior_id, value, evaluation_type)
    values (s.id, c.id, c.class_group, u.id, 'student', evaluated, behavior, numeric_value, case when evaluated = u.id then 'self' else 'peer' end)
    on conflict (session_id, evaluator_id, evaluated_id, behavior_id, evaluator_type)
    do update set value = excluded.value, updated_at = now();
    saved_count := saved_count + 1;
  end loop;

  return jsonb_build_object('saved', saved_count);
end;
$function$;

create or replace function public.submit_teacher_evaluations(p_token uuid, p_session_id uuid, p_ratings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  s public.sessions;
  c public.cycles;
  rating jsonb;
  evaluated text;
  behavior text;
  numeric_value integer;
  saved_count integer := 0;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then raise exception 'No tens accés a aquesta sessió.'; end if;
  if s.status <> 'open' or s.locked_at is not null then raise exception 'La sessió ha d’estar oberta i desbloquejada per enviar valoracions.'; end if;

  select * into c from public.cycles where id = s.cycle_id limit 1;

  for rating in select * from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) loop
    evaluated := rating->>'evaluatedId';
    behavior := rating->>'behaviorId';
    numeric_value := (rating->>'value')::integer;
    if numeric_value < 1 or numeric_value > 5 then raise exception 'Les valoracions han de ser entre 1 i 5.'; end if;
    if not exists (select 1 from public.app_users st where st.id = evaluated and st.role = 'student' and st.class_group = c.class_group and st.active = true) then raise exception 'S’ha intentat valorar un alumne que no pertany a la sessió.'; end if;
    if not exists (select 1 from public.session_behaviors where session_id = s.id and behavior_id = behavior) then raise exception 'S’ha intentat valorar un comportament que no és en aquesta sessió.'; end if;

    insert into public.evaluations (session_id, cycle_id, class_group, evaluator_id, evaluator_type, evaluated_id, behavior_id, value, evaluation_type)
    values (s.id, c.id, c.class_group, u.id, 'teacher', evaluated, behavior, numeric_value, 'teacher')
    on conflict (session_id, evaluator_id, evaluated_id, behavior_id, evaluator_type)
    do update set value = excluded.value, updated_at = now();
    saved_count := saved_count + 1;
  end loop;

  return jsonb_build_object('saved', saved_count);
end;
$function$;;
