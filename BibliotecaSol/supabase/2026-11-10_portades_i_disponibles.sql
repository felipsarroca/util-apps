-- Biblioteca de la Sol · 2026-11-10
-- 1. Portada de cada llibre (cover_url).
-- 2. Els exemplars disponibles es calculen sols quan canvia el total d'exemplars.
-- 3. Missatges d'error de les funcions en català correcte.

alter table public.books add column if not exists cover_url text;

create or replace view public.catalog_books as
select id, title, author, publisher, isbn, publication_year, language, recommended_level,
       topic, genre, summary, location, total_copies, available_copies, active,
       created_at, updated_at, collection, collection_number, page_count, cover_url
from public.books
where active = true;

create or replace function public.books_sync_available_copies()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.available_copies := new.total_copies;
  elsif new.total_copies is distinct from old.total_copies then
    new.available_copies := greatest(0, new.total_copies - (
      select count(*) from public.loans where book_id = new.id and status = 'actiu'
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists books_sync_available_copies on public.books;
create trigger books_sync_available_copies
before insert or update of total_copies on public.books
for each row execute function public.books_sync_available_copies();

CREATE OR REPLACE FUNCTION public.register_loan(target_book_id uuid, target_user_email text, manager_email text, target_reservation_id uuid DEFAULT NULL::uuid, due_date date DEFAULT NULL::date)
 RETURNS loans
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  manager_row public.app_users;
  user_row public.app_users;
  loan_row public.loans;
  updated_book_id uuid;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'biblioteca@ramonpont.cat' then
    raise exception 'Només biblioteca@ramonpont.cat pot registrar préstecs.';
  end if;

  manager_row := public.register_access(manager_email, null);
  if manager_row.role not in ('gestor', 'administrador') then
    raise exception 'Només un gestor pot registrar préstecs.';
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
    raise exception 'No queda cap exemplar disponible d''aquest llibre.';
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
$function$
;

CREATE OR REPLACE FUNCTION public.register_return(target_loan_id uuid, manager_email text, condition_note text DEFAULT NULL::text)
 RETURNS returns
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  manager_row public.app_users;
  loan_row public.loans;
  return_row public.returns;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'biblioteca@ramonpont.cat' then
    raise exception 'Només biblioteca@ramonpont.cat pot registrar devolucions.';
  end if;

  manager_row := public.register_access(manager_email, null);
  if manager_row.role not in ('gestor', 'administrador') then
    raise exception 'Només un gestor pot registrar devolucions.';
  end if;

  select *
  into loan_row
  from public.loans
  where id = target_loan_id
    and status = 'actiu'
  for update;

  if loan_row.id is null then
    raise exception 'Aquest préstec no existeix o ja s''ha retornat.';
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
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_book(target_book_id uuid, input_user_email text, note text DEFAULT NULL::text)
 RETURNS reservations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Ja tens una sol·licitud activa d''aquest llibre.';
  end if;

  insert into public.reservations (book_id, user_id, user_email, notes)
  values (target_book_id, user_row.id, user_row.email, note)
  returning * into reservation_row;

  return reservation_row;
end;
$function$
;
