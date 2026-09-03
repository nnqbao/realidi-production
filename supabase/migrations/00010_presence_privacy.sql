-- Platform presence privacy. last_seen_at remains the last-active fallback.

alter table public.profiles
  add column if not exists last_active_at timestamptz,
  add column if not exists show_activity_status boolean not null default true;

update public.profiles
set last_active_at = coalesce(last_active_at, last_seen_at)
where last_active_at is null and last_seen_at is not null;

comment on column public.profiles.show_activity_status is
  'When false, other users must not see online/idle/last-active.';

comment on column public.profiles.last_active_at is
  'Coarse last activity for social fallback. Not for surveillance.';
