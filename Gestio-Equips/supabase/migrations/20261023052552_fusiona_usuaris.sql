-- Permet esborrar usuaris de l'ordinador creats per error i fusionar duplicats.
-- - Sense p_desti: només esborra l'usuari si no té cap equip, assignació ni esdeveniment.
-- - Amb p_desti: passa tot l'historial de p_origen a p_desti i després esborra p_origen.
-- Només hi poden accedir els comptes amb rol d'edició.
-- Aplicada al projecte de Supabase el 23/10/2026.

create or replace function public.elimina_usuari(p_origen uuid, p_desti uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_write_gestio_equips() then
    raise exception 'Cal un compte amb permís d''edició.';
  end if;

  if not exists (select 1 from usuaris where id = p_origen) then
    raise exception 'L''usuari que vols esborrar no existeix.';
  end if;

  if p_desti is null then
    if exists (select 1 from assignacions where usuari_id = p_origen)
      or exists (select 1 from esdeveniments where usuari_id = p_origen)
      or exists (select 1 from ordinadors where usuari_actual_id = p_origen) then
      raise exception 'Aquest usuari té historial. Fusiona''l amb un altre usuari o marca''l com a inactiu.';
    end if;
  else
    if p_desti = p_origen then
      raise exception 'Tria un usuari diferent per fusionar.';
    end if;
    if not exists (select 1 from usuaris where id = p_desti) then
      raise exception 'L''usuari de destinació no existeix.';
    end if;

    update assignacions set usuari_id = p_desti where usuari_id = p_origen;
    update esdeveniments set usuari_id = p_desti where usuari_id = p_origen;
    update ordinadors set usuari_actual_id = p_desti where usuari_actual_id = p_origen;
    update usuaris set actiu = true
    where id = p_desti and exists (select 1 from ordinadors where usuari_actual_id = p_desti);
  end if;

  delete from usuaris where id = p_origen;
end;
$$;

revoke all on function public.elimina_usuari(uuid, uuid) from public, anon;
grant execute on function public.elimina_usuari(uuid, uuid) to authenticated;
