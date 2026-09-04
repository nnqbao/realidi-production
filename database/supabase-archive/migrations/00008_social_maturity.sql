-- Social maturity: community posts, questions, messaging, signals, invites.
-- Additive. Does not drop existing product tables.

-- ---------------------------------------------------------------------------
-- Enum extensions (PG 15: usable in the same transaction)
-- ---------------------------------------------------------------------------
alter type public.post_type add value if not exists 'community';
alter type public.post_type add value if not exists 'question';

alter type public.notification_type add value if not exists 'message';
alter type public.notification_type add value if not exists 'community_answer';
alter type public.notification_type add value if not exists 'place_invite';

-- ---------------------------------------------------------------------------
-- City + leftover Felt identity
-- ---------------------------------------------------------------------------
update public.places
set city = 'TP. Hồ Chí Minh'
where city in ('Ho Chi Minh City', 'HCMC', 'Saigon', 'Sai Gon');

alter table public.places alter column city set default 'TP. Hồ Chí Minh';

update public.profiles
set
  username = 'realidi',
  display_name = 'Realidi',
  bio = 'Tài khoản chính thức của Realidi.'
where username in ('feltadmin', 'felt');

-- ---------------------------------------------------------------------------
-- Post community fields
-- ---------------------------------------------------------------------------
alter table public.experience_posts
  add column if not exists area_label text;

alter table public.comments
  add column if not exists place_id uuid references public.places (id) on delete set null,
  add column if not exists attached_post_id uuid references public.experience_posts (id) on delete set null;

create index if not exists comments_place_idx on public.comments (place_id) where place_id is not null;

create table if not exists public.community_question_meta (
  post_id uuid primary key references public.experience_posts (id) on delete cascade,
  area_label text,
  budget_max integer,
  mood_id uuid references public.moods (id) on delete set null,
  visit_context public.visit_context,
  time_label text,
  crowd_preference public.crowd_level,
  created_at timestamptz not null default now()
);

alter table public.community_question_meta enable row level security;
create policy community_question_meta_read on public.community_question_meta for select using (true);
create policy community_question_meta_own on public.community_question_meta
  for all using (
    exists (
      select 1 from public.experience_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.experience_posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

grant select on public.community_question_meta to anon, authenticated;
grant insert, update, delete on public.community_question_meta to authenticated;

-- ---------------------------------------------------------------------------
-- Saves: Saved vs Muốn đi
-- ---------------------------------------------------------------------------
alter table public.saves
  add column if not exists intent text not null default 'saved';

alter table public.saves drop constraint if exists saves_intent_check;
alter table public.saves add constraint saves_intent_check check (intent in ('saved', 'want_to_go'));

-- ---------------------------------------------------------------------------
-- Taste signals (compact; product_events remains the full analytics log)
-- ---------------------------------------------------------------------------
create table if not exists public.user_interest_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('place', 'mood', 'author', 'post', 'category', 'area')),
  entity_id uuid,
  signal_type text not null,
  weight numeric not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists user_interest_signals_user_idx
  on public.user_interest_signals (user_id, created_at desc);
create index if not exists user_interest_signals_entity_idx
  on public.user_interest_signals (user_id, entity_type, entity_id);

alter table public.user_interest_signals enable row level security;
create policy user_interest_signals_own on public.user_interest_signals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert on public.user_interest_signals to authenticated;

-- ---------------------------------------------------------------------------
-- Direct messaging
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_direct boolean not null default true,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id, last_read_at);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  kind text not null default 'text' check (kind in ('text', 'post', 'place', 'profile', 'invite')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);

create table if not exists public.conversation_typing (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  typed_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.place_invitations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  suggested_date date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists place_invitations_to_idx on public.place_invitations (to_user_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_typing enable row level security;
alter table public.place_invitations enable row level security;

create or replace function public.is_conversation_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = cid and user_id = auth.uid()
  );
$$;

create policy conversations_member on public.conversations
  for select using (public.is_conversation_member(id));
create policy conversations_insert on public.conversations
  for insert with check (auth.uid() is not null);
create policy conversations_update_member on public.conversations
  for update using (public.is_conversation_member(id));

create policy conversation_participants_member on public.conversation_participants
  for select using (user_id = auth.uid() or public.is_conversation_member(conversation_id));
create policy conversation_participants_insert on public.conversation_participants
  for insert with check (user_id = auth.uid() or public.is_conversation_member(conversation_id));
create policy conversation_participants_update_own on public.conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_member_read on public.messages
  for select using (public.is_conversation_member(conversation_id) and deleted_at is null);
create policy messages_member_insert on public.messages
  for insert with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));
create policy messages_own_update on public.messages
  for update using (sender_id = auth.uid());

create policy conversation_typing_member on public.conversation_typing
  for all using (public.is_conversation_member(conversation_id))
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy place_invitations_own on public.place_invitations
  for select using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy place_invitations_insert on public.place_invitations
  for insert with check (from_user_id = auth.uid());

grant select, insert, update on public.conversations to authenticated;
grant select, insert, update on public.conversation_participants to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert, update, delete on public.conversation_typing to authenticated;
grant select, insert on public.place_invitations to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if other_user_id = me then
    raise exception 'NO_SELF_DM';
  end if;
  select c.id into cid
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = me
  join public.conversation_participants b on b.conversation_id = c.id and b.user_id = other_user_id
  where c.is_direct = true
  limit 1;
  if cid is not null then
    return cid;
  end if;
  insert into public.conversations (is_direct) values (true) returning id into cid;
  insert into public.conversation_participants (conversation_id, user_id)
  values (cid, me), (cid, other_user_id);
  return cid;
end;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;

create or replace function public.tg_message_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.tg_message_touch_conversation();

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then
  null;
when undefined_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_typing;
exception when duplicate_object then
  null;
when undefined_object then
  null;
end $$;
