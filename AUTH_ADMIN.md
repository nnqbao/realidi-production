# Authentication and Admin Console

The web application now authenticates through **Convex Auth** (HTTP-only
cookies `__convexAuthJWT` / `__convexAuthRefreshToken`). Supabase clients remain
only for product data that Phase 4+ has not moved yet.

`@convex-dev/auth` 0.0.95 cannot meet two of the requirements on its own: its
Password provider has no failed-credential callback for a persistent lockout,
and its reset path reveals whether an address is registered. Both are addressed
by the vendored provider in `convex/_providers/Password.ts`, documented in
`convex/_providers/NOTICE.md` and pinned by
`tests/contracts/convex-auth-compatibility.test.ts`. Upgrading the package
requires re-checking that file.

## Convex authentication backend

| Capability | Function |
| --- | --- |
| Register, sign in, verify, reset | `auth:signIn` flows `signUp`, `signIn`, `email-verification`, `reset`, `reset-verification` |
| Sign out the current session | `auth:signOut` |
| Change password | `account:changePassword` |
| List sessions | `sessions:list` |
| Revoke other / all / one session | `sessions:revokeOthers`, `sessions:revokeAll`, `sessions:revoke` |
| Current profile and account gate | `profiles:current` |

One-time codes are 8 digits, expire after 15 minutes, are stored only as a
SHA-256 hash, and are delivered out of band through Mailpit. A code issued for
a reset cannot be redeemed to verify an address, or the reverse.

## Local services

Start `./scripts/convex-local.sh up`, generate the ignored admin key with
`./scripts/convex-admin-key.sh`, then run `npm run convex:deploy:local`.
`./scripts/convex-auth-env.sh` writes the signing key pair, `SITE_URL`, and the
Mailpit SMTP settings into the deployment environment without printing them.
Auth requires `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` to be present; verify
with `curl --fail http://127.0.0.1:3223/.well-known/openid-configuration`.
The Compose `site-loopback` sidecar makes that same issuer reachable from
inside the backend container so JWT validation does not fail with
`AuthProviderDiscoveryFailed`.

## First Owner

1. Create a user via `/signup` (or invite in Supabase Auth).
2. Set `INITIAL_OWNER_EMAIL` to that user’s email.
3. Sign in once. If no owner row exists, the profile is promoted to `owner`.
4. Unset or rotate the env var after bootstrap if you prefer.

On Convex the comparison happens server-side inside the profile provisioning
transaction against the address held by the auth account, never against
client-supplied metadata, and it is skipped entirely once any owner exists.
The promotion writes an `owner.bootstrap` audit row.

Never commit that email into source. Do not hard-code demo passwords.

## Email

For the Supabase runtime, configure SMTP in the Supabase Auth dashboard;
confirmation and reset links must use the Site URL / redirect URLs matching
`APP_URL`.

The Convex backend sends through `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM`, which
point at the Mailpit container locally. Read delivered mail at
<http://127.0.0.1:8026>. Sends are scheduled rather than awaited, so a request
takes the same time whether or not an address exists; a delivery failure is
visible only in the Convex logs and in Mailpit, never in the API response.

Code requests are throttled to 3 per address per 15 minutes per purpose
(`auth_code_requests`) so the endpoints cannot be used to flood an inbox. A
throttled request returns the same success shape as an accepted one.

Google OAuth is out of scope for the local Convex migration. The current
Supabase flag remains dormant until a completed final cutover removes it.

## Session

Cookies: `HttpOnly`, `SameSite=Lax`, `Secure` in production. Login failures
lock after 8 attempts for 15 minutes (`auth_lockouts`), counted for unknown
addresses too so probing cannot skip the gate. Banned, deleted, and actively
suspended accounts cannot obtain or keep a session; an expired suspension
recovers automatically. Unverified accounts can hold a session in order to
finish verification but fail `requireVerifiedProfile`, so they cannot use
product capabilities.

Changing a password requires re-proving the current one, and can optionally
revoke the other sessions. Completing a reset always revokes every session
except the one that performed it.

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
- [ ] Supabase migrations 00013 and 00014 applied for the current runtime
- [ ] Self-hosted Convex foundation healthy and functions deployed
- [ ] `INITIAL_OWNER_EMAIL` used once, then reviewed
- [ ] SMTP + email confirmations on
- [ ] Google OAuth remains disabled
- [ ] Convex admin/auth keys remain ignored and server-only
- [ ] Avatar, experience, place, and message media policies verified
- [ ] Production build, lint, and tests pass
- [ ] Smoke: signup, verify, login, reset, report, `/admin` 403 for a normal user
