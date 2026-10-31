-- Migració (novembre de 2026): còpies de seguretat i recordatoris. Ja inclosa a db/schema.sql.
-- S'aplica una sola vegada amb el propietari (scripts/aplica-sql.ts).

-- ---------- Còpies de seguretat i recordatoris ----------

-- Còpia completa de les dades de treball (vegeu server/backups.ts). Sense claus foranes: una còpia no ha
-- d'impedir mai res. Es conserven les dels darrers 30 dies i, com a mínim, les 10 més recents.
create table backups (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  reason      text not null,                           -- 'Diària', 'Abans del curs nou', 'Feta a mà'…
  created_by  uuid,
  year_id     text,
  rows        int  not null,
  bytes       int  not null,
  data        jsonb not null                           -- {"taula": [files]}
);

-- Recordatoris enviats: com a màxim un per persona i recollida.
create table reminders_sent (
  kind         text not null check (kind in ('students', 'teachers')),
  campaign_id  uuid not null,                          -- campaigns (alumnat) o feedback_campaigns (professorat)
  recipient_id uuid not null,                          -- students.id o users.id
  sent_at      timestamptz not null default now(),
  primary key (kind, campaign_id, recipient_id)
);

grant select, insert, update, delete on backups, reminders_sent to latevaveu_app;
grant usage, select on all sequences in schema public to latevaveu_app;
