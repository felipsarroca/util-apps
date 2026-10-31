-- Permisos de l'usuari de l'aplicació (servidor). S'aplica després de db/schema.sql.
--
-- El servidor no es connecta amb el propietari (latevaveu_owner) sinó amb latevaveu_app, que:
--   · pot llegir i escriure les dades de treball;
--   · al registre d'operacions (audit_log) només hi pot afegir files: no en pot modificar ni esborrar cap;
--   · no pot crear, modificar ni esborrar taules.
-- A més, l'activador audit_log_append_only de l'esquema impedeix canviar el registre a qualsevol usuari.
--
-- El rol es crea a Neon (la contrasenya no s'escriu mai en cap fitxer):
--   npx neonctl roles create --name latevaveu_app --branch <branca> --project-id <projecte>
-- i després s'aplica aquest fitxer amb el propietari (scripts/aplica-sql.ts).

revoke all on schema public from public;
grant usage on schema public to latevaveu_app;

grant select, insert, update, delete on all tables in schema public to latevaveu_app;
revoke update, delete, truncate on audit_log from latevaveu_app;
grant usage, select on all sequences in schema public to latevaveu_app;
grant execute on all functions in schema public to latevaveu_app;
