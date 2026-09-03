-- Storage buckets. Binary files never live in PostgreSQL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'experience-media',
    'experience-media',
    true,
    52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
  ),
  (
    'place-media',
    'place-media',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
on conflict (id) do nothing;

-- Avatars: anyone can read; users write only to their folder.
create policy avatars_public_read
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_owner_write
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy avatars_owner_update
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy avatars_owner_delete
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Experience media: public read (drafts are unlisted by UUID path, not secret).
-- Strict signed-URL private drafts can replace this later.
create policy experience_media_read
  on storage.objects for select
  using (bucket_id = 'experience-media');

create policy experience_media_owner_write
  on storage.objects for insert
  with check (
    bucket_id = 'experience-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy experience_media_owner_update
  on storage.objects for update
  using (
    bucket_id = 'experience-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy experience_media_owner_delete
  on storage.objects for delete
  using (
    bucket_id = 'experience-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Place media: public read, staff write
create policy place_media_read
  on storage.objects for select
  using (bucket_id = 'place-media');

create policy place_media_staff_write
  on storage.objects for insert
  with check (bucket_id = 'place-media' and public.is_staff());

create policy place_media_staff_update
  on storage.objects for update
  using (bucket_id = 'place-media' and public.is_staff());

create policy place_media_staff_delete
  on storage.objects for delete
  using (bucket_id = 'place-media' and public.is_staff());
