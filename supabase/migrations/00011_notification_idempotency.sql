-- Notification idempotency. Additive, non-destructive.
-- Unique among unread rows so a later event can notify again after the previous one is read.

alter table public.notifications
  add column if not exists idempotency_key text;

create unique index if not exists notifications_unread_idempotency_uidx
  on public.notifications (idempotency_key)
  where read_at is null and idempotency_key is not null;

comment on column public.notifications.idempotency_key is
  'Stable event key so one source action cannot insert two unread notifications.';

create or replace function public.notify_event(
  p_user_id uuid,
  p_actor_id uuid,
  p_type public.notification_type,
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if p_user_id = p_actor_id then
    return null;
  end if;

  if p_type = 'message' and p_idempotency_key is not null then
    update public.notifications
    set
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{count}',
        to_jsonb(greatest(coalesce((metadata->>'count')::int, 1), 1) + 1)
      ),
      created_at = now()
    where user_id = p_user_id
      and type = 'message'
      and read_at is null
      and idempotency_key = p_idempotency_key
    returning id into existing_id;
    if existing_id is not null then
      return existing_id;
    end if;
  end if;

  begin
    insert into public.notifications (
      user_id, actor_id, type, post_id, comment_id, idempotency_key, metadata
    ) values (
      p_user_id, p_actor_id, p_type, p_post_id, p_comment_id, p_idempotency_key, coalesce(p_metadata, '{}'::jsonb)
    )
    returning id into existing_id;
    return existing_id;
  exception
    when unique_violation then
      select id into existing_id
      from public.notifications
      where idempotency_key = p_idempotency_key
        and read_at is null
      limit 1;
      return existing_id;
  end;
end;
$$;

revoke all on function public.notify_event(uuid, uuid, public.notification_type, uuid, uuid, text, jsonb) from public;
grant execute on function public.notify_event(uuid, uuid, public.notification_type, uuid, uuid, text, jsonb) to authenticated;
