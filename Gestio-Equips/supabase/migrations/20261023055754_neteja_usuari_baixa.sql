-- Elimina l'usuari fictici «BAIXA», creat en importar el full 2025-26 perquè la columna d'usuari
-- de RPPO132 i RPPO136 contenia «BAIXA». S'esborren les assignacions i els esdeveniments
-- «Assignat a BAIXA»; l'observació i la baixa definitiva dels equips es conserven sense usuari.
-- Aplicada al projecte de Supabase el 23/10/2026.

do $$
declare
  v_baixa uuid := (select id from public.usuaris where nom = 'BAIXA' and coalesce(cognoms, '') = '');
begin
  if v_baixa is null then
    return;
  end if;

  delete from public.esdeveniments
  where usuari_id = v_baixa and tipus = 'assignacio' and descripcio = 'Assignat a BAIXA';

  delete from public.assignacions where usuari_id = v_baixa;

  update public.esdeveniments set usuari_id = null where usuari_id = v_baixa;
  update public.ordinadors set usuari_actual_id = null where usuari_actual_id = v_baixa;

  delete from public.usuaris where id = v_baixa;
end;
$$;
