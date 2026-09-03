# Authentication and Admin Console

Realidi uses **Supabase Auth** (email/password, optional Google) with `@supabase/ssr` cookies. Do not store access tokens in `localStorage`.

## Migrations

Apply in order on local, then production:

```bash
npx supabase migration up --local
# production: npx supabase db push
```

Relevant files:

- `supabase/migrations/00013_extend_enums.sql` — roles `owner`/`editor`, extra report targets, place `draft`/`archived`
- `supabase/migrations/00014_auth_admin_console.sql` — bans, lockouts, hidden posts, place media, immutable `audit_logs`, collections, featured placements, RLS

## First Owner

1. Create a user via `/signup` (or invite in Supabase Auth).
2. Set `INITIAL_OWNER_EMAIL` to that user’s email.
3. Sign in once. If no owner row exists, the profile is promoted to `owner`.
4. Unset or rotate the env var after bootstrap if you prefer.

Never commit that email into source. Do not hard-code demo passwords.

## Email

Configure SMTP in the **Supabase Auth** dashboard. Confirmation and reset links must use the Site URL / redirect URLs matching `APP_URL` (not a Cloudflare temporary hostname).

Required redirect URLs:

- `{APP_URL}/auth/callback`
- `{APP_URL}/reset-password/update`

Enable “Confirm email” for closed beta.

## Google OAuth

1. Create a Google OAuth client.
2. Add it in Supabase Auth → Providers → Google.
3. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` only after credentials work.
4. If the flag is false, production hides the Google button.

## Session

Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production. Login failures lock after 8 attempts for 15 minutes (`auth_lockouts`). Banned, deleted, and actively suspended accounts cannot keep a session.

## Roles

| Role | Access |
| --- | --- |
| `owner` | Full admin, grant Owner/Admin |
| `admin` | Users, places, moderation; cannot grant Owner/Admin or demote the last Owner |
| `editor` | Places, collections, featured |
| `moderator` | Reports, posts, comments |
| `user` / `creator` | Product only |

Checks run in server actions and `/admin` layout. Frontend hiding is not sufficient.

## Deploy checklist

- [ ] `APP_URL` and `NEXT_PUBLIC_APP_URL` are the real production origin
- [ ] Supabase migrations 00013 and 00014 applied
- [ ] `INITIAL_OWNER_EMAIL` used once, then reviewed
- [ ] SMTP + email confirmations on
- [ ] Google OAuth off until credentials exist
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only on the server
- [ ] Storage buckets `place-media`, `avatars`, `experience-media` unchanged
- [ ] Production build, lint, and tests pass
- [ ] Smoke: signup, verify, login, reset, report, `/admin` 403 for a normal user
