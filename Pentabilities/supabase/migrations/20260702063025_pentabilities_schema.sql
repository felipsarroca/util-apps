create extension if not exists pgcrypto;

create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text not null default '',
  last_name text not null default '',
  full_name text generated always as (btrim(first_name || ' ' || last_name)) stored,
  role text not null check (role in ('student', 'teacher', 'admin')),
  class_group text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  color text not null default '#1f6f8b',
  position integer not null
);

create table public.behaviors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  skill_id uuid not null references public.skills(id) on delete cascade,
  name text not null,
  description text not null default '',
  position integer not null,
  active boolean not null default true
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years(id),
  name text not null,
  class_group text not null,
  teacher_id uuid not null references public.app_users(id),
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'closed', 'archived')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  name text not null,
  session_date date,
  access_code text not null unique,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  teacher_id uuid not null references public.app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.session_behaviors (
  session_id uuid not null references public.sessions(id) on delete cascade,
  behavior_id uuid not null references public.behaviors(id),
  primary key (session_id, behavior_id)
);

create table public.session_students (
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.app_users(id),
  primary key (session_id, student_id)
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  class_group text not null,
  evaluator_id uuid not null references public.app_users(id),
  evaluator_type text not null check (evaluator_type in ('student', 'teacher')),
  evaluated_id uuid not null references public.app_users(id),
  behavior_id uuid not null references public.behaviors(id),
  value integer not null check (value between 1 and 5),
  evaluation_type text not null check (evaluation_type in ('self', 'peer', 'teacher')),
  created_at timestamptz not null default now(),
  unique (session_id, evaluator_id, evaluated_id, behavior_id, evaluator_type)
);

create table public.app_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '6 hours',
  created_at timestamptz not null default now()
);

create index app_users_role_idx on public.app_users(role);
create index app_users_class_idx on public.app_users(class_group);
create index cycles_teacher_idx on public.cycles(teacher_id);
create index cycles_class_idx on public.cycles(class_group);
create index sessions_cycle_idx on public.sessions(cycle_id);
create index sessions_teacher_idx on public.sessions(teacher_id);
create index evaluations_session_idx on public.evaluations(session_id);
create index evaluations_evaluator_idx on public.evaluations(evaluator_id);

alter table public.school_years enable row level security;
alter table public.app_users enable row level security;
alter table public.skills enable row level security;
alter table public.behaviors enable row level security;
alter table public.cycles enable row level security;
alter table public.sessions enable row level security;
alter table public.session_behaviors enable row level security;
alter table public.session_students enable row level security;
alter table public.evaluations enable row level security;
alter table public.app_tokens enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

insert into public.school_years (name, is_active)
values ('2026-2027', true)
on conflict (name) do nothing;

insert into public.skills (code, name, description, color, position) values
('R', 'Responsabilitat', 'Compromís, autodisciplina i cura en la feina de classe.', '#2f6fbd', 1),
('C', 'Cooperació', 'Participació, escolta, ajuda i presa de decisions en grup.', '#238457', 2),
('A', 'Autonomia i iniciativa', 'Capacitat de treballar pel propi compte, proposar idees i avançar.', '#c86a1f', 3),
('G', 'Gestió emocional', 'Reconeixement i regulació de les emocions en diferents situacions.', '#c44f6d', 4),
('P', 'Habilitats de pensament', 'Comprensió, connexió, reflexió i resolució de problemes.', '#7454c8', 5)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  position = excluded.position;

