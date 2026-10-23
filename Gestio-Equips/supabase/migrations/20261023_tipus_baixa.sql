-- Afegeix el tipus d'esdeveniment 'baixa'.
-- Abans les baixes es desaven com a 'observacio' amb estat_resultant = 'fora_servei'.
-- Només canvia el tipus d'aquests registres: la data, el text i l'usuari es mantenen.
-- Aplicada al projecte de Supabase el 23/10/2026.

alter table public.esdeveniments drop constraint esdeveniments_tipus_check;

alter table public.esdeveniments
  add constraint esdeveniments_tipus_check
  check (tipus = any (array[
    'assignacio', 'retorn', 'canvi_propietari', 'incidencia',
    'reparacio_interna', 'servei_tecnic_extern', 'reparat', 'observacio', 'baixa'
  ]));

update public.esdeveniments
set tipus = 'baixa'
where tipus = 'observacio'
  and estat_resultant = 'fora_servei';
