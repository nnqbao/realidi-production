# Realidi

Session brief for agents. Read this before exploring the tree.

Social-first network for **real-world experiences**, Ho Chi Minh City first.
Product name in the UI is **Realidi**. Identifiers stay English. Primary copy is Vietnamese.

It is not TikTok, Google Maps, Tripadvisor, or a generic AI itinerary planner.

**Git:** `origin` is https://github.com/kingrubic/realidi-production (`main`).
Do not push to `vuta97/realidi`. That remote was removed on purpose.

**Owner / operator:** VSC (software engineer). This checkout runs on a Mac Mini
with Colima, LaunchAgents, and a Cloudflare tunnel aimed at the local web port.

---

## Current runtime state (read this first)

The app is **mid-cutover** from Supabase to loopback self-hosted Convex.

| Layer | Source of truth today |
| --- | --- |
| Login, signup, email OTP, reset, sessions, account deletion, profile provision, onboarding catalog, `/me` | **Convex Auth + `convex/profiles.ts` / `account.ts` / `sessions.ts`** |
| Catalog, discovery, search, place pages, map pins, home/explore feed reads, saved places | **Convex** (`convex/catalog.ts`, `places.ts`, `discovery.ts`, `search.ts`, `curation.ts`, `feed.ts`, `flags.ts`) |
| Writes for experiences, social graph, verification, media, messages, most `/admin` | **Still Supabase** (`lib/supabase/*`). Do **not** delete those modules. |

Migration plan (do not skip phases): `docs/plans/2026-09-03-supabase-to-local-convex.md`

- **Phases 0–4: done.** Auth plus public catalog/discovery/search/feed reads.
- **Phase 5+:** experiences, social, verification, media, then messaging/admin.

---

## Product thesis

Mood-based discovery + verified visits + structured experience data should beat
generic search, star ratings, and social hype.

Core loop: mood → discover → place → save / visit intent → visit → write
experience → rate → verify → structured aggregates → better discovery.

Optimize for useful decisions, not watch time, followers, or likes.

Primary metric: **Meaningful Discovery Rate** (open a place, then Save /
Directions / Been There). Events go to `product_events` via `lib/analytics`.
Do not scatter vendor SDKs in components.

---

## Stack

- Next.js **16.3** App Router (this is not the Next.js you remember — read
  `node_modules/next/dist/docs/` before new APIs). Middleware is **`proxy.ts`**.
- React 19 · TypeScript · Tailwind 4 · Zod
- **Convex 1.45** self-hosted + `@convex-dev/auth` **0.0.95**
- Leftover Supabase (`@supabase/ssr`) for Phase 5+ writes and admin
- Vitest · Playwright · Colima Docker

---

## Directory map

```
app/                      Routes. (app) group = product chrome.
app/ConvexClientProvider.tsx
proxy.ts                  Convex Auth cookie refresh + /api/auth proxy (Next 16).
features/auth/            Server actions (export names are frozen by contract tests).
features/onboarding/
lib/auth/session.ts       getSessionUser() via api.profiles.current + JWT cookie.
lib/convex/               server.ts always passes token + NEXT_PUBLIC_CONVEX_URL.
lib/supabase/             Still required for Phase 5+ writes and admin. Keep it.
convex/                   Backend: auth, profiles, catalog, places, discovery, search, feed.
convex/_providers/        Forked Password + Email OTP (lockout, anti-enumeration).
convex/_lib/              authz, geo, search, ranking copies, uniqueness, audit.
compose.convex.yml        Loopback backend :3222, site :3223, dashboard :6799, Mailpit.
scripts/convex-*.sh       Local platform (up/health/admin key/auth env).
scripts/realidi-*.sh      Mac Mini LaunchAgent entrypoints (web + Convex ensure).
docs/plans/               Migration plan and phase gates.
tests/convex/             Auth/authz/schema/seed/geo/catalog/discovery/feed/search.
tests/contracts/          Frozen routes, action names, auth-compat.
e2e/auth-local.spec.ts    Signup → OTP → onboarding → reset → login → /me.
e2e/guest-discover.spec.ts Guest /home + /explore after Phase 4.
```

---

## Auth (do not regress)

Cookies: `__convexAuthJWT` / `__convexAuthRefreshToken` (HttpOnly, Lax).
Library sets them through **`useAuthActions().signIn()` → POST `/api/auth`**,
which `proxy.ts` forwards. Writing cookies only from a server action +
`redirect()` has already failed once; keep the official client sign-in path.

Session: `lib/auth/session.ts`. `user.id` is the **Convex profile id**.
`getSessionUser()` returns null if the JWT cannot be validated.

JWT issuer is `http://127.0.0.1:3223`. The Convex container cannot fetch that
host port. `site-loopback` in Compose (socat) forwards container
`127.0.0.1:3223` → site `3211`. Without it, Next logs
`AuthProviderDiscoveryFailed` and every signed-in RSC looks logged out.

Vendored Password provider (`convex/_providers/Password.ts`):

- 8 failures / 15 minutes lockout, including unknown emails
- Reset/verify responses do not reveal whether the address exists
- Mail is scheduled, not awaited
- 8-digit OTP, 15 min, hashed, verify vs reset codes are not interchangeable
- 3 code requests / 15 min / purpose (`auth_code_requests`)

