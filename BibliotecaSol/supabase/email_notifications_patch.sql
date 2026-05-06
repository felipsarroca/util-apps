create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_type text not null,
  recipient_email text not null,
  reservation_id uuid references public.reservations(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete cascade,
  subject text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (notification_type, recipient_email, reservation_id),
  unique (notification_type, recipient_email, loan_id)
);

create index if not exists email_notifications_status_idx
on public.email_notifications (status, created_at);

alter table public.email_notifications enable row level security;

drop policy if exists "Gestor autenticat pot consultar notificacions" on public.email_notifications;
create policy "Gestor autenticat pot consultar notificacions"
on public.email_notifications for select
using ((auth.jwt() ->> 'email') = 'biblioteca@ramonpont.cat');
