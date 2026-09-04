-- Felt — Travel Experience Intelligence Platform
-- Phase A foundation: extensions, enums, tables, indexes, functions, RLS.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "postgis" with schema extensions;
create extension if not exists "pg_trgm" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'creator', 'moderator', 'admin');
create type public.mood_layer as enum ('current_state', 'desired_feeling');
create type public.place_status as enum (
  'active',
  'pending',
  'temporarily_closed',
  'permanently_closed',
  'hidden',
  'merged'
);
create type public.place_source as enum ('editorial', 'user', 'import', 'provider');
create type public.post_status as enum ('draft', 'published', 'hidden', 'deleted');
create type public.verification_status as enum (
  'unverified',
  'verification_pending',
  'verified',
  'verification_failed'
);
create type public.verification_method as enum (
  'onsite_geolocation',
  'admin',
  'media_evidence',
  'partner'
);
create type public.verification_result as enum ('pending', 'verified', 'failed');
create type public.moderation_status as enum ('pending', 'approved', 'hidden', 'rejected');
create type public.visit_context as enum ('solo', 'couple', 'friends', 'family', 'work', 'other');
create type public.crowd_level as enum ('quiet', 'normal', 'busy', 'very_busy');
create type public.visit_day_type as enum ('weekday', 'weekend', 'holiday');
create type public.visit_time_period as enum ('morning', 'afternoon', 'evening', 'night');
create type public.media_type as enum ('image', 'video');
create type public.report_status as enum ('pending', 'investigating', 'resolved', 'dismissed');
create type public.report_target_type as enum ('post', 'comment', 'user', 'place');
create type public.moderation_target_type as enum ('post', 'comment', 'user', 'place', 'report');
create type public.confidence_tier as enum ('early_signal', 'emerging', 'established');

-- ---------------------------------------------------------------------------
-- Updated-at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles & preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  bio text,
  avatar_path text,
  role public.user_role not null default 'user',
  locale text not null default 'vi',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  home_city text,
  onboarding_completed_at timestamptz,
  onboarding_skipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  preferred_mood_ids uuid[] not null default '{}',
  preferred_style_ids uuid[] not null default '{}',
  preferred_visit_contexts public.visit_context[] not null default '{}',
  budget_min integer,
  budget_max integer,
  typical_time_minutes integer,
  preferred_crowd public.crowd_level,
  home_latitude double precision,
  home_longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Taxonomy (database-driven, never hard-coded in UI)
-- ---------------------------------------------------------------------------
create table public.moods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  layer public.mood_layer not null,
  name_vi text not null,
  name_en text not null,
  description_vi text,
  description_en text,
  prompt_vi text,
  prompt_en text,
  color_token text not null default 'mood-default',
  icon text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.experience_styles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_vi text not null,
  name_en text not null,
  description_vi text,
  description_en text,
  icon text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_vi text not null,
  name_en text not null,
  parent_id uuid references public.place_categories (id) on delete set null,
  icon text,
  typical_duration_minutes integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Places (canonical, provider-agnostic)
-- ---------------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  description text,
  category_id uuid references public.place_categories (id) on delete set null,
  address text,
  district text,
  city text not null default 'Ho Chi Minh City',
  country text not null default 'VN',
  latitude double precision,
  longitude double precision,
  location geography(Point, 4326),
  cover_image_path text,
  phone text,
  website text,
  opening_hours jsonb,
  price_level smallint check (price_level between 1 and 4),
  typical_duration_minutes integer,
  typical_spend_min integer,
  typical_spend_max integer,
  currency text not null default 'VND',
  status public.place_status not null default 'active',
  source public.place_source not null default 'editorial',
  external_provider text,
  external_provider_id text,
  created_by uuid references public.profiles (id) on delete set null,
  verified_by_admin boolean not null default false,
  editorial_score numeric not null default 0.5 check (editorial_score between 0 and 1),
  admin_quality_score numeric not null default 0.5 check (admin_quality_score between 0 and 1),
  merged_into_place_id uuid references public.places (id) on delete set null,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_merged_integrity check (
    (status = 'merged' and merged_into_place_id is not null)
    or (status <> 'merged')
  )
);