`@convex-dev/auth` 0.0.95 does not do lockout or anti-enumeration by itself.
`tests/contracts/convex-auth-compatibility.test.ts` pins the fork. Re-check
that file before upgrading the package.

Callbacks in `convex/auth.ts`:

- `afterUserCreatedOrUpdated` → `provisionProfile` (profile + prefs + default collection)
- `beforeSessionCreation` blocks deleted / banned / suspended
- Unverified users may hold a session; `requireVerifiedProfile` blocks product writes

Auth action **export names** in `features/auth/actions.ts` are frozen by
`tests/contracts/route-surface.test.ts`. `/auth/callback` must keep existing
as a file (it now just redirects expired).

Presence still used to call Supabase from the client. `PresenceProvider`
must no-op when Supabase env is empty, or signed-in Convex users crash the
app error boundary.

Google OAuth is out of scope. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`.

Details: `AUTH_ADMIN.md`.

---

## Ports (this Mac Mini)

Planned plan ports `3220`/`3221`/`6792` are taken by SSH. Used instead:

| Bind | What | Cloudflare? |
| --- | --- | --- |
| `127.0.0.1:3020` | Next.js production (`next start`) | **Yes — tunnel this** |
| `127.0.0.1:3222` | Convex backend | No (loopback) |
| `127.0.0.1:3223` | Convex HTTP / OIDC / JWKS | No |
| `127.0.0.1:6799` | Convex dashboard | No |
| `127.0.0.1:8026` | Mailpit UI | No |
| `127.0.0.1:1026` | Mailpit SMTP on host (container 1025) | No |

`3000` is **another project** (`bemi-agent-world`). Do not steal it.

`NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3222` is baked into the Next build.
A visitor hitting only a public Next URL still cannot reach Convex unless
`3222`/`3223` are also tunneled and the public Convex URLs are rebuilt.

Docker via **Colima**: `DOCKER_HOST=unix:///Users/vsc_agent/.colima/default/docker.sock`.

---

## Mac Mini process supervision

LaunchAgents (user `vsc_agent`, need that user logged in):

- `~/Library/LaunchAgents/ai.realidi.convex.plist` → `scripts/realidi-convex-ensure.sh`
  (start/restart Colima + `compose.convex.yml`)
- `~/Library/LaunchAgents/ai.realidi.web.plist` → `scripts/realidi-web.sh`
  (`next start --hostname 127.0.0.1 --port 3020`)

Logs: `~/.openclaw/logs/ai.realidi.web.log` and `ai.realidi.convex.log`.

After code change:

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/ai.realidi.web
```

Local one-shot (without launchd):

```bash
cp .env.example .env.local   # then fill ignored secrets
npm install
./scripts/convex-local.sh up
./scripts/convex-admin-key.sh
./scripts/convex-auth-env.sh
npm run convex:deploy:local
npm run convex:seed
npm run build
npm start -- --hostname 127.0.0.1 --port 3020
# or: npm run dev -- --port 3020
```

Never commit `.env.local`. It holds `CONVEX_SELF_HOSTED_ADMIN_KEY`.

---

## Roles and gates

Roles: `user`, `creator`, `moderator`, `editor`, `admin`, `owner`.
Hiding a button is not authorization. Convex uses `convex/_lib/authz.ts`
(`requireIdentity`, `requireVerifiedProfile`, capability helpers).
Staff UI is `/admin`. First owner: `INITIAL_OWNER_EMAIL` compared
server-side once; writes `owner.bootstrap` audit. Last owner cannot be
demoted/deleted.

Account gates: `ok` | `unverified` | `suspended` | `banned` | `deleted`.

---

## Domain rules that must not drift

- Guests can browse discover/search/public places and published posts.
- Followers-only / private / hidden content stays gated.
- Ranking is deterministic (`lib/ranking`): mood 45, trust 20, freshness 15,
  proximity 10, quality engagement 10. No LLM. No watch-time / follower inputs.
- Places store `latitude_e6` / `longitude_e6`. One Haversine helper. Visit
  verification stores distance + accuracy + result, never raw GPS.
- Moods are DB taxonomy (`desired_feeling`, `current_state`), not hardcoded.
- `lib/ai/` is an empty boundary. Do not call an LLM for recommendations.
- Launch city HCMC, VND, `Asia/Ho_Chi_Minh`.

---

## Tests (do not weaken to match a broken backend)

```bash
npm run test          # 178 unit tests last green (contracts + convex + ranking/geo)
npm run typecheck
npm run lint          # generated convex/_generated may warn; 0 errors required
npm run build
npx playwright test e2e/auth-local.spec.ts e2e/guest-discover.spec.ts
```

Auth e2e talks to Mailpit at `http://127.0.0.1:8026`. Guest discover e2e
hits `/home` and `/explore` on Convex reads (empty feed chrome is enough).

---

## Agent conventions

- Next.js 16: `proxy.ts`, not `middleware.ts`.
- Prefer existing design system and Vietnamese UI copy.
- Do not delete `lib/supabase/*` or product routes “to finish Convex”.
- Do not invent demo passwords or commit keys.
- Do not force-push `main`.
- After UI changes, verify in a browser or Playwright, not a single screenshot.

## Intentionally not in the MVP

Travel DNA UI, AI place recs, trip planner, buddy matching, booking, sponsored
ranking, public creator leaderboards.
