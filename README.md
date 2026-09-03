# Realidi

Social-first network for real-world experiences. Ho Chi Minh City first.

Realidi helps people answer: **where should I go based on how I want to feel, my time, budget, distance, and the real experiences of people who have actually been there?**

This is not a TikTok clone, not Google Maps, not Tripadvisor, and not a generic AI itinerary planner.

Product name in the UI: **Realidi**. Code and identifiers stay in English. Primary copy is Vietnamese.

## Product thesis

Mood-based discovery + verified real-world experiences + structured experience data can help people choose places better than generic destination search, star ratings, or social-media hype.

Core loop:

Select mood → Discover experiences → Open place → Save / visit intent → Visit → Create experience → Rate → Verify visit → Structured data → Better discovery.

Optimize for useful travel decisions, not watch time, followers, or likes.

## Architecture

```
app/                 Next.js App Router (UI + SEO routes)
components/          Design system primitives + shell
features/            Domain modules (auth, discovery, places, experiences, verification, social, admin)
lib/
  supabase/          Browser, server, service-role clients
  ranking/           Deterministic explainable ranking (no LLM)
  geo/               Haversine, geofence, Mapbox adapter
  analytics/         Provider interface (console | posthog | none) + first-party events
  media/             Validation, compression, future video processing boundary
  ai/                Empty future boundary — do not call an LLM for recommendations
  i18n/              vi (default) + en dictionaries
  validation/        Zod
supabase/migrations  PostgreSQL + PostGIS + RLS
supabase/seed.sql    HCMC editorial inventory
```

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Zod · React Hook Form-ready · Supabase (Auth, Postgres, Storage, RLS) · PostGIS · Vitest · Playwright.

## Hypotheses the MVP can measure

| ID | Hypothesis | Events |
| --- | --- | --- |
| H1 | Mood discovery produces stronger save/visit intent than category search | `mood_selected`, `discovery_viewed`, `place_opened`, `place_saved`, `directions_clicked` |
| H2 | Verified content creates more trust and intent than unverified | `verification_*`, save uplift vs `verification_status` |
| H3 | Structured attributes beat a generic star | experience metrics + place aggregates, not a single rating |

Primary metric: **Meaningful Discovery Rate** — share of discovery sessions that open a place and then Save, Directions, or Been There.

North-star candidate: Save → Verified Visit conversion.

Events are written to `product_events` (first-party) and optionally forwarded through `lib/analytics`. Do not scatter vendor SDKs in components.

## Local setup