insert into public.behaviors (code, skill_id, name, description, position)
select item.code, s.id, item.name, item.description, item.position
from (values
('R1','R','Fa comentaris o activitats relacionats amb la tasca','El que diu i fa té a veure amb la feina que s’està fent a classe.',1),
('R2','R','Realitza les tasques de forma eficient','Fa la feina ben feta i aprofita el temps i els materials.',2),
('R3','R','Realitza les tasques amb cura','Cuida els detalls i treballa amb tranquil·litat.',3),
('R4','R','Persevera davant les dificultats','No deixa la feina a mitges i ho torna a intentar.',4),
('R5','R','Respecta les normes','Respecta els acords de convivència, els espais i el material.',5),
('R6','R','Treballa de forma constant','Manté una actitud de treball i evita distraccions.',6),
('R7','R','Es manté connectat a l’activitat','Està concentrat en l’activitat i no es deixa portar per altres coses.',7),
('C1','C','Escolta els altres','Escolta quan els altres parlen i manté l’atenció.',1),
('C2','C','Incorpora el que diuen els altres','Té en compte les aportacions dels companys sense jutjar.',2),
('C3','C','Fomenta la participació del grup','Convida i dona espai perquè tothom participi.',3),
('C4','C','Participa en decisions consensuades','Expressa el que pensa amb respecte i facilita acords.',4),
('C5','C','Facilita la resolució de conflictes','Ajuda a resoldre conflictes amb paciència i escolta.',5),
('C6','C','Reconeix responsabilitats pròpies i alienes','Accepta el valor del treball i les responsabilitats dels altres.',6),
('C7','C','Ajuda els altres de forma desinteressada','Mostra solidaritat i empatia sense esperar res a canvi.',7),
('A1','A','Aporta idees','Exposa idees relacionades amb la feina a fer.',1),
('A2','A','Fa preguntes quan s’encalla','Demana ajuda amb preguntes útils després d’haver-ho intentat.',2),
('A3','A','Pren decisions per avançar','Fa propostes que permeten continuar treballant.',3),
('A4','A','Sap convèncer el grup','Explica i defensa propostes amb claredat i respecte.',4),
('A5','A','Treballa amb determinació','Mostra energia, ganes i compromís amb la feina.',5),
('A6','A','Creu que pot iniciar canvis','Mostra seguretat i confiança per fer les coses bé.',6),
('A7','A','Planifica i prioritza les tasques','Ordena la feina i aprofita el temps disponible.',7),
('G1','G','Transmet alegria','Crea ambients positius amb bon humor i optimisme.',1),
('G2','G','Es mostra tranquil en situacions de pressió','Manté la calma en moments d’estrès o tensió.',2),
('G3','G','Controla les emocions en conflictes','Regula emocions com ràbia, por o frustració per millorar la situació.',3),
('G4','G','Assumeix la possibilitat d’equivocar-se','Entén l’error com una oportunitat per aprendre.',4),
('G5','G','Accepta que les seves propostes no tirin endavant','Mostra flexibilitat quan una idea no és acceptada.',5),
('G6','G','Adequa el comportament a les circumstàncies','Respon de manera positiva segons el moment i el context.',6),
('G7','G','Reconeix com se sent','Identifica i pot explicar emocions pròpies durant la feina.',7),
('P1','P','Relaciona continguts nous amb coneixements previs','Connecta el que aprèn amb altres situacions o coneixements.',1),
('P2','P','Fa bones reflexions sobre els continguts','Explica el que ha après amb detall i relacions significatives.',2),
('P3','P','Fa bones reflexions personals internes','Reconeix com aprèn, com se sent i com gestiona emocions.',3),
('P4','P','Fa bones preguntes','Formula preguntes que mostren curiositat i fan avançar.',4),
('P5','P','Té idees creatives','Explora camins alternatius per resoldre activitats o problemes.',5),
('P6','P','Planteja bones estratègies de resolució','Analitza la informació important i la fa servir per resoldre problemes.',6),
('P7','P','Expressa eficaçment les idees','Comunica amb ordre, claredat, precisió i estructura.',7)
) as item(code, skill_code, name, description, position)
join public.skills s on s.code = item.skill_code
on conflict (code) do update set
  skill_id = excluded.skill_id,
  name = excluded.name,
  description = excluded.description,
  position = excluded.position,
  active = true;

