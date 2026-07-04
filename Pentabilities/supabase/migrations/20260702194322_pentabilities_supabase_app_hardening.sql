create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

insert into public.app_settings(key, value)
values ('teacher_password', crypt('CHANGE_ME', gen_salt('bf')))
on conflict (key) do nothing;

drop function if exists public.app_login(text, text);
drop function if exists public.session_details(uuid, uuid);
drop function if exists public.session_by_code(uuid, text);
drop function if exists public.submit_student_evaluations(uuid, text, jsonb);
drop function if exists public.submit_teacher_evaluations(uuid, uuid, jsonb);
drop function if exists public.open_session(uuid, uuid);
drop function if exists public.close_session(uuid, uuid);
drop function if exists public.session_dashboard(uuid, uuid);
drop function if exists public.cycle_dashboard(uuid, uuid);

revoke all on all functions in schema public from public, anon, authenticated;

create or replace function public.assert_teacher_password(p_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_settings
    where key = 'teacher_password'
      and value = crypt(coalesce(p_password, ''), value)
  )
$$;

create or replace function public.app_login(p_email text, p_password text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  new_token uuid;
begin
  select * into u
  from public.app_users
  where lower(email) = lower(btrim(p_email))
    and active = true
  limit 1;

  if u.id is null then
    raise exception 'Aquest correu no consta a la llista d’alumnes o professorat.';
  end if;

  if u.role in ('teacher', 'admin') and not public.assert_teacher_password(p_password) then
    raise exception 'Contrasenya de professorat incorrecta.';
  end if;

  insert into public.app_tokens(user_id) values (u.id) returning token into new_token;
  return public.bootstrap_for_user(u, new_token);
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
  if u.id is null then
    raise exception 'La sessió ha caducat. Torna a entrar.';
  end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null then
    raise exception 'Aquesta sessió no existeix.';
  end if;

  select * into c from public.cycles where id = s.cycle_id limit 1;
  if u.role = 'teacher' and s.teacher_id <> u.id then
    raise exception 'No tens accés a aquesta sessió.';
  end if;
  if u.role = 'student' and (s.status <> 'open' or c.class_group <> u.class_group) then
    raise exception 'Aquesta sessió no correspon a la teva classe.';
  end if;

  return jsonb_build_object(
    'session', jsonb_build_object('id', s.id, 'cycleId', s.cycle_id, 'name', s.name, 'classGroup', c.class_group, 'accessCode', s.access_code, 'status', s.status),
    'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'classGroup', c.class_group),
    'behaviors', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name, 'description', b.description) order by b.code), '[]'::jsonb)
      from public.session_behaviors sb join public.behaviors b on b.id = sb.behavior_id
      where sb.session_id = s.id
    ),
    'students', (
      select coalesce(jsonb_agg(jsonb_build_object('id', st.id, 'name', coalesce(nullif(st.full_name, ''), st.email), 'classGroup', st.class_group) order by st.full_name), '[]'::jsonb)
      from public.app_users st
      where st.role = 'student' and st.active = true and st.class_group = c.class_group
    ),
    'heteroStudentIds', (
      select coalesce(jsonb_agg(student_id), '[]'::jsonb) from public.session_students where session_id = s.id
    )
  );
end;
$$;

create or replace function public.session_by_code(p_token uuid, p_code text)
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
  if u.role <> 'student' then
    raise exception 'Aquesta acció és només per a alumnat.';
  end if;

  select * into s from public.sessions where access_code = btrim(p_code) limit 1;
  if s.id is null then raise exception 'Aquest codi no existeix.'; end if;
  if s.status = 'draft' then raise exception 'Aquesta sessió encara no està oberta.'; end if;
  if s.status = 'closed' then raise exception 'La sessió ja està tancada.'; end if;

  select * into c from public.cycles where id = s.cycle_id limit 1;
  if c.class_group <> u.class_group then
    raise exception 'Aquesta sessió no correspon a la teva classe.';
  end if;

  return public.session_details(p_token, s.id);
end;
$$;