create table public.place_moods (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  mood_id uuid not null references public.moods (id) on delete cascade,
  weight numeric not null default 1 check (weight >= 0),
  source text not null default 'editorial',
  created_at timestamptz not null default now(),
  unique (place_id, mood_id)
);

create table public.place_styles (
  place_id uuid not null references public.places (id) on delete cascade,
  style_id uuid not null references public.experience_styles (id) on delete cascade,
  primary key (place_id, style_id)
);

-- ---------------------------------------------------------------------------
-- Experience posts & structured intelligence
-- ---------------------------------------------------------------------------
create table public.experience_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  caption text,
  status public.post_status not null default 'draft',
  visit_date date,
  visit_context public.visit_context,
  verification_status public.verification_status not null default 'unverified',
  moderation_status public.moderation_status not null default 'approved',
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.experience_posts (id) on delete cascade,
  media_type public.media_type not null,
  storage_path text not null,
  thumbnail_path text,
  width integer,
  height integer,
  duration_seconds numeric,
  mime_type text,
  file_size_bytes bigint,
  sort_order integer not null default 0,
  processing_status text not null default 'ready',
  created_at timestamptz not null default now()
);

create table public.experience_mood_ratings (
  id uuid primary key default gen_random_uuid(),
  experience_post_id uuid not null references public.experience_posts (id) on delete cascade,
  mood_id uuid not null references public.moods (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique (experience_post_id, mood_id)
);

create table public.experience_metrics (
  experience_post_id uuid primary key references public.experience_posts (id) on delete cascade,
  crowd_level public.crowd_level,
  worth_it smallint check (worth_it between 1 and 5),
  spend_per_person integer,
  currency text not null default 'VND',
  visit_day_type public.visit_day_type,
  visit_time_period public.visit_time_period,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Aggregates (never compute heavy stats on every page load)
-- ---------------------------------------------------------------------------
create table public.place_mood_stats (
  place_id uuid not null references public.places (id) on delete cascade,
  mood_id uuid not null references public.moods (id) on delete cascade,
  avg_rating numeric,
  smoothed_rating numeric,
  sample_count integer not null default 0,
  verified_sample_count integer not null default 0,
  confidence numeric not null default 0,
  tier public.confidence_tier not null default 'early_signal',
  last_updated timestamptz not null default now(),
  primary key (place_id, mood_id)
);

create table public.place_experience_stats (
  place_id uuid primary key references public.places (id) on delete cascade,
  avg_worth_it numeric,
  smoothed_worth_it numeric,
  sample_count integer not null default 0,
  verified_sample_count integer not null default 0,
  verified_ratio numeric not null default 0,
  confidence numeric not null default 0,
  tier public.confidence_tier not null default 'early_signal',
  best_visit_context public.visit_context,
  best_time_period public.visit_time_period,
  last_updated timestamptz not null default now()
);

create table public.place_crowd_stats (
  place_id uuid primary key references public.places (id) on delete cascade,
  quiet_count integer not null default 0,
  normal_count integer not null default 0,
  busy_count integer not null default 0,
  very_busy_count integer not null default 0,
  dominant_crowd public.crowd_level,
  sample_count integer not null default 0,
  verified_sample_count integer not null default 0,
  confidence numeric not null default 0,
  tier public.confidence_tier not null default 'early_signal',
  last_updated timestamptz not null default now()
);

create table public.place_cost_stats (
  place_id uuid primary key references public.places (id) on delete cascade,
  median_spend_per_person numeric,
  avg_spend_per_person numeric,
  currency text not null default 'VND',
  sample_count integer not null default 0,
  verified_sample_count integer not null default 0,
  confidence numeric not null default 0,
  tier public.confidence_tier not null default 'early_signal',
  last_updated timestamptz not null default now()
);

-- Future-compatible stubs (no consumer UI in MVP)
create table public.travel_dna_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  declared jsonb not null default '{}',
  behavioral jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.creator_reputation (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  verified_contribution_count integer not null default 0,
  useful_save_count integer not null default 0,
  report_count integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Intent: saves, collections, been-there
-- ---------------------------------------------------------------------------
create table public.saved_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  collection_id uuid references public.saved_collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, place_id, collection_id)
);

create table public.visit_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (user_id, place_id)
);

