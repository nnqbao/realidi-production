-- Social-first extension. Preserve existing tables; do not rebuild.

create type public.post_type as enum ('experience', 'check_in', 'photo', 'video');
create type public.post_visibility as enum ('public', 'followers', 'private');
create type public.notification_type as enum (
  'new_follower',
  'post_like',
  'post_comment',
  'comment_reply',
  'post_saved',
  'verified_visit',
  'system'
);

-- Posts can exist without a place (photo/video first; place is context).
alter table public.experience_posts
  alter column place_id drop not null;

alter table public.experience_posts
  add column if not exists post_type public.post_type not null default 'experience',
  add column if not exists visibility public.post_visibility not null default 'public',
  add column if not exists save_count integer not null default 0;

create index if not exists experience_posts_feed_idx
  on public.experience_posts (status, visibility, published_at desc)
  where deleted_at is null and moderation_status <> 'hidden';

create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.experience_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists saved_posts_user_idx on public.saved_posts (user_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type public.notification_type not null,
  post_id uuid references public.experience_posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  read_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.profiles
  add column if not exists suspended_at timestamptz;

create table if not exists public.feed_ranking_config (
  id text primary key default 'default',
  social_affinity_weight numeric not null default 0.30,
  content_relevance_weight numeric not null default 0.20,
  recency_weight numeric not null default 0.15,
  verified_weight numeric not null default 0.15,
  quality_engagement_weight numeric not null default 0.10,
  mood_context_weight numeric not null default 0.05,
  location_weight numeric not null default 0.05,
  save_weight numeric not null default 4,
  comment_weight numeric not null default 3,
  share_weight numeric not null default 2,
  like_weight numeric not null default 1,
  recency_half_life_hours numeric not null default 36,
  updated_at timestamptz not null default now(),
  constraint feed_weights_sum check (
    abs(
      (social_affinity_weight + content_relevance_weight + recency_weight + verified_weight
        + quality_engagement_weight + mood_context_weight + location_weight)
      - 1
    ) < 0.001
  )
);

insert into public.feed_ranking_config (id) values ('default') on conflict do nothing;

create or replace function public.tg_save_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.experience_posts set save_count = save_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.experience_posts set save_count = greatest(save_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists saved_posts_count on public.saved_posts;
create trigger saved_posts_count after insert or delete on public.saved_posts
  for each row execute function public.tg_save_count();

alter table public.saved_posts enable row level security;
alter table public.notifications enable row level security;
alter table public.feed_ranking_config enable row level security;

create policy saved_posts_own on public.saved_posts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_own on public.notifications
  for select using (user_id = auth.uid());
create policy notifications_own_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_insert_actor on public.notifications
  for insert with check (actor_id = auth.uid());

create policy feed_ranking_read on public.feed_ranking_config for select using (true);
create policy feed_ranking_admin on public.feed_ranking_config
  for update using (public.is_admin()) with check (public.is_admin());

grant select, insert, delete on public.saved_posts to authenticated;
grant select, insert, update on public.notifications to authenticated;
grant select on public.feed_ranking_config to anon, authenticated;
grant update on public.feed_ranking_config to authenticated;
