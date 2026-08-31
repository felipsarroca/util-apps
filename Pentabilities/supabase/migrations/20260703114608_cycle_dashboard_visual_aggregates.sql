create or replace function public.cycle_dashboard(p_token uuid, p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  u public.app_users;
  c public.cycles;
  global_average numeric;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then raise exception 'Només el professorat pot fer aquesta acció.'; end if;

  select * into c from public.cycles where id = p_cycle_id limit 1;
  if c.id is null or (u.role <> 'admin' and c.teacher_id <> u.id) then raise exception 'No tens accés a aquest cicle.'; end if;

  select coalesce(round(avg(value)::numeric, 2), 0) into global_average
  from public.evaluations
  where cycle_id = c.id;

  return jsonb_build_object(
    'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'classGroup', c.class_group, 'status', c.status),
    'totalStudents', (select count(*) from public.app_users where role = 'student' and active = true and class_group = c.class_group),
    'sessionsCount', (select count(*) from public.sessions where cycle_id = c.id),
    'respondents', (select count(distinct evaluator_id) from public.evaluations where cycle_id = c.id and evaluator_type = 'student'),
    'evaluationsCount', (select count(*) from public.evaluations where cycle_id = c.id),
    'globalAverage', global_average,
    'byType', (
      select coalesce(jsonb_agg(jsonb_build_object('key', evaluation_type, 'count', count, 'average', average) order by case evaluation_type when 'self' then 1 when 'peer' then 2 when 'teacher' then 3 else 4 end), '[]'::jsonb)
      from (
        select evaluation_type, count(*) count, round(avg(value)::numeric, 2) average
        from public.evaluations
        where cycle_id = c.id
        group by evaluation_type
      ) x
    ),
    'distribution', (
      select jsonb_agg(jsonb_build_object('value', value, 'count', count) order by value)
      from (
        select n value, count(e.value) count
        from generate_series(1,5) n
        left join public.evaluations e on e.cycle_id = c.id and e.value = n
        group by n
      ) x
    ),
    'bySkill', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'key', s.code,
        'label', s.name,
        'color', s.color,
        'count', coalesce(x.count, 0),
        'average', coalesce(x.average, 0),
        'self', coalesce(x.self_average, 0),
        'peer', coalesce(x.peer_average, 0),
        'teacher', coalesce(x.teacher_average, 0)
      ) order by s.position), '[]'::jsonb)
      from public.skills s
      left join (
        select b.skill_id,
          count(e.*) count,
          round(avg(e.value)::numeric, 2) average,
          round(avg(e.value) filter (where e.evaluation_type = 'self')::numeric, 2) self_average,
          round(avg(e.value) filter (where e.evaluation_type = 'peer')::numeric, 2) peer_average,
          round(avg(e.value) filter (where e.evaluation_type = 'teacher')::numeric, 2) teacher_average
        from public.behaviors b
        left join public.evaluations e on e.behavior_id = b.id and e.cycle_id = c.id
        where b.active = true
        group by b.skill_id
      ) x on x.skill_id = s.id
    ),
    'byBehavior', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id,
        'key', b.code,
        'label', b.name,
        'skillKey', s.code,
        'skillLabel', s.name,
        'color', s.color,
        'count', coalesce(x.count, 0),
        'average', coalesce(x.average, 0),
        'self', coalesce(x.self_average, 0),
        'peer', coalesce(x.peer_average, 0),
        'teacher', coalesce(x.teacher_average, 0)
      ) order by s.position, b.position), '[]'::jsonb)
      from public.behaviors b
      join public.skills s on s.id = b.skill_id
      left join (
        select behavior_id,
          count(*) count,
          round(avg(value)::numeric, 2) average,
          round(avg(value) filter (where evaluation_type = 'self')::numeric, 2) self_average,
          round(avg(value) filter (where evaluation_type = 'peer')::numeric, 2) peer_average,
          round(avg(value) filter (where evaluation_type = 'teacher')::numeric, 2) teacher_average
        from public.evaluations
        where cycle_id = c.id
        group by behavior_id
      ) x on x.behavior_id = b.id
      where b.active = true
    ),
    'byStudent', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', st.id,
        'name', coalesce(nullif(st.full_name, ''), btrim(st.first_name || ' ' || st.last_name), st.email),
        'count', coalesce(x.count, 0),
        'average', coalesce(x.average, 0),
        'delta', round((coalesce(x.average, 0) - global_average)::numeric, 2),
        'self', coalesce(x.self_average, 0),
        'peer', coalesce(x.peer_average, 0),
        'teacher', coalesce(x.teacher_average, 0)
      ) order by coalesce(x.average, 0) desc, st.last_name, st.first_name, st.full_name), '[]'::jsonb)
      from public.app_users st
      left join (
        select evaluated_id,
          count(*) count,
          round(avg(value)::numeric, 2) average,
          round(avg(value) filter (where evaluation_type = 'self')::numeric, 2) self_average,
          round(avg(value) filter (where evaluation_type = 'peer')::numeric, 2) peer_average,
          round(avg(value) filter (where evaluation_type = 'teacher')::numeric, 2) teacher_average
        from public.evaluations
        where cycle_id = c.id
        group by evaluated_id
      ) x on x.evaluated_id = st.id
      where st.role = 'student' and st.active = true and st.class_group = c.class_group
    )
  );
end;
$function$;;
