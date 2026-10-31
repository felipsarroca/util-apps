-- La teva veu · esquema per a Neon PostgreSQL (regió UE)
-- Reflecteix el model de src/domain/types.ts. Pensat per a un backend amb autorització pròpia;
-- el navegador no es connecta mai directament amb aquesta base de dades.
-- Les proves del servidor (server/tests) l'executen sencer contra PostgreSQL (PGlite).
-- gen_random_uuid() és nativa des de PostgreSQL 13: no cal cap extensió.

-- ---------- Identitat ----------
create table users (
  id            uuid primary key default gen_random_uuid(),
  google_sub    text unique,                           -- identificador estable de Google; s'omple al primer inici de sessió
  email         text not null check (email ~* '^[^@\s]+@ramonpont\.cat$'),
  display_name  text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index users_email_lower on users (lower(email));

create table user_roles (
  user_id    uuid not null references users(id),
  role       text not null check (role in ('admin', 'teacher', 'direction')),  -- 'direction': Equip Directiu (resultats d'«Et veig»)
  granted_by uuid references users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------- Acadèmic ----------
create table academic_years (
  id         text primary key,                         -- '2026-2027'
  starts_on  date not null,
  ends_on    date not null,
  current    boolean not null default false
);
create unique index one_current_year on academic_years (current) where current;

create table grades (
  id     text primary key,                             -- '3EP' … '4ESO'
  name   text not null,
  stage  text not null check (stage in ('CM', 'CS', 'ESO')),
  sort   int  not null
);

create table class_groups (
  id        uuid primary key default gen_random_uuid(),
  year_id   text not null references academic_years(id),
  grade_id  text not null references grades(id),
  label     text not null,                             -- 'A', 'B'
  unique (year_id, grade_id, label)
);

create table teacher_group_assignments (
  user_id  uuid not null references users(id),
  group_id uuid not null references class_groups(id),
  primary key (user_id, group_id)
);

create table students (
  id            uuid primary key default gen_random_uuid(),
  school_ref    text unique not null,                  -- identificador del cens (no el correu)
  given_name    text not null,
  family_name   text not null,
  school_email  text not null check (school_email ~* '^[^@\s]+@ramonpont\.cat$'),
  user_id       uuid unique references users(id),      -- s'enllaça en el primer inici de sessió verificat
  active        boolean not null default true
);
create unique index students_email_lower on students (lower(school_email));

create table enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id),
  group_id    uuid not null references class_groups(id),
  active      boolean not null default true,
  unique (student_id, group_id)
);

-- ---------- Famílies ----------
create table guardians (
  id        uuid primary key default gen_random_uuid(),
  full_name text not null,
  email     text not null
);

create table student_guardians (
  student_id     uuid not null references students(id),
  guardian_id    uuid not null references guardians(id),
  relationship   text,
  validated_at   timestamptz,                         -- verificació humana obligatòria abans d'enviar
  validated_by   uuid references users(id),
  can_receive    boolean not null default true,       -- restriccions de comunicació registrades
  primary key (student_id, guardian_id)
);

create table contact_imports (
  id          uuid primary key default gen_random_uuid(),
  imported_by uuid not null references users(id),
  imported_at timestamptz not null default now(),
  filename    text,
  row_count   int not null
);

create table import_issues (
  id         uuid primary key default gen_random_uuid(),
  import_id  uuid not null references contact_imports(id),
  row_number int not null,
  issue      text not null,
  resolved   boolean not null default false
);

-- ---------- Matèries ----------
create table subjects (
  id          text primary key,                        -- 'MAT', 'CAT'…  (immutable)
  short_name  text not null,
  long_name   text not null,
  hue         int  not null default 0,
  active      boolean not null default true            -- desactivar, mai esborrar si té respostes
);

create table grade_subjects (
  year_id    text not null references academic_years(id),
  grade_id   text not null references grades(id),
  subject_id text not null references subjects(id),
  sort       int  not null,
  optional   boolean not null default false,
  active     boolean not null default true,
  primary key (year_id, grade_id, subject_id)
);

create table student_subjects (                        -- optatives efectivament cursades
  enrollment_id uuid not null references enrollments(id),
  subject_id    text not null references subjects(id),
  primary key (enrollment_id, subject_id)
);

-- ---------- Qüestionaris versionats ----------
create table answer_scales (
  id        text primary key,
  name      text not null,
  allow_na  boolean not null default false,
  options   jsonb not null                             -- [{value,label,short,emoji}]
);

create table questionnaire_templates (
  id     text primary key,                             -- 'tpl-eso'
  name   text not null,
  stage  text not null check (stage in ('CM', 'CS', 'ESO'))
);

create table template_versions (
  id           text primary key,                       -- 'tpl-eso-v2'
  template_id  text not null references questionnaire_templates(id),
  version      int  not null,
  status       text not null check (status in ('draft', 'published')),
  definition   jsonb not null,                         -- apartats i preguntes (vegeu types.ts)
  change_note  text,
  published_at timestamptz,
  published_by uuid references users(id),
  unique (template_id, version)
);
create unique index one_draft_per_template on template_versions (template_id) where status = 'draft';

-- Una versió publicada és immutable.
create function forbid_published_changes() returns trigger language plpgsql as $$
begin
  if old.status = 'published' then
    raise exception 'La versió % ja està publicada i no es pot modificar', old.id;
  end if;
  return new;
end $$;
create trigger template_versions_immutable before update or delete on template_versions
  for each row execute function forbid_published_changes();

-- ---------- Recollides i respostes ----------
create table campaigns (
  id                  uuid primary key default gen_random_uuid(),
  year_id             text not null references academic_years(id),
  grade_id            text not null references grades(id),
  group_id            uuid references class_groups(id),          -- opcional: tancament per grup
  label               text not null,
  template_version_id text not null references template_versions(id),
  subjects_snapshot   jsonb not null,                            -- matèries congelades en crear-la
  starts_on           date not null,
  ends_on             date not null check (ends_on >= starts_on),
  status              text not null check (status in ('ESBORRANY','PROGRAMADA','OBERTA','TANCADA','EN_REVISIO','INFORMES_GENERATS','VALIDADA','DISTRIBUIDA','ARXIVADA')),
  responsible_id      uuid references users(id),
  created_at          timestamptz not null default now()
);

create table responses (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns(id),
  enrollment_id uuid not null references enrollments(id),
  status        text not null check (status in ('NO_INICIADA','EN_CURS','LLIURADA','VALIDADA','INCIDENCIA')),
  answers       jsonb not null default '{}',
  revision      int  not null default 0,
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  unique (campaign_id, enrollment_id)                            -- un lliurament principal per alumne
);

create table response_revisions (                                -- cada lliurament i cada rectificació
  response_id uuid not null references responses(id),
  revision    int  not null,
  answers     jsonb not null,
  saved_at    timestamptz not null default now(),
  saved_by    uuid not null references users(id),
  reason      text,                                              -- obligatori en rectificacions
  primary key (response_id, revision)
);

-- ---------- Informes ----------
create table generated_reports (
  id                 uuid primary key default gen_random_uuid(),
  response_id        uuid not null references responses(id),
  response_revision  int  not null,
  template_version_id text not null references template_versions(id),
  generator_version  text not null,
  storage_key        text not null,                              -- espai privat, mai URL pública
  sha256             text not null,
  pages              int  not null,
  created_at         timestamptz not null default now(),
  created_by         uuid not null references users(id)
);

-- ---------- Comunicació ----------
create table delivery_batches (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id),
  approved_by uuid not null references users(id),
  approved_at timestamptz not null default now(),
  channel     text not null check (channel in ('attachment', 'private_link'))
);