-- ---------------------------------------------------------------------------
-- Verification (do not store raw GPS of the user)
-- ---------------------------------------------------------------------------
create table public.visit_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  experience_post_id uuid references public.experience_posts (id) on delete set null,
  method public.verification_method not null default 'onsite_geolocation',
  result public.verification_result not null,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  distance_meters numeric,
  accuracy_meters numeric,
  geofence_radius_meters integer,
  verified_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Social (intentionally lean)
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create table public.post_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.experience_posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.experience_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  parent_id uuid references public.comments (id) on delete cascade,
  moderation_status public.moderation_status not null default 'approved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  place_id uuid references public.places (id) on delete cascade,
  post_id uuid references public.experience_posts (id) on delete cascade,
  channel text not null default 'link',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Trust / moderation
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status public.report_status not null default 'pending',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  target_type public.moderation_target_type not null,
  target_id uuid not null,
  action text not null,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ranking, flags, first-party analytics
-- ---------------------------------------------------------------------------
create table public.ranking_config (
  id text primary key default 'default',
  mood_match_weight numeric not null default 0.45,
  trust_weight numeric not null default 0.20,
  freshness_weight numeric not null default 0.15,
  proximity_weight numeric not null default 0.10,
  quality_engagement_weight numeric not null default 0.10,
  bayesian_prior_mean numeric not null default 3.2,
  bayesian_prior_strength numeric not null default 8,
  save_weight numeric not null default 4,
  been_there_weight numeric not null default 3,
  share_weight numeric not null default 2,
  like_weight numeric not null default 1,
  freshness_half_life_days numeric not null default 21,
  min_samples_early integer not null default 5,
  min_samples_medium integer not null default 20,
  editorial_cold_start_weight numeric not null default 0.35,
  geofence_radius_meters integer not null default 150,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint ranking_weights_sum check (
    abs(
      (mood_match_weight + trust_weight + freshness_weight + proximity_weight + quality_engagement_weight)
      - 1
    ) < 0.001
  )
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid references public.profiles (id) on delete set null,
  session_id text,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index profiles_username_idx on public.profiles (username);
create index profiles_role_idx on public.profiles (role) where deleted_at is null;
create index moods_layer_active_idx on public.moods (layer, is_active, sort_order);
create index experience_styles_active_idx on public.experience_styles (is_active, sort_order);
create index place_categories_active_idx on public.place_categories (is_active, sort_order);

create index places_status_city_idx on public.places (status, city);
create index places_category_idx on public.places (category_id);
create index places_location_gix on public.places using gist (location);
create index places_search_idx on public.places using gin (search_vector);
create index places_name_trgm_idx on public.places using gin (name gin_trgm_ops);
create unique index places_provider_idx on public.places (external_provider, external_provider_id)
  where external_provider is not null and external_provider_id is not null;

create index experience_posts_place_pub_idx on public.experience_posts (place_id, published_at desc)
  where status = 'published' and deleted_at is null;
create index experience_posts_author_idx on public.experience_posts (author_id, created_at desc);
create index experience_posts_verification_idx on public.experience_posts (verification_status)
  where status = 'published';

create index post_media_post_idx on public.post_media (post_id, sort_order);
create index experience_mood_ratings_mood_idx on public.experience_mood_ratings (mood_id);
create index saves_user_idx on public.saves (user_id, created_at desc);
create index saves_place_idx on public.saves (place_id);
create index visit_claims_place_idx on public.visit_claims (place_id);
create index visit_verifications_place_idx on public.visit_verifications (place_id, created_at desc);
create index visit_verifications_user_idx on public.visit_verifications (user_id, created_at desc);
create index follows_following_idx on public.follows (following_id);
create index comments_post_idx on public.comments (post_id, created_at)
  where deleted_at is null;
create index reports_status_idx on public.reports (status, created_at desc);
create index product_events_name_idx on public.product_events (event_name, created_at desc);
create index product_events_user_idx on public.product_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, search vector, location, counters
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger moods_updated_at before update on public.moods
  for each row execute function public.set_updated_at();
create trigger experience_styles_updated_at before update on public.experience_styles
  for each row execute function public.set_updated_at();
create trigger place_categories_updated_at before update on public.place_categories
  for each row execute function public.set_updated_at();
create trigger places_updated_at before update on public.places
  for each row execute function public.set_updated_at();
create trigger experience_posts_updated_at before update on public.experience_posts
  for each row execute function public.set_updated_at();
create trigger experience_metrics_updated_at before update on public.experience_metrics
  for each row execute function public.set_updated_at();
create trigger saved_collections_updated_at before update on public.saved_collections
  for each row execute function public.set_updated_at();
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();
create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();
create trigger ranking_config_updated_at before update on public.ranking_config
  for each row execute function public.set_updated_at();

create or replace function public.sync_place_location_and_search()
returns trigger
language plpgsql
as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := extensions.ST_SetSRID(extensions.ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.location := null;
  end if;
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.district, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.short_description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.address, '')), 'D');
  return new;
