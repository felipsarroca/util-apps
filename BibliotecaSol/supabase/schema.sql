-- Biblioteca de la Sol - esquema inicial de Supabase
-- Executa aquest fitxer a Supabase SQL Editor.
-- Pensat per a: cataleg, usuaris, accessos, reserves, prestecs i devolucions.

create extension if not exists pgcrypto;

create type public.user_role as enum ('lector', 'gestor', 'administrador');
create type public.reservation_status as enum ('pendent', 'acceptada', 'cancellada', 'rebutjada', 'convertida');
create type public.loan_status as enum ('actiu', 'retornat', 'perdut', 'cancellat');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text,
  role public.user_role not null default 'lector',
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  access_count integer not null default 1 check (access_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_domain check (lower(email) like '%@ramonpont.cat')
);

create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  email text not null,
  role public.user_role not null default 'lector',
  accessed_at timestamptz not null default now(),
  user_agent text,
  constraint access_logs_email_domain check (lower(email) like '%@ramonpont.cat')
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  publisher text,
  isbn text,
  publication_year integer check (publication_year is null or publication_year between 1400 and 2100),
  language text not null default 'Català',
  recommended_level text,
  topic text,
  genre text,
  summary text,
  location text,
  total_copies integer not null default 1 check (total_copies >= 0),
  available_copies integer not null default 1 check (available_copies >= 0),
  active boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_available_lte_total check (available_copies <= total_copies)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid references public.app_users(id) on delete set null,
  user_email text not null,
  status public.reservation_status not null default 'pendent',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.app_users(id) on delete set null,
  notes text,
  constraint reservations_user_email_domain check (lower(user_email) like '%@ramonpont.cat')
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  user_id uuid references public.app_users(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  user_email text not null,
  status public.loan_status not null default 'actiu',
  loaned_at timestamptz not null default now(),
  due_at date,
  returned_at timestamptz,
  loaned_by uuid references public.app_users(id) on delete set null,
  returned_by uuid references public.app_users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_user_email_domain check (lower(user_email) like '%@ramonpont.cat')
);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete restrict,
  user_id uuid references public.app_users(id) on delete set null,
  user_email text not null,
  returned_at timestamptz not null default now(),
  returned_by uuid references public.app_users(id) on delete set null,
  condition_notes text,
  created_at timestamptz not null default now(),
  constraint returns_user_email_domain check (lower(user_email) like '%@ramonpont.cat')
);

create table public.book_options (
  id uuid primary key default gen_random_uuid(),
  field_name text not null check (field_name in ('recommended_level', 'topic', 'genre', 'location')),
  value text not null,
  created_at timestamptz not null default now(),
  unique (field_name, value)
);

create index books_active_title_idx on public.books (active, title);
create index books_search_idx on public.books using gin (
  to_tsvector(
    'simple',
    coalesce(title, '') || ' ' ||
    coalesce(author, '') || ' ' ||
    coalesce(publisher, '') || ' ' ||
    coalesce(isbn, '') || ' ' ||
    coalesce(recommended_level, '') || ' ' ||
    coalesce(topic, '') || ' ' ||
    coalesce(genre, '') || ' ' ||
    coalesce(summary, '') || ' ' ||
    coalesce(location, '')
  )
);
create index reservations_book_status_idx on public.reservations (book_id, status);
create index reservations_user_status_idx on public.reservations (user_email, status);
create index loans_book_status_idx on public.loans (book_id, status);
create index loans_user_status_idx on public.loans (user_email, status);

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create trigger books_set_updated_at
before update on public.books
for each row execute function public.set_updated_at();

create trigger loans_set_updated_at
before update on public.loans
for each row execute function public.set_updated_at();

create or replace view public.catalog_books as
select
  id,
  title,
  author,
  publisher,
  isbn,
  publication_year,
  language,
  recommended_level,
  topic,
  genre,
  summary,
  location,
  total_copies,
  available_copies,
  active,
  created_at,
  updated_at
from public.books
where active = true;

create or replace function public.register_access(user_email text, user_agent_text text default null)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(user_email));
  user_row public.app_users;
