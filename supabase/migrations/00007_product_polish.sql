-- Product polish: recommendation feedback + place time intelligence.
-- Additive. Does not drop or rebuild existing product tables.

create table if not exists public.place_recommendation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  mood_id uuid references public.moods (id) on delete set null,
  kind text not null check (kind in ('fit', 'wrong_mood')),
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create index if not exists place_recommendation_feedback_user_idx
  on public.place_recommendation_feedback (user_id, created_at desc);
create index if not exists place_recommendation_feedback_place_idx
  on public.place_recommendation_feedback (place_id, kind);

alter table public.place_recommendation_feedback enable row level security;

create policy place_recommendation_feedback_own on public.place_recommendation_feedback
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.place_recommendation_feedback to authenticated;

-- Structured visit-time aggregates (surfaced only when sample size is sufficient).
create table if not exists public.place_time_stats (
  place_id uuid primary key references public.places (id) on delete cascade,
  weekday_count integer not null default 0,
  weekend_count integer not null default 0,
  morning_count integer not null default 0,
  afternoon_count integer not null default 0,
  evening_count integer not null default 0,
  night_count integer not null default 0,
  favorite_day_type public.visit_day_type,
  favorite_time_period public.visit_time_period,
  sample_count integer not null default 0,
  verified_sample_count integer not null default 0,
  confidence numeric not null default 0,
  tier public.confidence_tier not null default 'early_signal',
  last_updated timestamptz not null default now()
);

alter table public.place_time_stats enable row level security;

create policy place_time_stats_read on public.place_time_stats for select using (true);

grant select on public.place_time_stats to anon, authenticated;

create or replace function public.refresh_place_time_stats(p_place_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.place_time_stats (
    place_id,
    weekday_count, weekend_count,
    morning_count, afternoon_count, evening_count, night_count,
    favorite_day_type, favorite_time_period,
    sample_count, verified_sample_count, confidence, tier, last_updated
  )
  select
    p_place_id,
    s.weekday_count,
    s.weekend_count,
    s.morning_count,
    s.afternoon_count,
    s.evening_count,
    s.night_count,
    case when s.weekday_count >= s.weekend_count and s.weekday_count > 0 then 'weekday'
         when s.weekend_count > 0 then 'weekend'
         else null end,
    case
      when s.morning_count >= greatest(s.afternoon_count, s.evening_count, s.night_count) and s.morning_count > 0 then 'morning'
      when s.afternoon_count >= greatest(s.evening_count, s.night_count) and s.afternoon_count > 0 then 'afternoon'
      when s.evening_count >= s.night_count and s.evening_count > 0 then 'evening'
      when s.night_count > 0 then 'night'
      else null
    end,
    s.sample_count,
    s.verified_sample_count,
    c.confidence,
    c.tier,
    now()
  from (
    select
      count(*) filter (where m.visit_day_type = 'weekday')::int as weekday_count,
      count(*) filter (where m.visit_day_type = 'weekend')::int as weekend_count,
      count(*) filter (where m.visit_time_period = 'morning')::int as morning_count,
      count(*) filter (where m.visit_time_period = 'afternoon')::int as afternoon_count,
      count(*) filter (where m.visit_time_period = 'evening')::int as evening_count,
      count(*) filter (where m.visit_time_period = 'night')::int as night_count,
      count(*) filter (where m.visit_time_period is not null or m.visit_day_type is not null)::int as sample_count,
      count(*) filter (
        where ep.verification_status = 'verified'
          and (m.visit_time_period is not null or m.visit_day_type is not null)
      )::int as verified_sample_count
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
    weekday_count = excluded.weekday_count,
    weekend_count = excluded.weekend_count,
    morning_count = excluded.morning_count,
    afternoon_count = excluded.afternoon_count,
    evening_count = excluded.evening_count,
    night_count = excluded.night_count,
    favorite_day_type = excluded.favorite_day_type,
    favorite_time_period = excluded.favorite_time_period,
    sample_count = excluded.sample_count,
    verified_sample_count = excluded.verified_sample_count,
    confidence = excluded.confidence,
    tier = excluded.tier,
    last_updated = now();
end;
$$;

create or replace function public.tg_refresh_place_time_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  select place_id into pid from public.experience_posts where id = new.experience_post_id;
  if pid is not null then
    perform public.refresh_place_time_stats(pid);
  end if;
  return new;
end;
$$;

drop trigger if exists experience_metrics_time_stats on public.experience_metrics;
create trigger experience_metrics_time_stats
  after insert or update on public.experience_metrics
  for each row execute function public.tg_refresh_place_time_stats();

grant execute on function public.refresh_place_time_stats(uuid) to authenticated;

-- Rename leftover Felt demo admin if present. Do not surface this account in consumer recommendations.
update public.profiles
set
  username = 'realidi',
  display_name = 'Realidi',
  bio = 'Tài khoản chính thức của Realidi.'
where username = 'feltadmin';