end;
$$;

create trigger places_sync before insert or update of name, district, short_description, address, latitude, longitude
  on public.places
  for each row execute function public.sync_place_location_and_search();

create or replace function public.tg_like_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.experience_posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.experience_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.tg_like_count();

create or replace function public.tg_comment_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.experience_posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    update public.experience_posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' and old.deleted_at is null then
    update public.experience_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger comments_count after insert or update or delete on public.comments
  for each row execute function public.tg_comment_count();

-- ---------------------------------------------------------------------------
-- New user bootstrap (role is NEVER taken from client metadata)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  display text;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'user'),
    '[^a-z0-9_]',
    '',
    'g'
  ));
  if char_length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  base_username := substr(base_username, 1, 24);
  final_username := base_username;
  if exists (select 1 from public.profiles where username = final_username) then
    final_username := substr(base_username, 1, 20) || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;

  display := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1),
    'Traveler'
  );

  insert into public.profiles (id, username, display_name, locale, role)
  values (new.id, final_username, display, coalesce(new.raw_user_meta_data->>'locale', 'vi'), 'user');

  insert into public.user_preferences (user_id) values (new.id);
  insert into public.saved_collections (user_id, name, slug, is_default)
  values (new.id, 'Đã lưu', 'saved', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Auth helpers (security definer, no RLS recursion on SELECT of profiles)
-- ---------------------------------------------------------------------------
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
      and role = 'admin'
      and deleted_at is null
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
      and role in ('moderator', 'admin')
      and deleted_at is null
  );
$$;