create or replace function public.active_user_from_token(p_token uuid)
returns public.app_users
language sql
security definer
set search_path = public
as $$
  select u.*
  from public.app_tokens t
  join public.app_users u on u.id = t.user_id
  where t.token = p_token
    and t.expires_at > now()
    and u.active = true
  limit 1
$$;

create or replace function public.user_json(u public.app_users)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', coalesce(nullif(u.full_name, ''), u.email),
    'role', u.role,
    'classGroup', u.class_group
  )
$$;

create or replace function public.bootstrap_for_user(u public.app_users, p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with active_year as (
    select * from public.school_years where is_active = true order by created_at desc limit 1
  ),
  skills_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
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
      ) order by s.position
    ), '[]'::jsonb) value
    from public.skills s
  ),
  classes_json as (
    select coalesce(jsonb_agg(class_group order by class_group), '[]'::jsonb) value
    from (
      select distinct class_group
      from public.app_users
      where role = 'student' and active = true and class_group is not null
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
    where u.role in ('teacher', 'admin')
      and (u.role = 'admin' or c.teacher_id = u.id)
  ),
  sessions_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'cycleId', s.cycle_id,
      'name', s.name,
      'classGroup', c.class_group,
      'accessCode', s.access_code,
      'status', s.status,
      'progress', jsonb_build_object(
        'totalStudents', (select count(*) from public.app_users st where st.role = 'student' and st.active = true and st.class_group = c.class_group),
        'respondents', (select count(distinct e.evaluator_id) from public.evaluations e where e.session_id = s.id and e.evaluator_type = 'student'),
        'pending', greatest(
          (select count(*) from public.app_users st where st.role = 'student' and st.active = true and st.class_group = c.class_group)
          - (select count(distinct e.evaluator_id) from public.evaluations e where e.session_id = s.id and e.evaluator_type = 'student'),
          0
        )
      )
    ) order by s.created_at desc), '[]'::jsonb) value
    from public.sessions s
    join public.cycles c on c.id = s.cycle_id
    where u.role in ('teacher', 'admin')
      and s.status <> 'closed'
      and (u.role = 'admin' or s.teacher_id = u.id)
  )
  select jsonb_build_object(
    'token', p_token,
    'user', public.user_json(u),
    'activeSchoolYear', coalesce((select name from active_year), '2026-2027'),
    'classes', (select value from classes_json),
    'skills', (select value from skills_json),
    'cycles', (select value from cycles_json),
    'activeSessions', (select value from sessions_json)
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

  if u.role in ('teacher', 'admin') and coalesce(p_password, '') <> 'CHANGE_ME' then
    raise exception 'Contrasenya de professorat incorrecta.';
  end if;

  insert into public.app_tokens(user_id) values (u.id) returning token into new_token;
  return public.bootstrap_for_user(u, new_token);
end;
$$;

create or replace function public.app_bootstrap(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.id is null then
    raise exception 'La sessió ha caducat. Torna a entrar.';
  end if;
  return public.bootstrap_for_user(u, p_token);
end;
$$;

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
      'name', coalesce(nullif(full_name, ''), email),
      'email', email,
      'classGroup', class_group
    ) order by full_name), '[]'::jsonb)
    from public.app_users
    where role = 'student' and active = true and class_group = p_class_group
  );
end;
$$;

