create table if not exists usuaris (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  cognoms text default '',
  nom_complet text generated always as (trim(nom || ' ' || cognoms)) stored,
  tipus_usuari text not null check (tipus_usuari in ('alumne', 'generic')),
  actiu boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ordinadors (
  id uuid primary key default gen_random_uuid(),
  codi_rppo text not null unique,
  estat_actual text not null check (
    estat_actual in (
      'lliure',
      'assignat',
      'incidencia_menor',
      'pendent_reparacio_interna',
      'pendent_servei_tecnic_extern',
      'fora_servei'
    )
  ),
  usuari_actual_id uuid references usuaris(id) on delete set null,
  observacions_generals text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assignacions (
  id uuid primary key default gen_random_uuid(),
  ordinador_id uuid not null references ordinadors(id) on delete cascade,
  usuari_id uuid not null references usuaris(id) on delete restrict,
  data_inici date not null,
  data_final date,
  curs_academic text not null,
  motiu text default '',
  created_at timestamptz not null default now()
);

create table if not exists esdeveniments (
  id uuid primary key default gen_random_uuid(),
  ordinador_id uuid not null references ordinadors(id) on delete cascade,
  usuari_id uuid references usuaris(id) on delete set null,
  tipus text not null check (
    tipus in (
      'assignacio',
      'retorn',
      'canvi_propietari',
      'incidencia',
      'reparacio_interna',
      'servei_tecnic_extern',
      'reparat',
      'observacio'
    )
  ),
  data_event date not null,
  descripcio text not null,
  estat_resultant text check (
    estat_resultant in (
      'lliure',
      'assignat',
      'incidencia_menor',
      'pendent_reparacio_interna',
      'pendent_servei_tecnic_extern',
      'fora_servei'
    )
  ),
  curs_academic text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ordinadors_codi_rppo on ordinadors(codi_rppo);
create index if not exists idx_assignacions_ordinador on assignacions(ordinador_id);
create index if not exists idx_assignacions_usuari on assignacions(usuari_id);
create index if not exists idx_esdeveniments_ordinador_data on esdeveniments(ordinador_id, data_event desc);
create index if not exists idx_esdeveniments_usuari on esdeveniments(usuari_id);