begin
  if normalized_email not like '%@ramonpont.cat' then
    raise exception 'El correu ha de ser del domini @ramonpont.cat';
  end if;

  insert into public.app_users (email, display_name, role)
  values (
    normalized_email,
    initcap(split_part(replace(replace(replace(normalized_email, '.', ' '), '_', ' '), '-', ' '), '@', 1)),
    case when normalized_email = 'biblioteca@ramonpont.cat' then 'gestor'::public.user_role else 'lector'::public.user_role end
  )
  on conflict (email) do update
    set last_seen_at = now(),
        access_count = public.app_users.access_count + 1
  returning * into user_row;

  insert into public.access_logs (user_id, email, role, user_agent)
  values (user_row.id, user_row.email, user_row.role, user_agent_text);

  return user_row;
end;
$$;

create or replace function public.reserve_book(target_book_id uuid, input_user_email text, note text default null)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  user_row public.app_users;
  reservation_row public.reservations;
begin
  user_row := public.register_access(input_user_email, null);

  if exists (
    select 1
    from public.reservations
    where book_id = target_book_id
      and lower(reservations.user_email) = lower(trim(input_user_email))
      and status in ('pendent', 'acceptada')
  ) then
    raise exception 'Aquest usuari ja te una reserva activa per aquest llibre';
  end if;

  insert into public.reservations (book_id, user_id, user_email, notes)
  values (target_book_id, user_row.id, user_row.email, note)
  returning * into reservation_row;

  return reservation_row;
end;
$$;

create or replace function public.register_loan(target_book_id uuid, target_user_email text, manager_email text, target_reservation_id uuid default null, due_date date default null)
returns public.loans
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_row public.app_users;
  user_row public.app_users;
  loan_row public.loans;
  updated_book_id uuid;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'biblioteca@ramonpont.cat' then
    raise exception 'Nomes biblioteca@ramonpont.cat pot registrar prestecs';
  end if;

  manager_row := public.register_access(manager_email, null);
  if manager_row.role not in ('gestor', 'administrador') then
    raise exception 'Nomes un gestor pot registrar prestecs';
  end if;

  select *
  into user_row
  from public.app_users
  where lower(email) = lower(trim(target_user_email));

  if user_row.id is null then
    user_row := public.register_access(target_user_email, null);
  end if;

  update public.books
  set available_copies = available_copies - 1,
      updated_by = manager_row.id
  where id = target_book_id
    and active = true
    and available_copies > 0
  returning id into updated_book_id;

  if updated_book_id is null then
    raise exception 'No hi ha exemplars disponibles';
  end if;

  insert into public.loans (book_id, user_id, reservation_id, user_email, loaned_by, due_at)
  values (updated_book_id, user_row.id, target_reservation_id, user_row.email, manager_row.id, due_date)
  returning * into loan_row;

  if target_reservation_id is not null then
    update public.reservations
    set status = 'convertida',
        resolved_at = now(),
        resolved_by = manager_row.id
    where id = target_reservation_id;
  end if;

  return loan_row;
end;
$$;

create or replace function public.register_return(target_loan_id uuid, manager_email text, condition_note text default null)
returns public.returns
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_row public.app_users;
  loan_row public.loans;
  return_row public.returns;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'biblioteca@ramonpont.cat' then
    raise exception 'Nomes biblioteca@ramonpont.cat pot registrar devolucions';
  end if;

  manager_row := public.register_access(manager_email, null);
  if manager_row.role not in ('gestor', 'administrador') then
    raise exception 'Nomes un gestor pot registrar devolucions';
  end if;

  select *
  into loan_row
  from public.loans
  where id = target_loan_id
    and status = 'actiu'
  for update;

  if loan_row.id is null then
    raise exception 'Aquest prestec no existeix o ja esta retornat';
  end if;

  update public.loans
  set status = 'retornat',
      returned_at = now(),
      returned_by = manager_row.id
  where id = loan_row.id;

  update public.books
  set available_copies = least(total_copies, available_copies + 1),
      updated_by = manager_row.id
  where id = loan_row.book_id;

  insert into public.returns (loan_id, book_id, user_id, user_email, returned_by, condition_notes)
  values (loan_row.id, loan_row.book_id, loan_row.user_id, loan_row.user_email, manager_row.id, condition_note)
  returning * into return_row;

  return return_row;