create or replace function public.create_cycle(p_token uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  y public.school_years;
  c public.cycles;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then
    raise exception 'Només el professorat pot fer aquesta acció.';
  end if;
  select * into y from public.school_years where name = coalesce(p_data->>'schoolYear', '') limit 1;
  if y.id is null then
    select * into y from public.school_years where is_active = true limit 1;
  end if;
  insert into public.cycles (school_year_id, name, class_group, teacher_id, starts_on, ends_on, notes)
  values (
    y.id,
    btrim(p_data->>'name'),
    btrim(p_data->>'classGroup'),
    u.id,
    nullif(p_data->>'startsOn', '')::date,
    nullif(p_data->>'endsOn', '')::date,
    coalesce(p_data->>'notes', '')
  )
  returning * into c;
  return public.app_bootstrap(p_token);
end;
$$;

create or replace function public.create_session(p_token uuid, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.app_users;
  c public.cycles;
  s public.sessions;
  code text;
  behavior_code text;
  student_id uuid;
begin
  select * into u from public.active_user_from_token(p_token);
  if u.role not in ('teacher', 'admin') then
    raise exception 'Només el professorat pot fer aquesta acció.';
  end if;

  select * into c from public.cycles where id = (p_data->>'cycleId')::uuid limit 1;
  if c.id is null or (u.role <> 'admin' and c.teacher_id <> u.id) then
    raise exception 'No tens accés a aquest cicle.';
  end if;

  loop
    code := lpad((floor(random() * 900000 + 100000))::int::text, 6, '0');
    exit when not exists (select 1 from public.sessions where access_code = code);
  end loop;

  insert into public.sessions (cycle_id, name, session_date, access_code, status, teacher_id)
  values (
    c.id,
    btrim(p_data->>'name'),
    nullif(p_data->>'sessionDate', '')::date,
    code,
    case when coalesce((p_data->>'openNow')::boolean, true) then 'open' else 'draft' end,
    u.id
  )
  returning * into s;

  for behavior_code in select jsonb_array_elements_text(coalesce(p_data->'behaviorCodes', '[]'::jsonb)) loop
    insert into public.session_behaviors (session_id, behavior_id)
    select s.id, b.id from public.behaviors b where b.code = behavior_code
    on conflict do nothing;
  end loop;

  for student_id in select (jsonb_array_elements_text(coalesce(p_data->'studentIds', '[]'::jsonb)))::uuid loop
    insert into public.session_students (session_id, student_id) values (s.id, student_id)
    on conflict do nothing;
  end loop;

  return public.session_details(p_token, s.id);
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
  select * into s from public.sessions where id = p_session_id limit 1;
  select * into c from public.cycles where id = s.cycle_id limit 1;
  if s.id is null or (u.role <> 'admin' and u.role in ('teacher') and s.teacher_id <> u.id) then
    raise exception 'No tens accés a aquesta sessió.';
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

    if not exists (select 1 from public.app_users st where st.id = evaluated and st.role = 'student' and st.class_group = c.class_group) then
      raise exception 'S’ha intentat valorar un alumne que no pertany a la sessió.';
    end if;
    if not exists (select 1 from public.session_behaviors where session_id = s.id and behavior_id = behavior) then
      raise exception 'S’ha intentat valorar un comportament que no és en aquesta sessió.';
    end if;

    insert into public.evaluations (session_id, cycle_id, class_group, evaluator_id, evaluator_type, evaluated_id, behavior_id, value, evaluation_type)
    values (s.id, c.id, c.class_group, u.id, 'student', evaluated, behavior, numeric_value, case when evaluated = u.id then 'self' else 'peer' end);
  end loop;

  return jsonb_build_object('saved', jsonb_array_length(coalesce(p_ratings, '[]'::jsonb)));
exception
  when unique_violation then
    raise exception 'Aquest alumne ja ha enviat aquesta valoració dins la sessió.';
end;
$$;

grant execute on function public.app_login(text, text) to anon;
grant execute on function public.app_bootstrap(uuid) to anon;
grant execute on function public.students_by_class(uuid, text) to anon;
grant execute on function public.create_cycle(uuid, jsonb) to anon;
grant execute on function public.create_session(uuid, jsonb) to anon;
grant execute on function public.session_details(uuid, uuid) to anon;
grant execute on function public.session_by_code(uuid, text) to anon;
grant execute on function public.submit_student_evaluations(uuid, text, jsonb) to anon;
