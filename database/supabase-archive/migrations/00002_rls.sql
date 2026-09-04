-- Row Level Security for every exposed table.
-- Authorization is enforced here AND in server actions. UI hiding is not enough.

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.moods enable row level security;
alter table public.experience_styles enable row level security;
alter table public.place_categories enable row level security;
alter table public.places enable row level security;
alter table public.place_moods enable row level security;
alter table public.place_styles enable row level security;
alter table public.experience_posts enable row level security;
alter table public.post_media enable row level security;
alter table public.experience_mood_ratings enable row level security;
alter table public.experience_metrics enable row level security;
alter table public.place_mood_stats enable row level security;
alter table public.place_experience_stats enable row level security;
alter table public.place_crowd_stats enable row level security;
alter table public.place_cost_stats enable row level security;
alter table public.travel_dna_profiles enable row level security;
alter table public.creator_reputation enable row level security;
alter table public.saved_collections enable row level security;
alter table public.saves enable row level security;
alter table public.visit_claims enable row level security;
alter table public.visit_verifications enable row level security;
alter table public.follows enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;
alter table public.shares enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.ranking_config enable row level security;
alter table public.feature_flags enable row level security;
alter table public.product_events enable row level security;

-- Profiles: public read of living profiles; owner update of safe columns.
create policy profiles_select on public.profiles
  for select using (deleted_at is null or id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy profiles_update_admin on public.profiles
  for update using (public.is_admin())
  with check (public.is_admin());

-- Preferences: owner only
create policy user_preferences_own on public.user_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy user_preferences_staff_read on public.user_preferences
  for select using (public.is_staff());

-- Taxonomy: public read of active; staff write
create policy moods_read on public.moods for select using (is_active or public.is_staff());
create policy moods_staff_write on public.moods for all using (public.is_staff()) with check (public.is_staff());

create policy styles_read on public.experience_styles for select using (is_active or public.is_staff());
create policy styles_staff_write on public.experience_styles for all using (public.is_staff()) with check (public.is_staff());

create policy categories_read on public.place_categories for select using (is_active or public.is_staff());
create policy categories_staff_write on public.place_categories for all using (public.is_staff()) with check (public.is_staff());

-- Places: public read of active (and merged for redirects); staff manage
create policy places_read on public.places
  for select using (
    status in ('active', 'temporarily_closed', 'merged')
    or public.is_staff()
  );

create policy places_staff_insert on public.places
  for insert with check (public.is_staff());

create policy places_staff_update on public.places
  for update using (public.is_staff()) with check (public.is_staff());

create policy place_moods_read on public.place_moods for select using (true);
create policy place_moods_staff on public.place_moods for all using (public.is_staff()) with check (public.is_staff());
create policy place_styles_read on public.place_styles for select using (true);
create policy place_styles_staff on public.place_styles for all using (public.is_staff()) with check (public.is_staff());

-- Posts: published public; owner CRUD own; staff all
create policy posts_read on public.experience_posts
  for select using (
    (status = 'published' and deleted_at is null and moderation_status <> 'hidden')
    or author_id = auth.uid()
    or public.is_staff()
  );

create policy posts_insert_own on public.experience_posts
  for insert with check (author_id = auth.uid());

create policy posts_update_own on public.experience_posts
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy posts_update_staff on public.experience_posts
  for update using (public.is_staff()) with check (public.is_staff());

create policy post_media_read on public.post_media
  for select using (
    exists (
      select 1 from public.experience_posts p
      where p.id = post_id
        and (
          (p.status = 'published' and p.deleted_at is null and p.moderation_status <> 'hidden')
          or p.author_id = auth.uid()
          or public.is_staff()
        )
    )
  );

create policy post_media_write_own on public.post_media
  for all using (
    exists (select 1 from public.experience_posts p where p.id = post_id and p.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.experience_posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy mood_ratings_read on public.experience_mood_ratings
  for select using (
    exists (
      select 1 from public.experience_posts p
      where p.id = experience_post_id
        and (
          (p.status = 'published' and p.deleted_at is null and p.moderation_status <> 'hidden')
          or p.author_id = auth.uid()
          or public.is_staff()
        )
    )
  );

create policy mood_ratings_write_own on public.experience_mood_ratings
  for all using (
    exists (select 1 from public.experience_posts p where p.id = experience_post_id and p.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.experience_posts p where p.id = experience_post_id and p.author_id = auth.uid())
  );

create policy metrics_read on public.experience_metrics
  for select using (
    exists (
      select 1 from public.experience_posts p
      where p.id = experience_post_id
        and (
          (p.status = 'published' and p.deleted_at is null and p.moderation_status <> 'hidden')
          or p.author_id = auth.uid()
          or public.is_staff()
        )
    )
  );

create policy metrics_write_own on public.experience_metrics
  for all using (
    exists (select 1 from public.experience_posts p where p.id = experience_post_id and p.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.experience_posts p where p.id = experience_post_id and p.author_id = auth.uid())
  );

-- Aggregates: public read
create policy place_mood_stats_read on public.place_mood_stats for select using (true);
create policy place_experience_stats_read on public.place_experience_stats for select using (true);
create policy place_crowd_stats_read on public.place_crowd_stats for select using (true);
create policy place_cost_stats_read on public.place_cost_stats for select using (true);

-- Future tables: owner / staff only
create policy travel_dna_own on public.travel_dna_profiles
  for select using (user_id = auth.uid() or public.is_staff());
create policy creator_reputation_read on public.creator_reputation
  for select using (true);

-- Saves / collections: owner only
create policy collections_own on public.saved_collections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saves_own on public.saves
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy visit_claims_own_write on public.visit_claims
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy visit_claims_public_count on public.visit_claims
  for select using (true);

-- Verification: owner + staff. Never expose raw GPS (we do not store it).
create policy verifications_own on public.visit_verifications
  for select using (user_id = auth.uid() or public.is_staff());
create policy verifications_insert_own on public.visit_verifications
  for insert with check (user_id = auth.uid());
create policy verifications_staff_update on public.visit_verifications
  for update using (public.is_staff()) with check (public.is_staff());

-- Social
create policy follows_read on public.follows for select using (true);
create policy follows_write_own on public.follows
  for all using (follower_id = auth.uid()) with check (follower_id = auth.uid());

create policy likes_read on public.post_likes for select using (true);
create policy likes_write_own on public.post_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy comments_read on public.comments
  for select using (
    (deleted_at is null and moderation_status <> 'hidden')
    or author_id = auth.uid()
    or public.is_staff()
  );
create policy comments_insert_own on public.comments
  for insert with check (author_id = auth.uid());
create policy comments_update_own on public.comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_staff on public.comments
  for update using (public.is_staff()) with check (public.is_staff());

create policy shares_insert on public.shares
  for insert with check (user_id = auth.uid() or user_id is null);
create policy shares_read_own on public.shares
  for select using (user_id = auth.uid() or public.is_staff());

-- Reports: reporter + staff
create policy reports_own on public.reports
  for select using (reporter_id = auth.uid() or public.is_staff());
create policy reports_insert on public.reports
  for insert with check (reporter_id = auth.uid());
create policy reports_staff_update on public.reports
  for update using (public.is_staff()) with check (public.is_staff());

create policy moderation_staff on public.moderation_actions
  for select using (public.is_staff());
create policy moderation_staff_insert on public.moderation_actions
  for insert with check (public.is_staff() and actor_id = auth.uid());

-- Ranking: public read, admin write
create policy ranking_read on public.ranking_config for select using (true);
create policy ranking_admin on public.ranking_config
  for update using (public.is_admin()) with check (public.is_admin());

create policy flags_read on public.feature_flags for select using (true);
create policy flags_admin on public.feature_flags
  for all using (public.is_admin()) with check (public.is_admin());

-- Analytics: insert own/anonymous; staff read
create policy events_insert on public.product_events
  for insert with check (user_id is null or user_id = auth.uid());
create policy events_staff_read on public.product_events
  for select using (public.is_staff() or user_id = auth.uid());

-- Prevent privilege escalation via profiles.role by non-admins at the column level.
-- Owner update policy already requires role to remain unchanged.
revoke insert, update, delete on public.ranking_config from anon;
revoke insert, update, delete on public.feature_flags from anon;
revoke insert, update, delete on public.places from anon, authenticated;
grant insert, update, delete on public.places to authenticated;

-- Staff write on places is gated by RLS policies above.
