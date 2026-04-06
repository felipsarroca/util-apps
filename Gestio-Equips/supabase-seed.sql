insert into usuaris (id, nom, cognoms, tipus_usuari)
values
  ('11111111-1111-1111-1111-111111111111', 'Amina', 'El Idrissi', 'alumne'),
  ('22222222-2222-2222-2222-222222222222', 'Youssef', 'Bakkali', 'alumne'),
  ('33333333-3333-3333-3333-333333333333', 'PFI', '', 'generic')
on conflict (id) do nothing;

insert into ordinadors (id, codi_rppo, estat_actual, usuari_actual_id, observacions_generals)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'RPPO 14',
    'assignat',
    '11111111-1111-1111-1111-111111111111',
    'Carregador revisat el març.'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'RPPO 21',
    'lliure',
    null,
    ''
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'RPPO 32',
    'pendent_servei_tecnic_extern',
    null,
    'Pantalla amb ratlles verticals.'
  )
on conflict (id) do nothing;

insert into assignacions (
  id,
  ordinador_id,
  usuari_id,
  data_inici,
  data_final,
  curs_academic,
  motiu
)
values
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    '2026-03-12',
    null,
    '2025-2026',
    'Assignació inicial'
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    '2026-03-01',
    '2026-04-03',
    '2025-2026',
    'Tancada per incidència i enviament a servei tècnic'
  )
on conflict (id) do nothing;

insert into esdeveniments (
  id,
  ordinador_id,
  usuari_id,
  tipus,
  data_event,
  descripcio,
  estat_resultant,
  curs_academic
)
values
  (
    'f1111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'assignacio',
    '2026-03-12',
    'Assignat a l''alumna a inici de trimestre.',
    'assignat',
    '2025-2026'
  ),
  (
    'f2222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'observacio',
    '2026-03-25',
    'Bateria correcta. Es recomana portar funda.',
    'assignat',
    '2025-2026'
  ),
  (
    'f3333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'incidencia',
    '2026-04-01',
    'La pantalla falla de manera intermitent.',
    'incidencia_menor',
    '2025-2026'
  ),
  (
    'f4444444-4444-4444-4444-444444444444',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    null,
    'servei_tecnic_extern',
    '2026-04-03',
    'Enviat al servei tècnic extern.',
    'pendent_servei_tecnic_extern',
    '2025-2026'
  )
on conflict (id) do nothing;
