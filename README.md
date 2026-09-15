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

The app is **Convex-only**. Historical SQL lives under `database/supabase-archive/`
and is not a runtime.

| Layer | Source of truth today |
| --- | --- |
| Login, signup, email OTP, reset, sessions, account deletion, profile provision, onboarding catalog, `/me` | **Convex Auth + `convex/profiles.ts` / `account.ts` / `sessions.ts`** |
| Catalog, discovery, search, place pages, map pins, home/explore feed reads, saved places | **Convex** (`convex/catalog.ts`, `places.ts`, `discovery.ts`, `search.ts`, `curation.ts`, `feed.ts`, `flags.ts`) |
| Experience create, social graph, verification, notifications, analytics, media | **Convex** (`convex/experiences.ts`, `social.ts`, `verification.ts`, `notifications.ts`, `analytics.ts`, `files.ts`) |
| Messages, reactions, invites, blocks, presence, typing | **Convex** (`convex/messages.ts`, `presence.ts`, `safety.ts`) |
| Admin, moderation, editorial CMS, CSV import, audit, user lifecycle | **Convex** (`convex/admin.ts`, `moderation.ts`, `editorial.ts`, `imports.ts`) |

Migration plan (historical): `docs/plans/2026-09-03-supabase-to-local-convex.md`

- **Phases 0–8: done.** Convex is the only application data plane.

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
- **Convex 1.45 Cloud** (`prod:zany-lyrebird-546`) + `@convex-dev/auth` **0.0.95**
- Vitest · Playwright

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
convex/                   Backend: auth, catalog, feed, social, messages, admin, moderation, editorial, imports.
database/supabase-archive/ Historical SQL only. Do not run.
convex/_providers/        Forked Password + Email OTP (lockout, anti-enumeration).
convex/_lib/              authz, geo, search, ranking copies, uniqueness, audit.
compose.convex.yml        Retired local Docker stack. Do not start; other projects share Colima.
scripts/convex-*.sh       Cloud deploy/health/auth env. `convex-local.sh up` is refused.
scripts/realidi-*.sh      Web LaunchAgent only. Local Convex ensure is a no-op.
docs/plans/               Migration plan and phase gates.
tests/convex/             Auth/authz/schema/seed/geo/catalog/discovery/feed/search/experiences/social/messages/admin.
tests/contracts/          Frozen routes, action names, auth-compat.
e2e/auth-local.spec.ts    Signup → OTP → onboarding → reset → login → /me.
e2e/guest-discover.spec.ts Guest /home + /explore after Phase 4.
e2e/messages-local.spec.ts Guest /messages empty-state after Phase 6.
e2e/admin-moderate.spec.ts Skips unless E2E_ADMIN_EMAIL is set.
e2e/roles-local.spec.ts   Guest plus optional role smokes from ignored env.
```

---

## Auth (do not regress)

Cookies: `__convexAuthJWT` / `__convexAuthRefreshToken` (HttpOnly, Lax).
Library sets them through **`useAuthActions().signIn()` → POST `/api/auth`**,
which `proxy.ts` forwards. Writing cookies only from a server action +
`redirect()` has already failed once; keep the official client sign-in path.

Session: `lib/auth/session.ts`. `user.id` is the **Convex profile id**.
`getSessionUser()` returns null if the JWT cannot be validated.

JWT issuer is `https://zany-lyrebird-546.convex.site` (Convex Cloud HTTP
actions / OIDC). The Next app talks to
`https://zany-lyrebird-546.convex.cloud`.

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

Presence and typing write Convex `profiles` / `conversation_typing`. Do not
reintroduce a client heartbeat against another backend.

Google OAuth is out of scope. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false`.

Details: `AUTH_ADMIN.md`.

---

## Ports (this Mac Mini)

Next.js stays on `3020` because `3000` is another project. Convex Cloud
does not bind local ports:

| Bind | What | Cloudflare? |
| --- | --- | --- |
| `127.0.0.1:3020` | Next.js production (`next start`) | **Yes — tunnel this** |
| Convex Cloud | `https://zany-lyrebird-546.convex.cloud` | n/a (public Convex) |
| Convex Cloud HTTP / OIDC | `https://zany-lyrebird-546.convex.site` | n/a |

`3000` is **another project** (`bemi-agent-world`). Do not steal it.

`NEXT_PUBLIC_CONVEX_URL=https://zany-lyrebird-546.convex.cloud` is baked into
the Next build. Rebuild after changing that URL.

Do not start `compose.convex.yml`. Colima stays up for other projects on this
Mac Mini; Realidi no longer uses it.

---

## Mac Mini process supervision

LaunchAgents (user `vsc_agent`, need that user logged in):

- `~/Library/LaunchAgents/ai.realidi.web.plist` → `scripts/realidi-web.sh`
  (`next start --hostname 127.0.0.1 --port 3020`, waits for Convex Cloud)
- `~/Library/LaunchAgents/ai.realidi.convex.plist` is **disabled**. The ensure
  script is a no-op and must not start Colima or Docker.

Logs: `~/.openclaw/logs/ai.realidi.web.log`.

After code change:

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/ai.realidi.web
```

Local one-shot (without launchd):

```bash
cp .env.example .env.local   # then fill ignored CONVEX_DEPLOY_KEY
npm install
./scripts/convex-auth-env.sh
npm run convex:deploy
npm run convex:seed
npm run build
npm start -- --hostname 127.0.0.1 --port 3020
# or: npm run dev -- --port 3020
```

Never commit `.env.local`. It holds `CONVEX_DEPLOY_KEY`.

---

## Roles and gates

Roles: `user`, `creator`, `moderator`, `editor`, `admin`, `owner`.
Hiding a button is not authorization. Convex uses `convex/_lib/authz.ts`
(`requireIdentity`, `requireVerifiedProfile`, capability helpers).
Staff UI is `/admin`. First owner: `INITIAL_OWNER_EMAIL` compared
server-side once; writes `owner.bootstrap` audit. Last owner cannot be
demoted/deleted.

Account gates: `ok` | `unverified` | `suspended` | `banned` | `deleted`.
A profile with `must_change_password` can hold a session but is redirected
to `/change-password` and blocked from product/admin capabilities until
the password is replaced.

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
npm run test          # 218 unit tests last green (contracts + convex + ranking/geo)
npm run typecheck
npm run lint          # generated convex/_generated may warn; 0 errors required
npm run build
npx playwright test e2e/auth-local.spec.ts e2e/guest-discover.spec.ts e2e/messages-local.spec.ts
```

Auth e2e that expects Mailpit is historical. Guest discover e2e hits `/home`
and `/explore` on Convex Cloud reads (empty feed chrome is enough).

---

## Agent conventions

- Next.js 16: `proxy.ts`, not `middleware.ts`.
- Prefer existing design system and Vietnamese UI copy.
- Do not invent demo passwords or commit keys.
- Do not treat `database/supabase-archive/` as a runtime.
- Do not force-push `main`.
- After UI changes, verify in a browser or Playwright, not a single screenshot.

## Intentionally not in the MVP

Travel DNA UI, AI place recs, trip planner, buddy matching, booking, sponsored
ranking, public creator leaderboards.
