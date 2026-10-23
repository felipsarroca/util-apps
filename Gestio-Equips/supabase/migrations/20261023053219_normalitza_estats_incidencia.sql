-- Tanca els estats d'incidència antics: els equips passen a lliure o assignat segons si tenen usuari.
-- Les incidències continuen constant a l'historial d'esdeveniments.
-- Aplicada al projecte de Supabase el 23/10/2026 (13 equips, tots amb usuari: passen a assignat).

update public.ordinadors
set estat_actual = case when usuari_actual_id is null then 'lliure' else 'assignat' end
where estat_actual in ('incidencia_menor', 'pendent_reparacio_interna');
