-- Google autentica la identitat; Pentabilities conserva l'usuari intern i els permisos.
-- Versió canònica aplicada al projecte remot el 2026-08-30.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.app_user_identities (
  id uuid primary key default gen_random_uuid(),
  app_user_id text not null unique references public.app_users(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  provider_email text not null check (btrim(provider_email) <> ''),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  linked_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index app_user_identities_provider_email_idx
  on public.app_user_identities (provider, lower(provider_email));

alter table public.app_user_identities enable row level security;
revoke all on public.app_user_identities from public, anon, authenticated;

-- Els correus actuals només serveixen per preparar la vinculació inicial. Després,
-- provider_email es pot administrar independentment del correu intern d'app_users.
insert into public.app_user_identities (app_user_id, provider_email)
select u.id, lower(btrim(u.email))
from public.app_users u
where btrim(u.email) <> ''
on conflict (app_user_id) do nothing;

create or replace function private.seed_google_identity_for_new_app_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if btrim(new.email) <> '' then
    insert into public.app_user_identities (app_user_id, provider_email)
    values (new.id, lower(btrim(new.email)))
    on conflict (app_user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function private.seed_google_identity_for_new_app_user() from public, anon, authenticated;

create trigger app_users_seed_google_identity
after insert on public.app_users
for each row execute function private.seed_google_identity_for_new_app_user();

-- Impedeix que un compte Google no inclòs a la llista autoritzada arribi a
-- crear un usuari nou a Supabase Auth.
create or replace function private.hook_allow_authorized_google_user(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  login_email text := lower(btrim(coalesce(event #>> '{user,email}', '')));
  login_provider text := lower(btrim(coalesce(event #>> '{user,app_metadata,provider}', '')));
begin
  if login_provider <> 'google' or login_email = '' or not exists (
    select 1
    from public.app_user_identities identity_link
    join public.app_users app_user on app_user.id = identity_link.app_user_id
    where identity_link.provider = 'google'
      and lower(identity_link.provider_email) = login_email
      and app_user.active = true
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Aquest compte de Google no està autoritzat per entrar a Pentabilities.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

revoke execute on function private.hook_allow_authorized_google_user(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.hook_allow_authorized_google_user(jsonb) to supabase_auth_admin;

-- Resol i vincula de manera atòmica l'usuari autenticat amb l'usuari intern.
-- Només es fan servir claims controlats pel proveïdor, mai user_metadata.
create or replace function private.current_app_user()
returns public.app_users
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_auth_user_id uuid := (select auth.uid());
  claims jsonb := (select auth.jwt());
  login_email text := lower(btrim(coalesce(claims ->> 'email', '')));
  login_provider text := lower(btrim(coalesce(claims #>> '{app_metadata,provider}', '')));
  app_user public.app_users;
begin
  if current_auth_user_id is null
    or login_provider <> 'google'
    or not (coalesce(claims #> '{app_metadata,providers}', '[]'::jsonb) ? 'google') then
    raise exception 'Cal iniciar la sessió amb un compte de Google autoritzat.';
  end if;

  select u.* into app_user
  from public.app_user_identities identity_link
  join public.app_users u on u.id = identity_link.app_user_id
  where identity_link.auth_user_id = current_auth_user_id
    and identity_link.provider = 'google'
    and u.active = true
  limit 1;

  if app_user.id is null then
    update public.app_user_identities identity_link
    set auth_user_id = current_auth_user_id,
        linked_at = coalesce(identity_link.linked_at, now()),
        updated_at = now()
    from public.app_users u
    where identity_link.app_user_id = u.id
      and identity_link.provider = 'google'
      and lower(identity_link.provider_email) = login_email
      and identity_link.auth_user_id is null
      and u.active = true
    returning u.* into app_user;
  end if;

  if app_user.id is null then
    raise exception 'Aquest compte de Google no està vinculat a cap usuari actiu de Pentabilities.';
  end if;

  return app_user;
end;
$$;

revoke execute on function private.current_app_user() from public, anon, authenticated;

-- Adaptador transitori: les funcions de negoci existents encara reben p_token.
-- El token es crea i s'elimina dins de la mateixa transacció i mai arriba al client.
create or replace function private.legacy_token_for_current_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_user public.app_users;
  legacy_token uuid;
begin
  app_user := private.current_app_user();
  insert into public.app_tokens (user_id, expires_at)
  values (app_user.id, now() + interval '5 minutes')
  returning token into legacy_token;
  return legacy_token;
end;
$$;

create or replace function private.discard_legacy_token(legacy_token uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.app_tokens where token = legacy_token
$$;

revoke execute on function private.legacy_token_for_current_user() from public, anon, authenticated;
revoke execute on function private.discard_legacy_token(uuid) from public, anon, authenticated;

create or replace function public.app_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  legacy_token uuid := private.legacy_token_for_current_user();
  result jsonb;
begin
  result := public.app_bootstrap(legacy_token) - 'token';
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.teacher_home_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.teacher_home_stats(legacy_token);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.create_cycle(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.create_cycle(legacy_token, p_data) - 'token';
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.create_session(p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.create_session(legacy_token, p_data);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.students_by_class(p_class_group text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.students_by_class(legacy_token, p_class_group);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.session_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.session_by_code(legacy_token, p_code);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.session_details(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.session_details(legacy_token, p_session_id);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.submit_student_evaluations(p_code text, p_ratings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.submit_student_evaluations(legacy_token, p_code, p_ratings);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.submit_teacher_evaluations(p_session_id uuid, p_ratings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.submit_teacher_evaluations(legacy_token, p_session_id, p_ratings);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.open_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.open_session(legacy_token, p_session_id);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.close_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.close_session(legacy_token, p_session_id);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.session_dashboard(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.session_dashboard(legacy_token, p_session_id);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

create or replace function public.cycle_dashboard(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
begin
  result := public.cycle_dashboard(legacy_token, p_cycle_id);
  perform private.discard_legacy_token(legacy_token);
  return result;
end;
$$;

-- Aquestes funcions existeixen al backend desplegat però encara no consten a les
-- migracions locals. Els wrappers només es creen quan la signatura antiga existeix.
do $migration$
begin
  if to_regprocedure('public.update_session(uuid,uuid,jsonb)') is not null then
    execute $function$
      create or replace function public.update_session(p_session_id uuid, p_data jsonb)
      returns jsonb language plpgsql security definer set search_path = '' as $body$
      declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
      begin
        result := public.update_session(legacy_token, p_session_id, p_data);
        perform private.discard_legacy_token(legacy_token);
        return result;
      end $body$
    $function$;
    execute 'revoke execute on function public.update_session(uuid, jsonb) from public, anon';
    execute 'grant execute on function public.update_session(uuid, jsonb) to authenticated';
    execute 'revoke execute on function public.update_session(uuid, uuid, jsonb) from anon, authenticated';
  end if;

  if to_regprocedure('public.duplicate_session(uuid,uuid,text)') is not null then
    execute $function$
      create or replace function public.duplicate_session(p_session_id uuid, p_name text)
      returns jsonb language plpgsql security definer set search_path = '' as $body$
      declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
      begin
        result := public.duplicate_session(legacy_token, p_session_id, p_name);
        perform private.discard_legacy_token(legacy_token);
        return result;
      end $body$
    $function$;
    execute 'revoke execute on function public.duplicate_session(uuid, text) from public, anon';
    execute 'grant execute on function public.duplicate_session(uuid, text) to authenticated';
    execute 'revoke execute on function public.duplicate_session(uuid, uuid, text) from anon, authenticated';
  end if;

  if to_regprocedure('public.delete_session(uuid,uuid)') is not null then
    execute $function$
      create or replace function public.delete_session(p_session_id uuid)
      returns jsonb language plpgsql security definer set search_path = '' as $body$
      declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
      begin
        result := public.delete_session(legacy_token, p_session_id) - 'token';
        perform private.discard_legacy_token(legacy_token);
        return result;
      end $body$
    $function$;
    execute 'revoke execute on function public.delete_session(uuid) from public, anon';
    execute 'grant execute on function public.delete_session(uuid) to authenticated';
    execute 'revoke execute on function public.delete_session(uuid, uuid) from anon, authenticated';
  end if;

  if to_regprocedure('public.lock_session(uuid,uuid)') is not null then
    execute $function$
      create or replace function public.lock_session(p_session_id uuid)
      returns jsonb language plpgsql security definer set search_path = '' as $body$
      declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
      begin
        result := public.lock_session(legacy_token, p_session_id);
        perform private.discard_legacy_token(legacy_token);
        return result;
      end $body$
    $function$;
    execute 'revoke execute on function public.lock_session(uuid) from public, anon';
    execute 'grant execute on function public.lock_session(uuid) to authenticated';
    execute 'revoke execute on function public.lock_session(uuid, uuid) from anon, authenticated';
  end if;

  if to_regprocedure('public.unlock_session(uuid,uuid)') is not null then
    execute $function$
      create or replace function public.unlock_session(p_session_id uuid)
      returns jsonb language plpgsql security definer set search_path = '' as $body$
      declare legacy_token uuid := private.legacy_token_for_current_user(); result jsonb;
      begin
        result := public.unlock_session(legacy_token, p_session_id);
        perform private.discard_legacy_token(legacy_token);
        return result;
      end $body$
    $function$;
    execute 'revoke execute on function public.unlock_session(uuid) from public, anon';
    execute 'grant execute on function public.unlock_session(uuid) to authenticated';
    execute 'revoke execute on function public.unlock_session(uuid, uuid) from anon, authenticated';
  end if;
end
$migration$;

-- Les signatures antigues ja no són punts d'entrada públics.
revoke execute on function public.app_login(text, text) from anon, authenticated;
revoke execute on function public.app_bootstrap(uuid) from anon, authenticated;
revoke execute on function public.teacher_home_stats(uuid) from anon, authenticated;
revoke execute on function public.create_cycle(uuid, jsonb) from anon, authenticated;
revoke execute on function public.create_session(uuid, jsonb) from anon, authenticated;
revoke execute on function public.students_by_class(uuid, text) from anon, authenticated;
revoke execute on function public.session_by_code(uuid, text) from anon, authenticated;
revoke execute on function public.session_details(uuid, uuid) from anon, authenticated;
revoke execute on function public.submit_student_evaluations(uuid, text, jsonb) from anon, authenticated;
revoke execute on function public.submit_teacher_evaluations(uuid, uuid, jsonb) from anon, authenticated;
revoke execute on function public.open_session(uuid, uuid) from anon, authenticated;
revoke execute on function public.close_session(uuid, uuid) from anon, authenticated;
revoke execute on function public.session_dashboard(uuid, uuid) from anon, authenticated;
revoke execute on function public.cycle_dashboard(uuid, uuid) from anon, authenticated;

revoke execute on function public.app_bootstrap() from public, anon;
revoke execute on function public.teacher_home_stats() from public, anon;
revoke execute on function public.create_cycle(jsonb) from public, anon;
revoke execute on function public.create_session(jsonb) from public, anon;
revoke execute on function public.students_by_class(text) from public, anon;
revoke execute on function public.session_by_code(text) from public, anon;
revoke execute on function public.session_details(uuid) from public, anon;
revoke execute on function public.submit_student_evaluations(text, jsonb) from public, anon;
revoke execute on function public.submit_teacher_evaluations(uuid, jsonb) from public, anon;
revoke execute on function public.open_session(uuid) from public, anon;
revoke execute on function public.close_session(uuid) from public, anon;
revoke execute on function public.session_dashboard(uuid) from public, anon;
revoke execute on function public.cycle_dashboard(uuid) from public, anon;

grant execute on function public.app_bootstrap() to authenticated;
grant execute on function public.teacher_home_stats() to authenticated;
grant execute on function public.create_cycle(jsonb) to authenticated;
grant execute on function public.create_session(jsonb) to authenticated;
grant execute on function public.students_by_class(text) to authenticated;
grant execute on function public.session_by_code(text) to authenticated;
grant execute on function public.session_details(uuid) to authenticated;
grant execute on function public.submit_student_evaluations(text, jsonb) to authenticated;
grant execute on function public.submit_teacher_evaluations(uuid, jsonb) to authenticated;
grant execute on function public.open_session(uuid) to authenticated;
grant execute on function public.close_session(uuid) to authenticated;
grant execute on function public.session_dashboard(uuid) to authenticated;
grant execute on function public.cycle_dashboard(uuid) to authenticated;
