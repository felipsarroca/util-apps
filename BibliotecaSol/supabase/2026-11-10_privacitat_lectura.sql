-- Biblioteca de la Sol · 2026-11-10
-- Privacitat: només el gestor autenticat pot llegir usuaris, sol·licituds, préstecs i devolucions.
-- Els lectors continuen creant sol·licituds amb la funció reserve_book (security definer).

drop policy if exists "Cada usuari pot consultar el seu registre basic" on public.app_users;
drop policy if exists "Es poden consultar reserves" on public.reservations;
drop policy if exists "Es poden consultar prestecs" on public.loans;
drop policy if exists "Es poden consultar devolucions" on public.returns;

create policy "Gestor autenticat pot consultar usuaris"
on public.app_users for select
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot consultar reserves"
on public.reservations for select
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot consultar prestecs"
on public.loans for select
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');

create policy "Gestor autenticat pot consultar devolucions"
on public.returns for select
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');
