-- Extend roles. New enum values cannot be used in the same transaction on some Postgres versions.
alter type public.user_role add value if not exists 'owner';
alter type public.user_role add value if not exists 'editor';

alter type public.report_target_type add value if not exists 'message';
alter type public.report_target_type add value if not exists 'conversation';

alter type public.place_status add value if not exists 'draft';
alter type public.place_status add value if not exists 'archived';
