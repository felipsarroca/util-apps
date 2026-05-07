-- Programa l'execucio diaria dels avisos de prestecs.
-- Substitueix els valors de PROJECT_URL i ANON_KEY abans d'executar-ho.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_project_url uuid;
  existing_anon_key uuid;
begin
  select id into existing_project_url
  from vault.secrets
  where name = 'biblioteca_sol_project_url';

  if existing_project_url is null then
    perform vault.create_secret('PROJECT_URL', 'biblioteca_sol_project_url');
  else
    perform vault.update_secret(existing_project_url, 'PROJECT_URL', 'biblioteca_sol_project_url');
  end if;

  select id into existing_anon_key
  from vault.secrets
  where name = 'biblioteca_sol_anon_key';

  if existing_anon_key is null then
    perform vault.create_secret('ANON_KEY', 'biblioteca_sol_anon_key');
  else
    perform vault.update_secret(existing_anon_key, 'ANON_KEY', 'biblioteca_sol_anon_key');
  end if;
end $$;

select cron.unschedule('biblioteca-sol-daily-loan-reminders')
where exists (
  select 1
  from cron.job
  where jobname = 'biblioteca-sol-daily-loan-reminders'
);

select cron.schedule(
  'biblioteca-sol-daily-loan-reminders',
  '30 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'biblioteca_sol_project_url') || '/functions/v1/daily-loan-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'biblioteca_sol_anon_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'biblioteca_sol_anon_key')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now())
  );
  $$
);