create or replace function public.submit_student_evaluations(p_token uuid, p_code text, p_ratings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  s public.sessions;
  c public.cycles;
  rating jsonb;
  evaluated uuid;
  behavior uuid;
  numeric_value integer;
  saved_count integer := 0;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role <> 'student' then
    raise exception 'Aquesta acció és només per a alumnat.';
  end if;

  select * into s from public.sessions where access_code = btrim(p_code) and status = 'open' limit 1;
  if s.id is null then raise exception 'La sessió no està oberta.'; end if;
  select * into c from public.cycles where id = s.cycle_id limit 1;
  if c.class_group <> u.class_group then raise exception 'Aquesta sessió no correspon a la teva classe.'; end if;

  for rating in select * from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) loop
    evaluated := (rating->>'evaluatedId')::uuid;
    behavior := (rating->>'behaviorId')::uuid;
    numeric_value := (rating->>'value')::integer;

    if numeric_value < 1 or numeric_value > 5 then
      raise exception 'Les valoracions han de ser entre 1 i 5.';
    end if;
    if not exists (select 1 from public.app_users st where st.id = evaluated and st.role = 'student' and st.class_group = c.class_group and st.active = true) then
      raise exception 'S’ha intentat valorar un alumne que no pertany a la sessió.';
    end if;
    if not exists (select 1 from public.session_behaviors where session_id = s.id and behavior_id = behavior) then
      raise exception 'S’ha intentat valorar un comportament que no és en aquesta sessió.';
    end if;

    insert into public.evaluations (session_id, cycle_id, class_group, evaluator_id, evaluator_type, evaluated_id, behavior_id, value, evaluation_type)
    values (s.id, c.id, c.class_group, u.id, 'student', evaluated, behavior, numeric_value, case when evaluated = u.id then 'self' else 'peer' end);
    saved_count := saved_count + 1;
  end loop;

  if saved_count = 0 then
    raise exception 'No hi ha cap valoració per desar.';
  end if;
  return jsonb_build_object('saved', saved_count);
exception
  when unique_violation then
    raise exception 'Aquest alumne ja ha enviat aquesta valoració dins la sessió.';
end;
$$;