end;
$$;

revoke execute on function public.register_access(text, text) from public;
revoke execute on function public.reserve_book(uuid, text, text) from public;
revoke execute on function public.register_loan(uuid, text, text, uuid, date) from public;
revoke execute on function public.register_return(uuid, text, text) from public;

grant execute on function public.register_access(text, text) to anon, authenticated;
grant execute on function public.reserve_book(uuid, text, text) to anon, authenticated;
grant execute on function public.register_loan(uuid, text, text, uuid, date) to authenticated;
grant execute on function public.register_return(uuid, text, text) to authenticated;

alter table public.app_users enable row level security;
alter table public.access_logs enable row level security;
alter table public.books enable row level security;
alter table public.reservations enable row level security;
alter table public.loans enable row level security;
alter table public.returns enable row level security;
alter table public.book_options enable row level security;

create policy "Tothom pot consultar el cataleg actiu"
on public.books for select
using (active = true);

create policy "Tothom pot consultar opcions"
on public.book_options for select
using (true);

create policy "Es poden registrar usuaris del centre"
on public.app_users for insert
with check (lower(email) like '%@ramonpont.cat');

create policy "Cada usuari pot consultar el seu registre basic"
on public.app_users for select
using (true);

create policy "Es poden crear reserves"
on public.reservations for insert
with check (lower(user_email) like '%@ramonpont.cat');

create policy "Es poden consultar reserves"
on public.reservations for select
using (true);

create policy "Es poden consultar prestecs"
on public.loans for select
using (true);

create policy "Es poden consultar devolucions"
on public.returns for select
using (true);

-- Quan activem Supabase Auth, aquestes politiques permetran gestio real
-- nomes amb un usuari autenticat amb email biblioteca@ramonpont.cat.
create policy "Gestor autenticat pot gestionar llibres"
on public.books for all
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat')
with check ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot gestionar opcions"
on public.book_options for all
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat')
with check ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot gestionar reserves"
on public.reservations for update
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat')
with check ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot crear prestecs"
on public.loans for insert
with check ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot actualitzar prestecs"
on public.loans for update
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat')
with check ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot crear devolucions"
on public.returns for insert
with check ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

insert into public.book_options (field_name, value) values
  ('recommended_level', '3-5 anys'),
  ('recommended_level', '6-8 anys'),
  ('recommended_level', '9-11 anys'),
  ('recommended_level', '12-14 anys'),
  ('recommended_level', '15-16 anys'),
  ('recommended_level', 'Mestres'),
  ('topic', 'Aventura'),
  ('topic', 'Ciència'),
  ('topic', 'Coneixements'),
  ('topic', 'Convivència'),
  ('topic', 'Emocions'),
  ('topic', 'Fantasia'),
  ('topic', 'Història'),
  ('topic', 'Misteri'),
  ('topic', 'Natura'),
  ('genre', 'Àlbum il·lustrat'),
  ('genre', 'Còmic'),
  ('genre', 'Divulgació'),
  ('genre', 'Narrativa'),
  ('genre', 'Novel·la curta'),
  ('genre', 'Poesia'),
  ('genre', 'Teatre'),
  ('location', 'Biblioteca central'),
  ('location', 'Prestatgeria A1'),
  ('location', 'Prestatgeria A2'),
  ('location', 'Prestatgeria B1'),
  ('location', 'Prestatgeria B2'),
  ('location', 'Prestatgeria C1'),
  ('location', 'Prestatgeria C2'),
  ('location', 'Racó infantil'),
  ('location', 'Zona ESO')
on conflict (field_name, value) do nothing;

insert into public.app_users (email, display_name, role)
values ('biblioteca@ramonpont.cat', 'Biblioteca Escola Ramon Pont', 'gestor')
on conflict (email) do update
set display_name = excluded.display_name,
    role = excluded.role,
    active = true;
