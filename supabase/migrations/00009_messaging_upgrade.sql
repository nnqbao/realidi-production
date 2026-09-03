-- Messaging upgrade: reactions, replies, images, blocks, mutes, invite status.
-- Additive. Does not replace 00008 messaging tables.

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'post', 'place', 'profile', 'invite', 'image', 'system'));

alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages (id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists client_id text;

create unique index if not exists messages_client_id_uidx
  on public.messages (sender_id, client_id)
  where client_id is not null;

create index if not exists messages_reply_idx
  on public.messages (reply_to_message_id)
  where reply_to_message_id is not null;

drop policy if exists messages_member_read on public.messages;
create policy messages_member_read on public.messages
  for select using (public.is_conversation_member(conversation_id));

alter table public.conversation_participants
  add column if not exists muted boolean not null default false;

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

alter table public.place_invitations
  add column if not exists status text not null default 'pending',
  add column if not exists suggested_time text,
  add column if not exists responded_at timestamptz;

alter table public.place_invitations drop constraint if exists place_invitations_status_check;
alter table public.place_invitations add constraint place_invitations_status_check
  check (status in ('pending', 'accepted', 'maybe', 'declined'));

drop policy if exists place_invitations_update on public.place_invitations;
create policy place_invitations_update on public.place_invitations
  for update using (from_user_id = auth.uid() or to_user_id = auth.uid())
  with check (from_user_id = auth.uid() or to_user_id = auth.uid());

grant update on public.place_invitations to authenticated;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('❤️', '👍', '😂', '😮', '😢')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;
create policy message_reactions_member_read on public.message_reactions
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id)
    )
  );
create policy message_reactions_own_write on public.message_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id)
    )
  );
create policy message_reactions_own_update on public.message_reactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy message_reactions_own_delete on public.message_reactions
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.message_reactions to authenticated;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
create policy user_blocks_own on public.user_blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

grant select, insert, delete on public.user_blocks to authenticated;

create or replace function public.is_blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = other)
       or (blocker_id = other and blocked_id = auth.uid())
  );
$$;

grant execute on function public.is_blocked_with(uuid) to authenticated;

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
  if public.is_blocked_with(other_user_id) then
    raise exception 'BLOCKED';
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

alter type public.report_target_type add value if not exists 'message';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media',
  'message-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

drop policy if exists message_media_read on storage.objects;
create policy message_media_read
  on storage.objects for select
  using (
    bucket_id = 'message-media'
    and public.is_conversation_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists message_media_write on storage.objects;
create policy message_media_write
  on storage.objects for insert
  with check (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_conversation_member(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists message_media_delete on storage.objects;
create policy message_media_delete
  on storage.objects for delete
  using (
    bucket_id = 'message-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then
  null;
when undefined_object then
  null;
end $$;