```bash
cp .env.example .env.local
# fill Supabase keys (and Mapbox if you want static maps)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Guests can browse Discover without an account. If env vars are missing, Discover shows a setup state instead of pretending the product works.

## Supabase setup

1. Create a project (region close to Vietnam, e.g. Singapore).
2. Enable the **PostGIS** extension (`extensions.postgis`).
3. Run `supabase/migrations/*.sql` in order (SQL editor or CLI).
4. Run `supabase/seed.sql` for moods, styles, categories, and 22 HCMC places.
5. Create storage buckets if the storage migration did not: `avatars`, `experience-media`, `place-media`.
6. Optional demo social graph:

```bash
npm run seed
```

Demo admin (after seed-demo): `admin@felt.local` / `FeltDemo!2026` — promote via Admin → Users if the trigger left the role as `user` (role is never taken from client metadata).

### Google login

Architecture is in place (`signInWithOAuth({ provider: "google" })`). Enable the Google provider in the Supabase dashboard, add the redirect URL `/auth/callback`, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Until then the button is hidden and the limitation is documented in the login UI.

### Mapbox

Set `NEXT_PUBLIC_MAPBOX_TOKEN` for the interactive map. Directions always open an external maps URL. If the token is missing, Realidi hides Map from primary navigation and does not fake a map.

## Environment variables

See `.env.example`. Never commit secrets. Never put `SUPABASE_SERVICE_ROLE_KEY` in client code.

## Database

UUID keys, FKs, spatial index on `places.location`, trigram search on names, RLS on every exposed table.

Moods are **database-driven** (`moods` with layers `desired_feeling` and `current_state`). Experience styles are a separate taxonomy. Admin can create/edit/activate/reorder.

Places are a canonical entity with provider fields (`external_provider`, `external_provider_id`) but no tight coupling to Mapbox or Google. Status includes `merged` for future duplicate handling.

Aggregates (`place_mood_stats`, `place_experience_stats`, `place_crowd_stats`, `place_cost_stats`) are refreshed by `refresh_place_aggregates` — not computed on every page load. Low-n data shows **Tín hiệu sớm**, never `92.37%`.

Future tables exist as stubs: `travel_dna_profiles`, `creator_reputation`.

## Ranking

Deterministic. Default weights (admin-editable in `/admin/ranking`, stored in `ranking_config`):

- 45% mood match (Bayesian-smoothed)
- 20% trust (verified ratio + verified volume)
- 15% freshness
- 10% proximity (neutral 0.5 if no location)
- 10% quality engagement: Save > Been There > Share > Like

Watch time and follower count are not inputs. Documented in `lib/ranking/ALGORITHM.md`. Covered by `tests/ranking.test.ts`.

## Verification

On-site geofence. Default radius 150 m (configurable). The client sends coordinates once; the server computes distance, stores **distance + accuracy + result**, and discards raw GPS. Unverified is labelled “Trải nghiệm chưa xác minh”, never “fake”.

Covered by `tests/geo.test.ts`.

## Auth and roles

One identity. Roles: `user`, `creator`, `moderator`, `admin`. Authorization is RLS + server actions (`lib/auth/roles.ts`). Hiding a button is not access control. Staff UI is `/admin`.

## Routes

| Path | Notes |
| --- | --- |
| `/discover` | Mood home |
| `/search` | Place + category search |
| `/place/[slug]` | Experience intelligence page, SEO |
| `/create` | 4-step experience composer |
| `/saved` | Default collection (schema-ready for future lists) |
| `/experience/[id]` | Public experience, SEO |
| `/user/[username]` | Profile |
| `/onboarding` | 5–6 skippable questions, never forced on guests |
| `/login` `/signup` `/reset-password` | Auth |
| `/admin/*` | Staff |

## Testing

```bash
npm run test        # unit: ranking, geo, authz, validation
npm run typecheck
npm run lint
npm run test:e2e    # Playwright; full user/admin flows need E2E_* env vars
```

## Deployment

Deploy the Next.js app (Vercel or similar) with the same env vars. Point `APP_URL` and `NEXT_PUBLIC_APP_URL` at the production origin (not a temporary Cloudflare hostname). Apply migrations to the production Supabase project before first traffic. See `AUTH_ADMIN.md` for Owner bootstrap, email, OAuth, and the post-deploy checklist.

## Admin access

`/admin` is denied unless `profiles.role` is `moderator`, `editor`, `admin`, or `owner`. Bootstrap the first Owner with `INITIAL_OWNER_EMAIL` (see `AUTH_ADMIN.md`).

## Project principles

1. Decision value > engagement vanity.
2. Verified does not mean unverified is fake.
3. Mood is a discovery input, not a diagnosis.
4. Structured data beats another content format.
5. Do not sell organic ranking.
6. Trust stays visible when monetization arrives later.
7. AI is a future intelligence layer, not the product.
8. High-confidence data ranks above high-volume hype.
9. Density before geographic coverage (HCMC first).
10. Build the data flywheel before advanced AI.

## Intentionally not in this MVP

Travel DNA UI, Travel Match Score, AI place recommendation, conversational search, trip planner, live assistant, buddy matching, group planner, Wrapped, creator marketplace, booking, sponsored placement, public creator leaderboards.

`lib/ai/` exists so those features cannot accidentally become “ask ChatGPT where to go.” They must be grounded in Realidi’s proprietary graph when enabled via feature flags.

## Assumptions

- Launch city: Ho Chi Minh City. Currency VND. Timezone `Asia/Ho_Chi_Minh`.
- Cover photos in seed data are Unsplash editorial placeholders until `place-media` uploads exist.
- Draft experience media is in a public bucket with unguessable paths; private signed URLs can replace this later.
- Rate limits are in-memory per instance (good enough for MVP; swap for Redis at scale).