create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.current_role() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Geo: nearby places
-- ---------------------------------------------------------------------------
create or replace function public.nearby_places(
  p_lat double precision,
  p_lng double precision,
  p_radius_meters integer default 5000,
  p_limit integer default 50
)
returns table (
  id uuid,
  distance_meters numeric
)
language sql
stable
as $$
  select
    p.id,
    extensions.ST_Distance(
      p.location,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography
    )::numeric as distance_meters
  from public.places p
  where p.status = 'active'
    and p.location is not null
    and extensions.ST_DWithin(
      p.location,
      extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  order by distance_meters
  limit p_limit;
$$;

create or replace function public.places_in_viewport(
  p_min_lng double precision,
  p_min_lat double precision,
  p_max_lng double precision,
  p_max_lat double precision
)
returns setof public.places
language sql
stable
as $$
  select p.*
  from public.places p
  where p.status = 'active'
    and p.location is not null
    and p.location && extensions.ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography;
$$;

-- ---------------------------------------------------------------------------
-- Confidence helper
-- ---------------------------------------------------------------------------
create or replace function public.confidence_from_samples(n integer, n_verified integer)
returns table (confidence numeric, tier public.confidence_tier)
language sql
stable
as $$
  select
    least(1, (n::numeric / 20.0) * 0.7 + (n_verified::numeric / greatest(n, 1)::numeric) * 0.3)::numeric,
    case
      when n < 5 then 'early_signal'::public.confidence_tier
      when n < 20 then 'emerging'::public.confidence_tier
      else 'established'::public.confidence_tier
    end;
$$;

-- ---------------------------------------------------------------------------
-- Aggregate refresh (call after publish / verify / hide)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_place_aggregates(p_place_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_mean numeric;
  prior_n numeric;
begin
  select bayesian_prior_mean, bayesian_prior_strength
    into prior_mean, prior_n
  from public.ranking_config
  where id = 'default';

  if prior_mean is null then
    prior_mean := 3.2;
    prior_n := 8;
  end if;

  delete from public.place_mood_stats where place_id = p_place_id;

  insert into public.place_mood_stats (
    place_id, mood_id, avg_rating, smoothed_rating,
    sample_count, verified_sample_count, confidence, tier, last_updated
  )
  select
    p_place_id,
    s.mood_id,
    s.avg_rating,
    ((prior_n * prior_mean) + (s.sample_count::numeric * s.avg_rating)) / (prior_n + s.sample_count),
    s.sample_count,
    s.verified_sample_count,
    c.confidence,
    c.tier,
    now()
  from (
    select
      r.mood_id,
      avg(r.rating)::numeric as avg_rating,
      count(*)::int as sample_count,
      count(*) filter (where ep.verification_status = 'verified')::int as verified_sample_count
    from public.experience_mood_ratings r
    join public.experience_posts ep on ep.id = r.experience_post_id
    where ep.place_id = p_place_id
      and ep.status = 'published'
      and ep.deleted_at is null
      and ep.moderation_status <> 'hidden'
    group by r.mood_id
  ) s
  cross join lateral public.confidence_from_samples(s.sample_count, s.verified_sample_count) c;

  insert into public.place_experience_stats (
    place_id, avg_worth_it, smoothed_worth_it,
    sample_count, verified_sample_count, verified_ratio,
    confidence, tier, best_visit_context, best_time_period, last_updated
  )
  select
    p_place_id,
    s.avg_worth_it,
    case when s.worth_n = 0 then null
      else ((prior_n * prior_mean) + (s.worth_n::numeric * s.avg_worth_it)) / (prior_n + s.worth_n)
    end,
    s.sample_count,
    s.verified_sample_count,
    case when s.sample_count = 0 then 0
      else s.verified_sample_count::numeric / s.sample_count::numeric
    end,
    c.confidence,
    c.tier,
    s.best_visit_context,
    s.best_time_period,
    now()
  from (
    select
      avg(m.worth_it)::numeric as avg_worth_it,
      count(m.worth_it)::int as worth_n,
      count(*)::int as sample_count,
      count(*) filter (where ep.verification_status = 'verified')::int as verified_sample_count,
      mode() within group (order by ep.visit_context) as best_visit_context,
      mode() within group (order by m.visit_time_period) as best_time_period
    from public.experience_posts ep
    left join public.experience_metrics m on m.experience_post_id = ep.id
    where ep.place_id = p_place_id
      and ep.status = 'published'
      and ep.deleted_at is null
      and ep.moderation_status <> 'hidden'
  ) s
  cross join lateral public.confidence_from_samples(s.sample_count, s.verified_sample_count) c
  where s.sample_count > 0
  on conflict (place_id) do update set
    avg_worth_it = excluded.avg_worth_it,
    smoothed_worth_it = excluded.smoothed_worth_it,
    sample_count = excluded.sample_count,
    verified_sample_count = excluded.verified_sample_count,
    verified_ratio = excluded.verified_ratio,
    confidence = excluded.confidence,
    tier = excluded.tier,
    best_visit_context = excluded.best_visit_context,
    best_time_period = excluded.best_time_period,
    last_updated = now();

  insert into public.place_crowd_stats (
    place_id, quiet_count, normal_count, busy_count, very_busy_count,
    dominant_crowd, sample_count, verified_sample_count, confidence, tier, last_updated
  )
  select
    p_place_id,
    s.quiet_count,
    s.normal_count,
    s.busy_count,
    s.very_busy_count,
    s.dominant_crowd,
    s.sample_count,
    s.verified_sample_count,
    c.confidence,
    c.tier,
    now()
  from (
    select
      count(*) filter (where m.crowd_level = 'quiet')::int as quiet_count,
      count(*) filter (where m.crowd_level = 'normal')::int as normal_count,
      count(*) filter (where m.crowd_level = 'busy')::int as busy_count,
      count(*) filter (where m.crowd_level = 'very_busy')::int as very_busy_count,
      mode() within group (order by m.crowd_level) as dominant_crowd,
      count(*) filter (where m.crowd_level is not null)::int as sample_count,
      count(*) filter (where m.crowd_level is not null and ep.verification_status = 'verified')::int as verified_sample_count
    from public.experience_posts ep
    join public.experience_metrics m on m.experience_post_id = ep.id
    where ep.place_id = p_place_id
      and ep.status = 'published'
      and ep.deleted_at is null
      and ep.moderation_status <> 'hidden'
  ) s
  cross join lateral public.confidence_from_samples(s.sample_count, s.verified_sample_count) c
  where s.sample_count > 0
  on conflict (place_id) do update set
    quiet_count = excluded.quiet_count,
    normal_count = excluded.normal_count,
    busy_count = excluded.busy_count,
    very_busy_count = excluded.very_busy_count,
    dominant_crowd = excluded.dominant_crowd,
    sample_count = excluded.sample_count,
    verified_sample_count = excluded.verified_sample_count,
    confidence = excluded.confidence,
    tier = excluded.tier,
    last_updated = now();

  insert into public.place_cost_stats (
    place_id, median_spend_per_person, avg_spend_per_person, currency,
    sample_count, verified_sample_count, confidence, tier, last_updated
  )
  select
    p_place_id,
    s.median_spend,
    s.avg_spend,
    coalesce(s.currency, 'VND'),
    s.sample_count,
    s.verified_sample_count,
    c.confidence,
    c.tier,
    now()
  from (
    select
      percentile_cont(0.5) within group (order by m.spend_per_person)::numeric as median_spend,
      avg(m.spend_per_person)::numeric as avg_spend,
      mode() within group (order by m.currency) as currency,
      count(*) filter (where m.spend_per_person is not null)::int as sample_count,
      count(*) filter (where m.spend_per_person is not null and ep.verification_status = 'verified')::int as verified_sample_count
    from public.experience_posts ep
    join public.experience_metrics m on m.experience_post_id = ep.id
    where ep.place_id = p_place_id
      and ep.status = 'published'
      and ep.deleted_at is null
      and ep.moderation_status <> 'hidden'
  ) s
  cross join lateral public.confidence_from_samples(s.sample_count, s.verified_sample_count) c
  where s.sample_count > 0
  on conflict (place_id) do update set
    median_spend_per_person = excluded.median_spend_per_person,
    avg_spend_per_person = excluded.avg_spend_per_person,
    currency = excluded.currency,
    sample_count = excluded.sample_count,
    verified_sample_count = excluded.verified_sample_count,
    confidence = excluded.confidence,
    tier = excluded.tier,
    last_updated = now();
end;
$$;

create or replace function public.tg_refresh_place_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  pid := coalesce(new.place_id, old.place_id);
  if pid is not null then
    perform public.refresh_place_aggregates(pid);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger experience_posts_refresh_aggregates
  after insert or update of status, verification_status, moderation_status, deleted_at, visit_context
  on public.experience_posts
  for each row execute function public.tg_refresh_place_aggregates();

-- ---------------------------------------------------------------------------
-- Default ranking config & flags
-- ---------------------------------------------------------------------------
insert into public.ranking_config (id) values ('default') on conflict do nothing;

insert into public.feature_flags (key, enabled, description) values
  ('ENABLE_REAL_COST', true, 'Show typical spend when confidence allows'),
  ('ENABLE_MOOD_MAP', false, 'Mood map surface (future)'),
  ('ENABLE_TRAVEL_DNA', false, 'Travel DNA consumer feature'),
  ('ENABLE_AI_SEARCH', false, 'AI conversational search'),
  ('ENABLE_CREATOR_FEATURES', false, 'Creator marketplace surfaces'),
  ('ENABLE_GOOGLE_AUTH', false, 'Google social login button')
on conflict do nothing;