create table delivery_recipients (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references delivery_batches(id),
  report_id       uuid not null references generated_reports(id),
  guardian_id     uuid not null references guardians(id),
  idempotency_key text unique not null,                          -- campanya·alumne·responsable·versió PDF
  status          text not null check (status in ('pendent','en_curs','enviat','fallit','confirmat')),
  updated_at      timestamptz not null default now()
);

create table delivery_attempts (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references delivery_recipients(id),
  attempted_at timestamptz not null default now(),
  ok           boolean not null,
  error_code   text                                              -- sense dades personals
);

-- ---------- Governança ----------
create table app_settings (
  key   text primary key,
  value jsonb not null
);

create table audit_log (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  actor_id uuid references users(id),
  action   text not null,
  detail   jsonb not null default '{}'
);

-- El registre només creix: ningú, ni tan sols el propietari de la base de dades, no en pot canviar ni esborrar files.
create function forbid_audit_changes() returns trigger language plpgsql as $$
begin
  raise exception 'El registre d''operacions no es pot modificar ni esborrar.';
end $$;
create trigger audit_log_append_only before update or delete on audit_log
  for each row execute function forbid_audit_changes();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function forbid_audit_changes();

-- =====================================================================
-- Et veig: valoració del professorat (pla mestre v2, apartats 5 i 7)
-- =====================================================================

-- Apartats activables: app_settings ('modules', '{"emMiro":true,"etVeig":true}').

create table teaching_assignments (                    -- qui fa cada matèria a cada grup
  group_id   uuid not null references class_groups(id),
  subject_id text not null references subjects(id),
  teacher_id uuid not null references users(id),
  primary key (group_id, subject_id)
);

create table feedback_scales (
  id        text primary key,                          -- 'fb3', 'fb4'
  name      text not null,
  na_label  text not null,
  options   jsonb not null                             -- [{value,label,emoji}]
);

