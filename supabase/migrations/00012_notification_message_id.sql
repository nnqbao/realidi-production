-- Per-message notification uniqueness. Additive. Does not drop unrelated history.

-- Only delete rows that share a proven source key. Keep the oldest row.
do $$
declare
  by_key int := 0;
  by_message int := 0;
begin
  with ranked as (
    select
      id,
      row_number() over (
        partition by idempotency_key
        order by created_at asc, id asc
      ) as rn
    from public.notifications
    where idempotency_key is not null
  ),
  gone as (
    delete from public.notifications n
    using ranked r
    where n.id = r.id and r.rn > 1
    returning n.id
  )
  select count(*) into by_key from gone;

  with ranked as (
    select
      id,
      row_number() over (
        partition by user_id, metadata->>'message_id'
        order by created_at asc, id asc
      ) as rn
    from public.notifications
    where type = 'message'
      and metadata->>'message_id' is not null
  ),
  gone as (
    delete from public.notifications n
    using ranked r
    where n.id = r.id and r.rn > 1
    returning n.id
  )
  select count(*) into by_message from gone;

  raise notice 'notification_duplicate_cleanup removed % rows by idempotency_key and % rows by message_id', by_key, by_message;
end $$;

create unique index if not exists notifications_message_id_uidx
  on public.notifications (user_id, (metadata->>'message_id'))
  where type = 'message' and metadata->>'message_id' is not null;

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
  message_id text;
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if p_user_id = p_actor_id then
    return null;
  end if;

  message_id := coalesce(p_metadata->>'message_id', null);

  if p_idempotency_key is not null then
    select id into existing_id
    from public.notifications
    where idempotency_key = p_idempotency_key
    limit 1;
    if existing_id is not null then
      return existing_id;
    end if;
  end if;

  if p_type = 'message' and message_id is not null then
    select id into existing_id
    from public.notifications
    where user_id = p_user_id
      and type = 'message'
      and metadata->>'message_id' = message_id
    limit 1;
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
      if p_idempotency_key is not null then
        select id into existing_id
        from public.notifications
        where idempotency_key = p_idempotency_key
        limit 1;
        if existing_id is not null then
          return existing_id;
        end if;
      end if;
      if p_type = 'message' and message_id is not null then
        select id into existing_id
        from public.notifications
        where user_id = p_user_id
          and type = 'message'
          and metadata->>'message_id' = message_id
        limit 1;
      end if;
      return existing_id;
  end;
end;
$$;

revoke all on function public.notify_event(uuid, uuid, public.notification_type, uuid, uuid, text, jsonb) from public;
grant execute on function public.notify_event(uuid, uuid, public.notification_type, uuid, uuid, text, jsonb) to authenticated;
