-- Auth, safety, audit, and editorial CMS. Additive. Does not drop community data.

alter table public.profiles
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text,
  add column if not exists suspension_ends_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists warned_at timestamptz;

alter table public.places
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists google_maps_url text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_by uuid references public.profiles (id);

alter table public.reports
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_to uuid references public.profiles (id),
  add column if not exists reviewed_at timestamptz;

alter table public.reports
  drop constraint if exists reports_priority_check;
alter table public.reports
  add constraint reports_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));

create index if not exists reports_status_priority_idx
  on public.reports (status, priority, created_at desc);
create index if not exists reports_target_idx
  on public.reports (target_type, target_id, created_at desc);
create index if not exists reports_reporter_target_idx
  on public.reports (reporter_id, target_type, target_id, created_at desc);

create table if not exists public.auth_lockouts (
  email_normalized text primary key,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.auth_lockouts enable row level security;

create table if not exists public.user_hidden_posts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.experience_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.user_hidden_posts enable row level security;

create policy user_hidden_posts_own on public.user_hidden_posts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.place_media (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists place_media_place_idx on public.place_media (place_id, sort_order);
alter table public.place_media enable row level security;

create policy place_media_read on public.place_media
  for select using (true);
create policy place_media_staff_write on public.place_media
  for all using (public.is_staff()) with check (public.is_staff());

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  ip text,
  user_agent text,
  correlation_id text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_target_idx on public.audit_logs (target_type, target_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action, created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_admin_read on public.audit_logs
  for select using (public.is_admin());

create policy audit_logs_staff_insert on public.audit_logs
  for insert with check (public.is_staff() and actor_id = auth.uid());

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

create table if not exists public.editorial_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  kind text not null,
  status text not null default 'draft',
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_collections_kind_check check (kind in ('place', 'post', 'mood', 'home', 'explore')),
  constraint editorial_collections_status_check check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.editorial_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.editorial_collections (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  sort_order integer not null default 0,
  unique (collection_id, target_type, target_id)
);

create table if not exists public.featured_placements (
  id uuid primary key default gen_random_uuid(),
  surface text not null,
  target_type text not null,
  target_id uuid not null,
  sort_order integer not null default 0,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_surface_check check (surface in ('home', 'explore')),
  constraint featured_status_check check (status in ('draft', 'published', 'archived'))
);

create unique index if not exists featured_placements_live_uidx
  on public.featured_placements (surface, target_type, target_id)
  where status = 'published';

alter table public.editorial_collections enable row level security;
alter table public.editorial_collection_items enable row level security;
alter table public.featured_placements enable row level security;

create policy editorial_collections_public_read on public.editorial_collections
  for select using (status = 'published' or public.is_staff());
create policy editorial_collections_staff_write on public.editorial_collections
  for all using (public.is_staff()) with check (public.is_staff());

create policy editorial_items_public_read on public.editorial_collection_items
  for select using (
    exists (
      select 1 from public.editorial_collections c
      where c.id = collection_id and (c.status = 'published' or public.is_staff())
    )
  );
create policy editorial_items_staff_write on public.editorial_collection_items
  for all using (public.is_staff()) with check (public.is_staff());

create policy featured_public_read on public.featured_placements
  for select using (status = 'published' or public.is_staff());
create policy featured_staff_write on public.featured_placements
  for all using (public.is_staff()) with check (public.is_staff());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('owner', 'admin')
      and deleted_at is null
      and banned_at is null
      and (suspended_at is null or (suspension_ends_at is not null and suspension_ends_at <= now()))
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('owner', 'admin', 'editor', 'moderator')
      and deleted_at is null
      and banned_at is null
      and (suspended_at is null or (suspension_ends_at is not null and suspension_ends_at <= now()))
  );
$$;

grant select, insert on public.audit_logs to authenticated;
grant select, insert, update, delete on public.user_hidden_posts to authenticated;
grant select on public.place_media to authenticated, anon;
grant insert, update, delete on public.place_media to authenticated;
grant select on public.editorial_collections to authenticated, anon;
grant select, insert, update, delete on public.editorial_collections to authenticated;
grant select on public.editorial_collection_items to authenticated, anon;
grant select, insert, update, delete on public.editorial_collection_items to authenticated;
grant select on public.featured_placements to authenticated, anon;
grant select, insert, update, delete on public.featured_placements to authenticated;
