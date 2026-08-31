create or replace function public.sync_roster_from_sheets(p_secret text, p_users jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_secret text;
  item jsonb;
  synced_count integer := 0;
  next_id text;
  next_email text;
  existing_id text;
begin
  select value into expected_secret from public.app_settings where key = 'roster_sync_secret';
  if expected_secret is null or p_secret <> expected_secret then
    raise exception 'Secret de sincronització incorrecte.';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p_users, '[]'::jsonb)) loop
    next_id := item->>'id';
    next_email := nullif(lower(btrim(coalesce(item->>'email', ''))), '');
    existing_id := null;

    if next_email is not null then
      select id into existing_id
      from public.app_users
      where lower(email) = next_email
      limit 1;
    end if;

    if existing_id is not null and existing_id <> next_id then
      update public.app_users
      set
        email = next_email,
        first_name = coalesce(item->>'firstName', ''),
        last_name = coalesce(item->>'lastName', ''),
        full_name = coalesce(item->>'name', ''),
        role = item->>'role',
        class_group = nullif(item->>'classGroup', ''),
        active = coalesce((item->>'active')::boolean, true),
        source = 'sheets',
        updated_at = now()
      where id = existing_id;
    else
      insert into public.app_users (id, email, first_name, last_name, full_name, role, class_group, active, source, updated_at)
      values (
        next_id,
        next_email,
        coalesce(item->>'firstName', ''),
        coalesce(item->>'lastName', ''),
        coalesce(item->>'name', ''),
        item->>'role',
        nullif(item->>'classGroup', ''),
        coalesce((item->>'active')::boolean, true),
        'sheets',
        now()
      )
      on conflict (id) do update set
        email = excluded.email,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        full_name = excluded.full_name,
        role = excluded.role,
        class_group = excluded.class_group,
        active = excluded.active,
        source = excluded.source,
        updated_at = now();
    end if;

    synced_count := synced_count + 1;
  end loop;
  return jsonb_build_object('synced', synced_count);
end;
$$;

grant execute on function public.sync_roster_from_sheets(text, jsonb) to anon;;