create table feedback_forms (                          -- qüestionari d'una etapa, versionat
  id           text primary key,                       -- 'fb-eso-v1'
  template_id  text not null,                          -- 'fb-eso'
  stage        text not null check (stage in ('CM', 'CS', 'ESO')),
  version      int  not null,
  status       text not null check (status in ('draft', 'published')),
  scale_id     text not null references feedback_scales(id),
  definition   jsonb not null,                         -- {dimensions, items, open} (vegeu types.ts)
  change_note  text,
  published_at timestamptz,
  unique (template_id, version)
);
create unique index one_feedback_draft on feedback_forms (template_id) where status = 'draft';
create trigger feedback_forms_immutable before update or delete on feedback_forms
  for each row execute function forbid_published_changes();

create table feedback_campaigns (
  id           uuid primary key default gen_random_uuid(),
  year_id      text not null references academic_years(id),
  label        text not null,
  stages       text[] not null,
  starts_on    date not null,
  ends_on      date not null check (ends_on >= starts_on),
  status       text not null check (status in ('ESBORRANY','PROGRAMADA','OBERTA','TANCADA','MODERACIO','INFORMES_GENERATS','PUBLICADA','ARXIVADA')),
  form_ids     jsonb not null,                         -- {"CM":"fb-cm-v1", ...}
  -- Congelats en obrir la recollida: canviar les assignacions després no altera qui valora qui.
  assignments  jsonb,                                  -- [{gradeId, group, subjectId, teacherEmail}]
  teacher_ids  uuid[],
  created_at   timestamptz not null default now()
);

-- Esborrany: l'únic lloc on la valoració va lligada a l'alumne. Xifrat per l'API (AES-256-GCM)
-- amb una clau que no és a la base de dades. S'esborra en lliurar.
create table feedback_drafts (
  campaign_id uuid not null references feedback_campaigns(id),
  student_id  uuid not null references students(id),
  teacher_id  uuid not null references users(id),
  payload     bytea not null,
  updated_at  timestamptz not null default now(),
  primary key (campaign_id, student_id, teacher_id)
);

-- Qui ha lliurat qui. Sense cap resposta. S'esborra quan es publiquen els informes
-- (només en queden els recomptes per grup a feedback_participation_counts).
create table feedback_participation (
  campaign_id  uuid not null references feedback_campaigns(id),
  student_id   uuid not null references students(id),
  teacher_id   uuid not null references users(id),
  stage        text not null,
  grade_id     text not null,
  group_label  text not null,
  primary key (campaign_id, student_id, teacher_id)    -- un sol lliurament per alumne i docent
);

create table feedback_participation_counts (
  campaign_id  uuid not null references feedback_campaigns(id),
  grade_id     text not null,
  group_label  text not null,
  students     int  not null,
  participants int  not null,
  primary key (campaign_id, grade_id, group_label)
);

-- Respostes lliurades: CAP clau cap a students ni cap a users-alumne.
-- Identificador aleatori (no seqüencial) i només el dia, mai l'hora.
create table feedback_answers (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references feedback_campaigns(id),
  form_id     text not null references feedback_forms(id),
  teacher_id  uuid not null references users(id),
  stage       text not null,
  grade_id    text not null,
  group_label text not null,
  day         date not null,
  v           text not null                            -- un caràcter per afirmació: '1'-'4', '0' = no ho sé, '-' = buit
);
create index feedback_answers_report on feedback_answers (campaign_id, teacher_id, stage);

create table feedback_comments (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references feedback_campaigns(id),
  teacher_id  uuid not null references users(id),
  stage       text not null,
  question_id text not null,
  original    text not null,
  published   text,                                    -- el que veurà el docent (acceptat o editat)
  status      text not null default 'pendent' check (status in ('pendent','acceptat','editat','descartat')),
  flags       text[] not null default '{}',
  moderated_by uuid references users(id),
  moderated_at timestamptz
);

create table teacher_self_assessments (
  campaign_id  uuid not null references feedback_campaigns(id),
  teacher_id   uuid not null references users(id),
  stage        text not null,
  answers      jsonb not null,
  context      jsonb not null default '{}',            -- {"2ESO-A": ["nova", "diversitat"]}
  updated_at   timestamptz not null default now(),
  submitted_at timestamptz,
  primary key (campaign_id, teacher_id, stage)
);

create table feedback_report_views (                   -- qui consulta o descarrega cada informe
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  campaign_id uuid not null references feedback_campaigns(id),
  teacher_id  uuid not null references users(id),
  viewer_id   uuid not null references users(id),
  action      text not null check (action in ('Consulta', 'Descàrrega'))
);

-- Dades base
insert into grades (id, name, stage, sort) values
  ('3EP','3r de primària','CM',1), ('4EP','4t de primària','CM',2),
  ('5EP','5è de primària','CS',3), ('6EP','6è de primària','CS',4),
  ('1ESO','1r d''ESO','ESO',5), ('2ESO','2n d''ESO','ESO',6),
  ('3ESO','3r d''ESO','ESO',7), ('4ESO','4t d''ESO','ESO',8);