create or replace function public.submit_teacher_evaluations(p_token uuid, p_session_id uuid, p_ratings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  s public.sessions;
  c public.cycles;
  rating jsonb;
  evaluated uuid;
  behavior uuid;
  numeric_value integer;
  saved_count integer := 0;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then
    raise exception 'Només el professorat pot fer aquesta acció.';
  end if;

  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then
    raise exception 'No tens accés a aquesta sessió.';
  end if;
  if s.status <> 'open' then
    raise exception 'La sessió ha d’estar oberta per enviar valoracions.';
  end if;
  select * into c from public.cycles where id = s.cycle_id limit 1;

  for rating in select * from jsonb_array_elements(coalesce(p_ratings, '[]'::jsonb)) loop
    evaluated := (rating->>'evaluatedId')::uuid;
    behavior := (rating->>'behaviorId')::uuid;
    numeric_value := (rating->>'value')::integer;

    if numeric_value < 1 or numeric_value > 5 then
      raise exception 'Les valoracions han de ser entre 1 i 5.';
    end if;
    if not exists (select 1 from public.app_users st where st.id = evaluated and st.role = 'student' and st.class_group = c.class_group and st.active = true) then
      raise exception 'S’ha intentat valorar un alumne que no pertany a la sessió.';
    end if;
    if not exists (select 1 from public.session_behaviors where session_id = s.id and behavior_id = behavior) then
      raise exception 'S’ha intentat valorar un comportament que no és en aquesta sessió.';
    end if;

    insert into public.evaluations (session_id, cycle_id, class_group, evaluator_id, evaluator_type, evaluated_id, behavior_id, value, evaluation_type)
    values (s.id, c.id, c.class_group, u.id, 'teacher', evaluated, behavior, numeric_value, 'teacher')
    on conflict (session_id, evaluator_id, evaluated_id, behavior_id, evaluator_type)
    do update set value = excluded.value, created_at = now();
    saved_count := saved_count + 1;
  end loop;

  if saved_count = 0 then
    raise exception 'No hi ha cap valoració per desar.';
  end if;
  return jsonb_build_object('saved', saved_count);
end;
$$;

create or replace function public.set_session_status(p_token uuid, p_session_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  s public.sessions;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then
    raise exception 'Només el professorat pot fer aquesta acció.';
  end if;
  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then
    raise exception 'No tens accés a aquesta sessió.';
  end if;
  if p_status not in ('draft', 'open', 'closed') then
    raise exception 'Estat de sessió no vàlid.';
  end if;
  update public.sessions set status = p_status, updated_at = now() where id = p_session_id;
  return public.session_details(p_token, p_session_id);
end;
$$;

create or replace function public.open_session(p_token uuid, p_session_id uuid)
returns jsonb language sql security definer set search_path = public
as $$ select public.set_session_status(p_token, p_session_id, 'open') $$;

create or replace function public.close_session(p_token uuid, p_session_id uuid)
returns jsonb language sql security definer set search_path = public
as $$ select public.set_session_status(p_token, p_session_id, 'closed') $$;

create or replace function public.session_dashboard(p_token uuid, p_session_id uuid)
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
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;
  select * into s from public.sessions where id = p_session_id limit 1;
  if s.id is null or (u.role <> 'admin' and s.teacher_id <> u.id) then raise exception 'No tens accés a aquesta sessió.'; end if;
  select * into c from public.cycles where id = s.cycle_id limit 1;

  return jsonb_build_object(
    'session', jsonb_build_object('id', s.id, 'name', s.name, 'classGroup', c.class_group, 'status', s.status),
    'totalStudents', (select count(*) from public.app_users where role = 'student' and active = true and class_group = c.class_group),
    'respondents', (select count(distinct evaluator_id) from public.evaluations where session_id = s.id and evaluator_type = 'student'),
    'evaluationsCount', (select count(*) from public.evaluations where session_id = s.id),
    'globalAverage', coalesce((select round(avg(value)::numeric, 2) from public.evaluations where session_id = s.id), 0),
    'byBehavior', (
      select coalesce(jsonb_agg(jsonb_build_object('key', b.code, 'label', b.name, 'count', x.count, 'average', x.average) order by b.code), '[]'::jsonb)
      from (
        select behavior_id, count(*) count, round(avg(value)::numeric, 2) average
        from public.evaluations where session_id = s.id group by behavior_id
      ) x join public.behaviors b on b.id = x.behavior_id
    ),
    'byType', (
      select coalesce(jsonb_agg(jsonb_build_object('key', evaluation_type, 'count', count, 'average', average) order by evaluation_type), '[]'::jsonb)
      from (
        select evaluation_type, count(*) count, round(avg(value)::numeric, 2) average
        from public.evaluations where session_id = s.id group by evaluation_type
      ) x
    ),
    'distribution', (
      select jsonb_agg(jsonb_build_object('value', value, 'count', count) order by value)
      from (
        select n value, count(e.value) count
        from generate_series(1,5) n
        left join public.evaluations e on e.session_id = s.id and e.value = n
        group by n
      ) x
    )
  );
end;
$$;

create or replace function public.cycle_dashboard(p_token uuid, p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  c public.cycles;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;
  select * into c from public.cycles where id = p_cycle_id limit 1;
  if c.id is null or (u.role <> 'admin' and c.teacher_id <> u.id) then raise exception 'No tens accés a aquest cicle.'; end if;

  return jsonb_build_object(
    'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'classGroup', c.class_group, 'status', c.status),
    'sessionsCount', (select count(*) from public.sessions where cycle_id = c.id),
    'evaluationsCount', (select count(*) from public.evaluations where cycle_id = c.id),
    'globalAverage', coalesce((select round(avg(value)::numeric, 2) from public.evaluations where cycle_id = c.id), 0),
    'byBehavior', (
      select coalesce(jsonb_agg(jsonb_build_object('key', b.code, 'label', b.name, 'count', x.count, 'average', x.average) order by b.code), '[]'::jsonb)
      from (
        select behavior_id, count(*) count, round(avg(value)::numeric, 2) average
        from public.evaluations where cycle_id = c.id group by behavior_id
      ) x join public.behaviors b on b.id = x.behavior_id
    ),
    'byType', (
      select coalesce(jsonb_agg(jsonb_build_object('key', evaluation_type, 'count', count, 'average', average) order by evaluation_type), '[]'::jsonb)
      from (
        select evaluation_type, count(*) count, round(avg(value)::numeric, 2) average
        from public.evaluations where cycle_id = c.id group by evaluation_type
      ) x
    )
  );
end;
$$;

revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.app_login(text, text) to anon;
grant execute on function public.app_bootstrap(uuid) to anon;
grant execute on function public.students_by_class(uuid, text) to anon;
grant execute on function public.create_cycle(uuid, jsonb) to anon;
grant execute on function public.create_session(uuid, jsonb) to anon;
grant execute on function public.session_details(uuid, uuid) to anon;
grant execute on function public.session_by_code(uuid, text) to anon;
grant execute on function public.submit_student_evaluations(uuid, text, jsonb) to anon;
grant execute on function public.submit_teacher_evaluations(uuid, uuid, jsonb) to anon;
grant execute on function public.open_session(uuid, uuid) to anon;
grant execute on function public.close_session(uuid, uuid) to anon;
grant execute on function public.session_dashboard(uuid, uuid) to anon;
grant execute on function public.cycle_dashboard(uuid, uuid) to anon;
