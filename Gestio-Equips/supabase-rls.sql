-- Politiques de seguretat per a l'app Gestio-Equips.
-- Executa aquest fitxer al SQL Editor de Supabase despres de crear els usuaris d'Auth.
--
-- Rols esperats a Supabase Auth:
-- - app_metadata.role = 'consulta'
-- - app_metadata.role = 'edicio'

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'app_metadata' ->> 'access_role'
  );
$$;

create or replace function public.can_read_gestio_equips()
returns boolean
language sql
stable
as $$
  select public.current_app_role() in ('consulta', 'edicio');
$$;

create or replace function public.can_write_gestio_equips()
returns boolean
language sql
stable
as $$
  select public.current_app_role() = 'edicio';
$$;

alter table public.usuaris enable row level security;
alter table public.ordinadors enable row level security;
alter table public.assignacions enable row level security;
alter table public.esdeveniments enable row level security;

revoke all on public.usuaris from anon;
revoke all on public.ordinadors from anon;
revoke all on public.assignacions from anon;
revoke all on public.esdeveniments from anon;

grant usage on schema public to authenticated;
grant select, insert, update on public.usuaris to authenticated;
grant select, insert, update on public.ordinadors to authenticated;
grant select, insert, update on public.assignacions to authenticated;
grant select, insert, update, delete on public.esdeveniments to authenticated;

drop policy if exists "gestio_equips_select_usuaris" on public.usuaris;
drop policy if exists "gestio_equips_insert_usuaris" on public.usuaris;
drop policy if exists "gestio_equips_update_usuaris" on public.usuaris;

drop policy if exists "gestio_equips_select_ordinadors" on public.ordinadors;
drop policy if exists "gestio_equips_insert_ordinadors" on public.ordinadors;
drop policy if exists "gestio_equips_update_ordinadors" on public.ordinadors;

drop policy if exists "gestio_equips_select_assignacions" on public.assignacions;
drop policy if exists "gestio_equips_insert_assignacions" on public.assignacions;
drop policy if exists "gestio_equips_update_assignacions" on public.assignacions;

drop policy if exists "gestio_equips_select_esdeveniments" on public.esdeveniments;
drop policy if exists "gestio_equips_insert_esdeveniments" on public.esdeveniments;
drop policy if exists "gestio_equips_update_esdeveniments" on public.esdeveniments;
drop policy if exists "gestio_equips_delete_esdeveniments" on public.esdeveniments;

create policy "gestio_equips_select_usuaris"
on public.usuaris
for select
to authenticated
using (public.can_read_gestio_equips());

create policy "gestio_equips_insert_usuaris"
on public.usuaris
for insert
to authenticated
with check (public.can_write_gestio_equips());

create policy "gestio_equips_update_usuaris"
on public.usuaris
for update
to authenticated
using (public.can_write_gestio_equips())
with check (public.can_write_gestio_equips());

create policy "gestio_equips_select_ordinadors"
on public.ordinadors
for select
to authenticated
using (public.can_read_gestio_equips());

create policy "gestio_equips_insert_ordinadors"
on public.ordinadors
for insert
to authenticated
with check (public.can_write_gestio_equips());

create policy "gestio_equips_update_ordinadors"
on public.ordinadors
for update
to authenticated
using (public.can_write_gestio_equips())
with check (public.can_write_gestio_equips());

create policy "gestio_equips_select_assignacions"
on public.assignacions
for select
to authenticated
using (public.can_read_gestio_equips());

create policy "gestio_equips_insert_assignacions"
on public.assignacions
for insert
to authenticated
with check (public.can_write_gestio_equips());

create policy "gestio_equips_update_assignacions"
on public.assignacions
for update
to authenticated
using (public.can_write_gestio_equips())
with check (public.can_write_gestio_equips());

create policy "gestio_equips_select_esdeveniments"
on public.esdeveniments
for select
to authenticated
using (public.can_read_gestio_equips());

create policy "gestio_equips_insert_esdeveniments"
on public.esdeveniments
for insert
to authenticated
with check (public.can_write_gestio_equips());

create policy "gestio_equips_update_esdeveniments"
on public.esdeveniments
for update
to authenticated
using (public.can_write_gestio_equips())
with check (public.can_write_gestio_equips());

create policy "gestio_equips_delete_esdeveniments"
on public.esdeveniments
for delete
to authenticated
using (public.can_write_gestio_equips());
