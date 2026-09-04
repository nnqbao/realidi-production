# Supabase to local self-hosted Convex migration plan

Date: 2026-09-03  
Repository baseline: `fc0023e16daadf745072e7a4b32396a913b7a6bb` on `main`  
Scope: replace Supabase Auth, Postgres/PostGIS, Storage, RLS, RPCs, triggers, and Realtime with a loopback-only self-hosted Convex deployment. This is a cutover, not a hybrid runtime.

## Architecture decision

Use the open-source Convex backend and dashboard in a repository-scoped Docker Compose stack:

- Backend: container port `3210`, host `127.0.0.1:3220`.
- HTTP actions/site proxy: container port `3211`, host `127.0.0.1:3221`.
- Dashboard: container port `6791`, host `127.0.0.1:6792`.
- Mailpit for local reset/verification mail: SMTP `127.0.0.1:1026`, UI `127.0.0.1:8026`.
- A named Docker volume stores Convex state. Images must be pinned to a tested release/digest; do not use `latest` in the committed Compose file.
- The Compose healthcheck calls the backend `/version` endpoint. The dashboard and Mailpit depend on healthy services.
- `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3220`, `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3220`, and `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3221` are local endpoints. On the known Docker Desktop IPv4 admin-key failure, the CLI-only self-hosted URL may use `http://[::1]:3220`; browser URLs remain IPv4 loopback.

Use `convex` plus `@convex-dev/auth` with its Password provider and Next.js integration:

- `ConvexAuthNextjsServerProvider` wraps the existing root layout without discarding the current uncommitted `ReactNode` correction.
- `ConvexAuthNextjsProvider` owns the browser `ConvexReactClient`.
- `convexAuthNextjsMiddleware` replaces Supabase cookie refresh and handles the `/api/auth` bridge.
- Server Components use `fetchQuery`/`preloadQuery`; Server Actions and Route Handlers use `fetchMutation`/`fetchAction`. Every authenticated call passes `await convexAuthNextjsToken()` and the self-hosted URL option.
- Client Components use generated `api` references and `useQuery`/`useMutation` for reactive screens.
- Refresh credentials stay in the Convex Auth Next.js HttpOnly-cookie flow. Do not recreate the current Supabase token handling or put refresh tokens in application `localStorage`.
- Email/password supports sign-up, verification, sign-in, sign-out, password reset, authenticated password change, current/other/all-session invalidation, and generic anti-enumeration responses. Mailpit provides actual local delivery; no verification/reset code is returned by an API response or committed as a demo secret.

Convex is the only application data plane:

- `convex/schema.ts` defines all 52 active domain tables and imports the Convex Auth tables.
- Domain fields retain the current snake_case DTO names where practical, minimizing UI churn. Convex document `_id` values are returned as `id`; all relations use typed `Id<...>` internally.
- Seed records use stable `seed_key`/slug indexes. Imported legacy rows may retain an indexed `legacy_id`, but runtime joins never use UUID strings.
- SQL constraints, foreign keys, triggers, and RLS become validators plus transactional mutations. A mutation validates references and uniqueness before writing all related rows and counters atomically.
- Public functions are thin capability endpoints. Shared internal helpers establish identity, account state, ownership, role, relationship, and target visibility before any read or write.
- No client-supplied `user_id`, `author_id`, `actor_id`, role, counter, moderation state, or verification result is trusted.

Geospatial behavior is deterministic and privacy-preserving:

- Places store validated `latitude_e6` and `longitude_e6` integers, plus city/status indexes. Convert to degrees only inside the shared Haversine helper.
- Discovery first selects a bounded city/status candidate set, then computes distance with the same Earth radius (`6_371_000 m`) and coordinate validation as `lib/geo/distance.ts`.
- Nearby results sort by distance, then normalized place name, then Convex ID. Ranking receives the same rounded distance for every caller.
- Visit verification computes distance server-side and persists only distance, accuracy, radius, confidence, and result. Raw user coordinates are never stored or logged.
- With the current 22-place HCMC seed, a bounded city scan is correct and simpler than a lossy geohash. Add a spatial-cell index only when a checked-in city exceeds the documented candidate ceiling; the query must fail explicitly rather than silently omit candidates.

Storage uses Convex file storage:

- Clients request a short-lived upload URL from an authenticated mutation, upload directly, then call a finalize mutation.
- Finalization reads storage metadata, validates MIME, byte size, intended owner/capability, and target existence, and writes the domain media row atomically.
- Avatars are owner-write; experience media is post-author-write; place media is editor/admin/owner-write; message media is conversation-member-write.
- Read functions return generated URLs only after checking the domain object's visibility. Message media is always member-only. Draft experience media is author/staff-only instead of relying on an unguessable public URL.
- Deleting/replacing media verifies ownership or staff capability, removes the domain reference, and then deletes the storage object. Orphan cleanup is an internal scheduled mutation with an audit trail.

Realtime uses Convex subscriptions:

- Feed, notifications, conversations, message threads, reactions, invites, read state, and mute state use reactive queries.
- Presence and typing use dedicated, authenticated documents keyed by session/tab with `last_seen_at`/`expires_at`; queries ignore expired rows and a scheduled cleanup deletes them.
- Privacy is applied before presence data leaves Convex: `show_activity_status=false` returns no online/idle/last-active detail to other users.
- Blocking immediately removes messageability and suppresses notifications in both directions.

## Key risks and controls

| Risk | Control and required evidence |
| --- | --- |
| RLS semantics are lost during client rewrites | One shared authz module; every public function has a declared capability; table and negative-adjacent-role tests below must pass. |
| Convex Auth is treated as profile authorization | Identity maps to a profile server-side; role and account gates are loaded from Convex on every protected capability. |
| A ban leaves live sessions usable | Ban/deletion mutations call `invalidateSessions`; protected helpers reject banned/deleted/suspended identities even on an already-open connection. |
| Self-hosted secrets leak into Git or browser bundles | Generate the admin key inside the backend container, write it only to ignored `.env.local` with mode `0600`, never echo it, and scan Git/diffs for the key names and values. |
| Server Components become unauthenticated accidentally | A single `lib/convex/server.ts` wrapper always obtains/passes the Next.js token and self-hosted URL; direct `fetch*` imports outside that wrapper fail an architectural test. |
| PostGIS behavior changes ranking | Integer coordinates, one Haversine implementation, deterministic tie-breaking, fixture comparisons, boundary tests, and no raw GPS persistence. |
| Search degrades from trigram/TSVector | Convex search index over normalized name/district/address/description, explicit filters, accent/case fixtures, and current route contract tests. |
| Trigger-maintained counters/aggregates drift | All source mutations update counters transactionally; a deterministic recompute mutation and invariant tests compare stored versus source-derived values. |
| Upload URL possession bypasses authorization | Authorization both before URL generation and at finalize/read/delete; unfinalized uploads expire and are cleaned up. |
| Convex table scans exceed limits | Every list path has a named index/search index, pagination, and an asserted candidate bound; tests seed over one page. |
| Migration scope creates unreviewable changes | Dependency-ordered slices and non-overlapping worker lanes; shared integration files have one owner. |
| Existing uncommitted work is overwritten | Capture a path-scoped baseline patch; never use `git reset --hard` or blanket checkout; preserve `app/layout.tsx` and `package-lock.json` changes. |

## Non-negotiable behavioral contracts

1. Guests can browse `/discover`, `/search`, active/temporarily-closed places, published public posts, active taxonomy, public aggregates, and published editorial placements.
2. Followers-only posts require an accepted follower relationship; private posts are author/staff only. Hidden/deleted/moderated content remains visible only to its author where currently intended and to the appropriate moderator capability.
3. `owner`, `admin`, `editor`, and `moderator` are not interchangeable: moderation, place/editorial management, user management, role assignment, ranking/flags, and audit access retain their current distinctions.
4. A normal user cannot choose a role, author/actor ID, verification result, counter, recipient, conversation membership, or moderation status.
5. Deleted, banned, and actively suspended users cannot create or retain an authorized session. Expired suspensions recover automatically. Unverified users can complete verification but cannot use authenticated product capabilities.
6. The last owner cannot be demoted, suspended, banned, or deleted. Admin cannot grant or revoke `owner`/`admin`; only owner can do so.
7. Direct messages are unique per unordered user pair; self-DM and either-direction block are rejected.
8. A message, reply, reaction, invite, media object, typing marker, read marker, or conversation setting is visible/mutable only to a current participant, with sender/recipient restrictions described in the matrices.
9. Notification creation derives actor from the session, rejects self-notification, suppresses blocked pairs, and deduplicates by event key and message ID transactionally.
10. Audit records are append-only; neither public nor staff APIs expose update/delete.
11. Raw verification coordinates, password hashes, reset codes, session tokens, admin keys, and private message-media URLs never appear in logs, analytics, public queries, or Git.
12. Existing route paths and Vietnamese user-visible behavior remain. No route shows a success state backed by a no-op.

## Phased implementation

Each phase starts by saving a path-scoped patch in `/tmp/realidi-convex-checkpoints/` and recording `git status --short`. Checkpoint patches must exclude the pre-existing `app/layout.tsx` and `package-lock.json` changes until a phase intentionally integrates them. Roll back only the phase patch with `git apply -R`; never reset the whole worktree.

### Phase 0 — freeze contracts and baseline

Files to create:

- `tests/contracts/backend-surface.test.ts`
- `tests/contracts/route-surface.test.ts`
- `tests/fixtures/geo-parity.ts`
- `tests/fixtures/ranking-parity.ts`
- `tests/fixtures/security-principals.ts`

Files to modify:

- `package.json` — add `test:contracts`, `test:convex`, `convex:codegen`, `convex:deploy:local`, `convex:seed`, and `convex:verify` scripts without changing existing gates.
- `package-lock.json` — preserve the existing uncommitted delta and add only lockfile changes produced by the selected dependencies.
- `vitest.config.ts` — include contract and Convex test directories while retaining the Node environment.

Work:

- Capture existing route exports, action/query return shapes, enum values, ranking fixtures, Haversine edge cases, notification keys, presence formatting, and role predicates before replacing implementations.
- Assert the 52 active table names and four bucket behaviors represented in the parity matrix.
- Record current gates as baseline evidence; do not weaken a failing assertion to match the new backend.

Tests/commands:

```bash
git status --short
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:contracts
```

Expected evidence: the existing 89 tests and build gates remain green, contract fixtures are committed to deterministic values, and the two original uncommitted files remain present.  
Checkpoint/rollback: `/tmp/realidi-convex-checkpoints/phase-0.patch`; reversing it removes only new tests/scripts.

### Phase 1 — loopback self-hosted platform and secret workflow

Files to create:

- `compose.convex.yml`
- `.env.convex.example`
- `scripts/convex-local.sh`
- `scripts/convex-admin-key.sh`
- `scripts/convex-health.sh`
- `convex.json`

Files to modify:

- `.gitignore` — ignore `.env.convex`, `.env.convex.local`, Convex generated state/export directories, and local evidence artifacts; keep examples tracked.
- `.env.example` — replace Supabase variables with public backend/site URLs, server self-hosted URL, auth issuer/site origin, Mailpit SMTP settings, and owner/seed variables; do not include values for private/admin keys.
- `package.json`
- `package-lock.json`
- `README.md`
- `AUTH_ADMIN.md`
- `database/README.md`

Work:

- Pin backend/dashboard/Mailpit images, bind every published port to `127.0.0.1`, add persistent volume and healthchecks, and set `DISABLE_BEACON=true`.
- The key script runs `docker compose exec -T backend ./generate_admin_key.sh`, captures without printing, atomically updates only `CONVEX_SELF_HOSTED_ADMIN_KEY` in ignored `.env.local`, and sets mode `0600`.
- `convex-local.sh` supports `up`, `down`, `status`, and `logs` only; `down` never uses `--volumes`. Destructive volume removal requires a separate manual command documented as data loss.
- Install/pin compatible `convex`, `@convex-dev/auth`, local mail transport, and `convex-test` packages only during implementation.

Tests/commands:

```bash
docker compose -f compose.convex.yml config
docker compose -f compose.convex.yml up -d --wait
./scripts/convex-health.sh
./scripts/convex-admin-key.sh
test "$(stat -f '%Lp' .env.local)" = 600
curl --fail http://127.0.0.1:3220/version
curl --fail http://127.0.0.1:6792
curl --fail http://127.0.0.1:8026/api/v1/info
git check-ignore .env.local .env.convex.local
git diff --check
```

Expected evidence: healthy backend, dashboard, and Mailpit on only the declared loopback ports; restart preserves a sentinel document; no command prints the admin key.  
Checkpoint/rollback: stop with `docker compose -f compose.convex.yml down`, retain the named volume, and reverse only the phase patch.

### Phase 2 — schema, validators, authorization kernel, and deterministic seed

Files to create:

- `convex/schema.ts`
- `convex/validators.ts`
- `convex/auth.config.ts`
- `convex/auth.ts`
- `convex/http.ts`
- `convex/_lib/authz.ts`
- `convex/_lib/capabilities.ts`
- `convex/_lib/errors.ts`
- `convex/_lib/geo.ts`
- `convex/_lib/search.ts`
- `convex/_lib/time.ts`
- `convex/_lib/uniqueness.ts`
- `convex/_lib/audit.ts`
- `convex/_lib/aggregates.ts`
- `convex/seed.ts`
- `convex/seed/catalog.ts`
- `convex/seed/editorialPlaces.ts`
- `convex/seed/defaults.ts`
- `tests/convex/schema.test.ts`
- `tests/convex/authz-kernel.test.ts`
- `tests/convex/seed.test.ts`
- `tests/convex/geo.test.ts`

Files generated, never hand-edited:

- `convex/_generated/api.d.ts`
- `convex/_generated/api.js`
- `convex/_generated/dataModel.d.ts`
- `convex/_generated/server.d.ts`
- `convex/_generated/server.js`

Files to modify:

- `types/database.ts` — retain domain DTO/enums, add Convex ID/serialization types, and remove the Supabase `Database` client contract only after callers no longer require it.
- `lib/geo/distance.ts` — share fixture semantics with the server implementation.

Read-only source fixture:

- `supabase/seed.sql` — do not change it in this phase; use it to prove seed parity before archival.

Work:

- Define every matrix row with validators, reference checks, named indexes, uniqueness rules, timestamps, and status enums.
- Implement `optionalIdentity`, `requireIdentity`, `requireActiveProfile`, `requireVerifiedProfile`, `requireOwner`, `requireAdmin`, `requireModerator`, `requirePlaceManager`, `requireConversationMember`, and resource ownership/visibility helpers.
- Seed by stable keys in dependency order. Upsert taxonomy, ranking defaults, feature flags, 22 editorial HCMC places, place moods, and place styles. A second run must perform zero logical inserts and produce the same count/checksum.
- Demo users are created only when explicitly supplied ignored local environment values. No default email/password appears in source, output, docs, fixtures, or browser bundles.
- Recompute aggregate tables from source records; do not port trigger behavior as hidden side effects.

Tests/commands:

```bash
npx convex codegen
npx convex deploy
npm run test:convex -- tests/convex/schema.test.ts tests/convex/authz-kernel.test.ts tests/convex/geo.test.ts
npm run convex:seed
npx convex run seed:status
npm run convex:seed
npx convex run seed:status
npm run typecheck
```

Expected evidence: codegen/typecheck succeeds, all tables/indexes deploy locally, two seed-status outputs have identical counts/checksum, and negative capability tests cover every adjacent role.  
Checkpoint/rollback: export the empty/foundation deployment before seeding; reverse code/schema patch and restore the pre-seed named-volume snapshot if schema rollback is required.

### Phase 3 — authentication, profiles, onboarding, and account security

Files to create:

- `app/ConvexClientProvider.tsx`
- `lib/convex/server.ts`
- `lib/convex/client.ts`
- `lib/convex/result.ts`
- `convex/profiles.ts`
- `convex/account.ts`
- `convex/sessions.ts`
- `convex/authEmails.ts`
- `tests/convex/auth.test.ts`
- `tests/convex/account-security.test.ts`
- `e2e/auth-local.spec.ts`

Files to modify:

- `app/layout.tsx`
- `proxy.ts` (Next.js 16; replaces deprecated `middleware.ts`)
- `features/auth/actions.ts`
- `features/auth/security-actions.ts`
- `features/auth/login-form.tsx`
- `features/auth/signup-form.tsx`
- `features/auth/security-panel.tsx`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/reset-password/page.tsx`
- `app/reset-password/update/page.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/onboarding/page.tsx`
- `app/(app)/profile/edit/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/(app)/me/page.tsx`
- `app/(app)/user/[username]/page.tsx`
- `lib/auth/session.ts`
- `lib/auth/account.ts`
- `lib/auth/lockout.ts`
- `lib/auth/audit.ts`
- `lib/auth/roles.ts`
- `tests/authz.test.ts`
- `tests/auth-admin.test.ts`
- `tests/profile-edit.test.ts`

Files to delete after route-contract replacement passes:

- `app/auth/callback/route.ts`
- `lib/supabase/admin.ts`
- `lib/supabase/client.ts`
- `lib/supabase/cookies.ts`
- `lib/supabase/env.ts`
- `lib/supabase/middleware.ts`
- `lib/supabase/server.ts`

Work:

- Configure Password verification/reset mail through Mailpit. Normalize email, validate password policy, keep unknown/registered email responses indistinguishable, and rate-limit by normalized email plus request metadata.
- Create profile, preferences, and default saved collection transactionally after sign-up; derive role as `user`.
- First-owner bootstrap compares normalized server-side auth email with `INITIAL_OWNER_EMAIL`, requires no existing owner, promotes once in a mutation, writes audit, and never trusts metadata.
- Login enforces the persistent 8-fail/15-minute lockout, email verification, deletion, ban, suspension, and session invalidation gates.
- Password change requires current credentials. Reset/update and admin ban/delete invalidate the intended current/other/all sessions.
- Middleware handles only authentication transport/redirects; Convex functions remain the authorization boundary.

Tests/commands:

```bash
npm run test:convex -- tests/convex/auth.test.ts tests/convex/account-security.test.ts
npm run test -- tests/authz.test.ts tests/auth-admin.test.ts tests/profile-edit.test.ts
npm run typecheck
npm run lint
npm run build
npx playwright test e2e/auth-local.spec.ts
```

Expected evidence: Mailpit receives verification/reset messages; generic responses prevent enumeration; lockout timing and all session scopes pass; normal user cannot reach staff functions; the last-owner invariant passes.  
Checkpoint/rollback: keep the application on the Phase 2 data-only checkpoint until all auth browser tests pass; reverse Phase 3 as one patch if the auth bridge fails.

### Phase 4 — public catalog, discovery, search, curation, ranking, and feed reads

Files to create:

- `convex/catalog.ts`
- `convex/places.ts`
- `convex/discovery.ts`
- `convex/search.ts`
- `convex/curation.ts`
- `convex/ranking.ts`
- `convex/feed.ts`
- `convex/flags.ts`
- `tests/convex/catalog.test.ts`
- `tests/convex/discovery.test.ts`
- `tests/convex/feed.test.ts`
- `tests/convex/search.test.ts`

Files to modify:

- `features/mood/queries.ts`
- `features/places/queries.ts`
- `features/discovery/queries.ts`
- `features/discovery/actions.ts`
- `features/curation/queries.ts`
- `features/feed/queries.ts`
- `lib/search/index.ts`
- `lib/search/sanitize.ts`
- `lib/ranking/engine.ts`
- `lib/ranking/types.ts`
- `lib/feed-ranking/engine.ts`
- `lib/feed-ranking/types.ts`
- `lib/flags/index.ts`
- `app/api/feed/route.ts`
- `app/page.tsx`
- `app/(app)/discover/page.tsx`
- `app/(app)/search/page.tsx`
- `app/(app)/place/[slug]/page.tsx`
- `app/(app)/experience/[id]/page.tsx`
- `app/(app)/home/page.tsx`
- `app/(app)/explore/page.tsx`
- `app/(app)/map/page.tsx`
- `app/(app)/saved/page.tsx`
- `app/(app)/post/[id]/page.tsx`
- `app/(app)/user/[username]/page.tsx`
- `tests/ranking.test.ts`
- `tests/feed-ranking.test.ts`
- `tests/geo.test.ts`
- `tests/product-polish.test.ts`
- `e2e/guest-discover.spec.ts`
- `e2e/user-save.spec.ts`

Work:

- Keep public Server Components server-rendered with `fetchQuery`; use `preloadQuery` only where the client must remain reactive.
- Implement active/status visibility, merged-place redirect, accent/case-normalized search, deterministic pagination, current ranking formulas, “why this match,” public aggregate confidence, feed visibility, block/hidden filters, and saved/liked/following annotations.
- Search people excludes deleted/banned profiles and respects block relations.
- Reject oversized candidate sets explicitly and add indexes before raising the ceiling.

Tests/commands:

```bash
npm run test:contracts
npm run test:convex -- tests/convex/catalog.test.ts tests/convex/discovery.test.ts tests/convex/feed.test.ts tests/convex/search.test.ts
npm run test -- tests/ranking.test.ts tests/feed-ranking.test.ts tests/geo.test.ts tests/product-polish.test.ts
npx playwright test e2e/guest-discover.spec.ts e2e/user-save.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected evidence: guest route snapshots and fixture rankings match; private/followers/hidden posts do not leak; HCMC distance boundaries and stable ordering match fixtures.  
Checkpoint/rollback: reverse Phase 4 adapters/functions together; do not leave a route mixing Supabase and Convex reads.

### Phase 5 — experiences, social graph, verification, notifications, analytics, and media

Files to create:

- `convex/experiences.ts`
- `convex/social.ts`
- `convex/verification.ts`
- `convex/notifications.ts`
- `convex/analytics.ts`
- `convex/files.ts`
- `convex/crons.ts`
- `tests/convex/experiences.test.ts`
- `tests/convex/social.test.ts`
- `tests/convex/verification.test.ts`
- `tests/convex/notifications.test.ts`
- `tests/convex/storage.test.ts`

Files to modify:

- `features/experiences/actions.ts`
- `features/experiences/create-flow.tsx`
- `features/feed/components/CheckInFlow.tsx`
- `features/feed/components/PostComposer.tsx`
- `features/feed/components/PostMedia.tsx`
- `features/feed/components/save-post-button.tsx`
- `features/social/actions.ts`
- `features/social/comment-form.tsx`
- `features/social/comments-section.tsx`
- `features/social/follow-button.tsx`
- `features/social/like-button.tsx`
- `features/social/report-button.tsx`
- `features/social/share-button.tsx`
- `features/places/save-button.tsx`
- `features/places/want-to-go-button.tsx`
- `features/places/been-there-button.tsx`
- `features/verification/actions.ts`
- `features/verification/verify-button.tsx`
- `features/notifications/actions.ts`
- `features/notifications/list.tsx`
- `lib/signals/index.ts`
- `lib/media/index.ts`
- `lib/media/compress.ts`
- `lib/media/video.ts`
- `components/ui/user-avatar.tsx`
- `app/api/events/route.ts`
- `app/(app)/create/page.tsx`
- `app/(app)/notifications/page.tsx`
- `tests/experience.test.ts`
- `e2e/create-and-verify.spec.ts`

Work:

- Replace multi-call post creation with one mutation after finalized uploads, including media, mood ratings, metrics/question metadata, counters, aggregate refresh, and events.
- Implement save/want-to-go, been-there, follow, like, save-post, comments/replies, shares, recommendation feedback, hide, and report as idempotent transactional mutations.
- Recompute all place aggregate families after relevant publish/verify/moderate/delete changes.
- Notification creation is internal-only; callers provide target/event facts, while the server derives actor and enforces block/dedupe/self rules.
- Replace URL concatenation with authorized Convex storage URL resolution. Remove the unused video-processing no-op or implement an explicit “original stored, processing_status=ready” contract; no fake queued state is allowed.

Tests/commands:

```bash
npm run test:convex -- tests/convex/experiences.test.ts tests/convex/social.test.ts tests/convex/verification.test.ts tests/convex/notifications.test.ts tests/convex/storage.test.ts
npm run test -- tests/experience.test.ts
npx playwright test e2e/create-and-verify.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected evidence: counter/aggregate invariants survive duplicate and concurrent mutations; unauthorized upload/finalize/read/delete attempts fail; raw coordinates are absent from DB/log/event inspections.  
Checkpoint/rollback: snapshot the volume before upload-schema changes; reverse all Phase 5 UI adapters and functions as one capability slice.

### Phase 6 — messaging, reactions, invites, blocks, presence, and typing

Files to create:

- `convex/messages.ts`
- `convex/presence.ts`
- `convex/safety.ts`
- `tests/convex/messages.test.ts`
- `tests/convex/presence.test.ts`
- `tests/convex/safety.test.ts`
- `e2e/messages-local.spec.ts`

Files to modify:

- `features/messages/actions.ts`
- `features/messages/queries.ts`
- `features/messages/composer.tsx`
- `features/messages/thread.tsx`
- `features/messages/thread-live.tsx`
- `features/messages/workspace.tsx`
- `features/messages/conversation-list.tsx`
- `features/messages/info-drawer.tsx`
- `features/messages/presence.tsx`
- `features/messages/shared-card.tsx`
- `features/messages/cards.tsx`
- `features/messages/bubble.tsx`
- `features/messages/message-button.tsx`
- `features/places/invite-button.tsx`
- `features/share/share-sheet.tsx`
- `features/safety/actions.ts`
- `features/presence/actions.ts`
- `features/presence/provider.tsx`
- `features/presence/activity-toggle.tsx`
- `features/realtime/connection.ts`
- `features/realtime/reconnect.ts`
- `features/realtime/log.ts`
- `features/realtime/use-realtime-channel.ts`
- `app/(app)/messages/layout.tsx`
- `app/(app)/messages/page.tsx`
- `app/(app)/messages/[id]/page.tsx`
- `tests/messages.test.ts`
- `tests/presence.test.ts`

Files to delete after reactive-query tests pass:

- `features/messages/thread-live.tsx` if its behavior is fully absorbed by `useQuery`.
- `features/realtime/use-realtime-channel.ts`

Work:

- Atomically get/create a unique direct conversation, checking self-DM, active profiles, and either-direction block.
- Enforce membership on every list/send/edit/delete/reaction/invite/read/mute/media/typing function. A reply target must belong to the same conversation.
- Deduplicate optimistic sends by `(sender_id, client_id)`.
- Use paginated reactive message queries; do not refresh the whole route on each change.
- Presence is per auth session/tab, throttled, privacy-filtered, expiry-based, and cleaned by cron. Typing is real ephemeral state; replace the existing deprecated no-op.
- Blocking revokes new messaging and presence disclosure immediately without deleting audit/report evidence.

Tests/commands:

```bash
npm run test:convex -- tests/convex/messages.test.ts tests/convex/presence.test.ts tests/convex/safety.test.ts
npm run test -- tests/messages.test.ts tests/presence.test.ts
npx playwright test e2e/messages-local.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected evidence: two browser contexts observe message/reaction/invite/typing updates without `router.refresh`; a nonmember and blocked peer fail every adjacent capability; private image URLs cannot be fetched by outsiders.  
Checkpoint/rollback: reverse the complete messaging adapter/function slice; preserve uploaded-file volume snapshot for forensic comparison.

### Phase 7 — admin, moderation, editorial CMS, CSV import, audit, and user lifecycle

Files to create:

- `convex/admin.ts`
- `convex/moderation.ts`
- `convex/editorial.ts`
- `convex/imports.ts`
- `tests/convex/admin.test.ts`
- `tests/convex/moderation.test.ts`
- `tests/convex/audit.test.ts`
- `tests/convex/imports.test.ts`

Files to modify:

- `features/admin/actions.ts`
- `features/admin/console-actions.ts`
- `features/admin/user-actions.tsx`
- `features/admin/report-actions.tsx`
- `features/admin/place-media-form.tsx`
- `features/admin/place-csv-import.tsx`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/audit/page.tsx`
- `app/admin/categories/page.tsx`
- `app/admin/collections/page.tsx`
- `app/admin/comments/page.tsx`
- `app/admin/feed/page.tsx`
- `app/admin/moderation/page.tsx`
- `app/admin/moods/page.tsx`
- `app/admin/places/page.tsx`
- `app/admin/places/new/page.tsx`
- `app/admin/places/[id]/page.tsx`
- `app/admin/posts/page.tsx`
- `app/admin/ranking/page.tsx`
- `app/admin/reports/page.tsx`
- `app/admin/seed/page.tsx`
- `app/admin/settings/page.tsx`
- `app/admin/users/page.tsx`
- `app/admin/verifications/page.tsx`
- `lib/csv.ts`
- `tests/auth-admin.test.ts`
- `e2e/admin-moderate.spec.ts`

Work:

- Separate moderator, place-manager, admin, and owner functions rather than exposing a generic staff mutation.
- Make hide/restore/report resolution, warning/suspension/ban/restore, role change, place lifecycle/merge, taxonomy, editorial collections, featured placements, ranking/flags, verification review, and media changes transactional with append-only audit.
- Ban, deletion, and security-sensitive role changes invalidate sessions.
- CSV import parses/validates all rows first, returns line-level errors, enforces slug/provider uniqueness, chunks through an internal action/mutation boundary, and audits summary counts.
- Replace the admin seed page's current untyped `exec_sql` RPC call (not defined by the repository migrations or `types/database.ts`) with the idempotent Convex seed function; never preserve or emulate the broken generic-SQL escape hatch.
- Admin seed page never displays credentials or admin keys.

Tests/commands:

```bash
npm run test:convex -- tests/convex/admin.test.ts tests/convex/moderation.test.ts tests/convex/audit.test.ts tests/convex/imports.test.ts
npm run test -- tests/auth-admin.test.ts
npx playwright test e2e/admin-moderate.spec.ts
npm run typecheck
npm run lint
npm run build
```

Expected evidence: the adjacent-role matrix passes; last-owner and immutable-audit tests pass; CSV duplicate/error behavior is deterministic; banned sessions lose capability immediately.  
Checkpoint/rollback: reverse Phase 7 only after exporting audit/admin fixture state; audit rows themselves are never edited to simulate rollback.

### Phase 8 — Convex-only cutover, archive, and operational proof

Files to modify:

- `package.json`
- `package-lock.json`
- `.env.example`
- `next.config.ts`
- `README.md`
- `AUTH_ADMIN.md`
- `database/README.md`
- `QA_REALIDI_FIX_REPORT.md` — mark Supabase operational sections historical; do not rewrite past evidence as Convex evidence.
- `scripts/seed-demo.ts` — replace service-role Supabase seeding with an authenticated/internal Convex seed entry point or delete it if `convex/seed.ts` fully replaces the script.
- `types/database.ts`
- `playwright.config.ts`
- `vitest.config.ts`

Historical files to move without semantic edits:

- `supabase/config.toml` → `database/supabase-archive/config.toml`
- `supabase/seed.sql` → `database/supabase-archive/seed.sql`
- `supabase/migrations/00001_init.sql` → `database/supabase-archive/migrations/00001_init.sql`
- `supabase/migrations/00002_rls.sql` → `database/supabase-archive/migrations/00002_rls.sql`
- `supabase/migrations/00003_storage.sql` → `database/supabase-archive/migrations/00003_storage.sql`
- `supabase/migrations/00004_grants.sql` → `database/supabase-archive/migrations/00004_grants.sql`
- `supabase/migrations/00005_social_feed.sql` → `database/supabase-archive/migrations/00005_social_feed.sql`
- `supabase/migrations/00007_product_polish.sql` → `database/supabase-archive/migrations/00007_product_polish.sql`
- `supabase/migrations/00008_social_maturity.sql` → `database/supabase-archive/migrations/00008_social_maturity.sql`
- `supabase/migrations/00009_messaging_upgrade.sql` → `database/supabase-archive/migrations/00009_messaging_upgrade.sql`
- `supabase/migrations/00010_presence_privacy.sql` → `database/supabase-archive/migrations/00010_presence_privacy.sql`
- `supabase/migrations/00011_notification_idempotency.sql` → `database/supabase-archive/migrations/00011_notification_idempotency.sql`
- `supabase/migrations/00012_notification_message_id.sql` → `database/supabase-archive/migrations/00012_notification_message_id.sql`
- `supabase/migrations/00013_extend_enums.sql` → `database/supabase-archive/migrations/00013_extend_enums.sql`
- `supabase/migrations/00014_auth_admin_console.sql` → `database/supabase-archive/migrations/00014_auth_admin_console.sql`

Directories to remove once empty:

- `lib/supabase/`
- `supabase/`

Work:

- Remove `@supabase/ssr`, `@supabase/supabase-js`, all Supabase environment variables, image-host derivation, imports, RPC/storage/channel calls, service-role concepts, and runtime docs.
- Keep archived SQL only as non-runtime migration evidence. No script or package command may reference the archive.
- Configure Convex storage URLs safely in `next.config.ts`; prefer the self-hosted site origin and narrowly scoped image rules.
- Add guest, verified user, moderator/editor/admin, and owner Playwright setup using ignored local credentials.
- Verify persistence by restarting containers, not rebuilding seed state.

Tests/commands:

```bash
npx convex codegen
npx convex deploy
npm run convex:seed
npm run convex:verify
npm run test:contracts
npm run test:convex
npm run test
npm run typecheck
npm run lint
npm run build
docker compose -f compose.convex.yml restart backend
./scripts/convex-health.sh
npx playwright test
rg -n -i 'supabase|@supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE_KEY|createServerSupabase|createAdminClient|\\.from\\(\"|\\.rpc\\(|\\.channel\\(' --glob '!database/supabase-archive/**' --glob '!docs/plans/**' .
npm ls @supabase/ssr @supabase/supabase-js
git diff --check
git status --short
```

Expected evidence:

- All gates pass against the local Convex backend.
- `rg` returns no runtime Supabase hit; only the explicitly excluded archive and this plan may mention Supabase.
- `npm ls` reports neither Supabase package.
- A restart preserves users, seed, posts, messages, files, and audit logs.
- Guest, authenticated user, moderator/editor, admin, and owner browser smoke flows pass.
- Git status contains only intentional migration files plus the preserved pre-existing changes.

Checkpoint/rollback: save a final pre-cutover volume export and Phase 8 patch. Application rollback is the full pre-cutover source patch plus matching Convex volume snapshot; never point a partially reverted application at the new schema.

## Supabase-to-Convex domain parity matrix

`Public` below still means filtered through a public Convex query; tables are never directly readable by clients.

| Supabase table/domain | Convex table/function boundary | Data/index/invariant parity | Read parity | Write/security parity and required tests |
| --- | --- | --- | --- | --- |
| `profiles` | `profiles`, `profiles.*`, auth helpers | Unique username/email mapping; role; locale/timezone; onboarding; activity; deletion/ban/suspension fields; indexes by username, role, auth user | Living profiles public; self and authorized staff can inspect gated rows; activity privacy applied | Self edits safe fields only; server owns role/gates; admin/owner rules and last-owner negative tests |
| `user_preferences` | `user_preferences`, `profiles.completeOnboarding` | One per profile; mood/style/context arrays and budget/time/crowd/home coordinates | Self; staff only where an explicit admin use exists | Self only; referenced taxonomy validated; another-user write/read denied |
| `moods` | `moods`, `catalog.listMoods`, `admin.upsertMood` | Unique slug; layer enum; bilingual fields; active/order index | Active public, inactive staff | Place manager only writes; moderator/user denied |
| `experience_styles` | `experience_styles`, catalog/admin | Unique slug; bilingual fields; active/order index | Active public, inactive staff | Place manager only; invalid slug/order denied |
| `place_categories` | `place_categories`, catalog/admin | Unique slug; optional validated parent; no parent cycle; active/order index | Active public, inactive staff | Place manager only; dangling/cyclic parent denied |
| `places` | `places`, `places.*`, `admin.*Place` | Slug/provider uniqueness; integer coordinates; status/source enums; merge integrity; city/status/category/search indexes | Active, temporarily closed, merged redirect public; all states place managers | Editor/admin/owner writes; valid coordinates/status/merge target required; moderator/user denied |
| `place_moods` | `place_moods`, catalog/admin | Unique place+mood; nonnegative weight; indexes by both refs | Public when parent place/mood is visible | Place manager only; dangling refs and duplicate denied |
| `place_styles` | `place_styles`, catalog/admin | Unique place+style; indexes by both refs | Public when parent place/style is visible | Place manager only |
| `experience_posts` | `experience_posts`, `experiences.*`, `feed.*` | Author/place refs; type/visibility/status/verification/moderation enums; timestamps/counters; feed/author/place indexes | Published nonhidden subject to visibility/block; own drafts; moderator scope | Authenticated author creates/edits own safe fields; moderation/verification/counters server-only; forged author/state denied |
| `post_media` | `post_media`, `files.finalizeExperienceMedia` | Post ref; storage ID; media metadata/order/processing state | Same visibility as parent post | Author or authorized staff; MIME/size/storage-owner enforced; cross-post finalize denied |
| `experience_mood_ratings` | `experience_mood_ratings`, experience transaction | Unique post+mood; rating 1–5 | Same visibility as parent post | Parent author only before allowed lifecycle point; duplicate/out-of-range denied |
| `experience_metrics` | `experience_metrics`, experience transaction | One per post; crowd/worth/spend/day/time validators | Same visibility as parent post | Parent author only; server refreshes aggregates; invalid values denied |
| `place_mood_stats` | `place_mood_stats`, internal aggregate recompute | Unique place+mood; Bayesian values/sample/confidence/tier | Public | Internal writes only; direct client write denied; recompute equality tested |
| `place_experience_stats` | `place_experience_stats` | One per place; worth/verified/context/time aggregate parity | Public | Internal only; hidden/deleted inputs excluded |
| `place_crowd_stats` | `place_crowd_stats` | One per place; counts/dominant/confidence | Public | Internal only; source-count invariant |
| `place_cost_stats` | `place_cost_stats` | One per place; median/average/currency/confidence | Public | Internal only; deterministic median fixture |
| `place_time_stats` | `place_time_stats` | One per place; day/time counts, tie behavior, confidence | Public | Internal only; SQL tie-order fixtures retained |
| `travel_dna_profiles` | `travel_dna_profiles` | One per user; declared/behavioral values | Self or staff, matching dormant current domain | No public mutation until feature exists; arbitrary user access denied |
| `creator_reputation` | `creator_reputation` | One per user; contribution/save/report counters | Public as current RLS permits, with only non-sensitive fields | Internal aggregate/admin correction only |
| `saved_collections` | `saved_collections`, `social.*Collection` | Unique user+slug; one default collection | Self only | Self only; server derives user; deleting referenced default denied or transactionally reassigned |
| `saves` | `saves`, `social.toggleSavePlace` | Unique user+place+collection; `saved`/`want_to_go`; user/time and place indexes | Self rows; public only receives aggregate counts | Self only; server derives user and validates owned collection |
| `visit_claims` | `visit_claims`, `social.toggleBeenThere` | Unique user+place | Self rows; public count only | Self only; forged user denied |
| `visit_verifications` | `visit_verifications`, `verification.verifyVisit/adminReview` | User/place/post refs; method/result/confidence/distance/accuracy/radius metadata | Self or moderator/admin as required | User submits observation; server computes result; staff review; raw GPS never stored; forged result denied |
| `follows` | `follows`, `social.toggleFollow` | Unique follower+following; no self; reverse index | Public relationship/count, filtered for gated profiles | Server derives follower; block/self checks; forged follower denied |
| `post_likes` | `post_likes`, `social.toggleLike` | Unique user+post; transactional post count | Public count/relation, self annotation | Self only; visible target required; duplicate concurrency tested |
| `comments` | `comments`, `social.add/deleteComment`, moderation | Post/author/parent/place/attachment refs; 1–2000 chars; moderation/deletion; post/time index | Visible comments public; own and moderators see allowed hidden state | Author creates/soft-deletes own; moderator removes; parent same-post enforced; forged author/moderation denied |
| `shares` | `shares`, `social.recordShare` | Optional user; exactly one valid target where required; channel/time | Self or staff; public receives counts only | Guest/auth event endpoint derives optional identity; target validated |
| `reports` | `reports`, `safety.submitReport`, `moderation.*` | Reporter/target/reason/status/priority/assignment/resolution; target and queue indexes | Reporter or moderation capability | Reporter creates; moderator queues/resolves; admin required for ban; duplicate-abuse/rate tests |
| `moderation_actions` | `moderation_actions`, internal audit companion | Actor/target/action/reason/metadata/time | Moderation staff only | Internal append from authorized moderation transaction; forged actor and update/delete denied |
| `ranking_config` | `ranking_config`, `ranking.get/update` | Singleton; weights sum within tolerance; priors/radius | Public | Admin/owner only; editor/moderator denied; invalid sum denied |
| `feature_flags` | `feature_flags`, `flags.*` | Unique key; enabled/description/updater | Public | Admin/owner only; unknown key policy explicit |
| `product_events` | `product_events`, `analytics.record` | Event allowlist; optional user/session/properties/time; event/user indexes | Self where required, staff aggregate/report access | Actor derived or anonymous; properties size/schema limited; another user ID denied |
| `saved_posts` | `saved_posts`, `social.toggleSavePost` | Unique user+post; transactional post save count | Self only | Self only; visible target; concurrent toggle invariant |
| `notifications` | `notifications`, internal `notifications.insert`, user read mutations | Recipient/actor/type/targets/read/event key/message ID; unread and dedupe indexes | Recipient only | Internal event creation; recipient marks own; self/block/duplicate negative tests |
| `feed_ranking_config` | `feed_ranking_config`, `feed.get/updateConfig` | Singleton; seven weights sum; engagement weights/half-life | Public | Admin/owner only; adjacent roles and invalid sum denied |
| `place_recommendation_feedback` | `place_recommendation_feedback`, discovery feedback | Unique user+place; optional mood; kind enum | Self only | Self only; visible place/mood and forged user tests |
| `community_question_meta` | `community_question_meta`, experience transaction | One per question post; area/budget/mood/context/time/crowd | Same visibility as parent question | Parent author only; only question type accepted |
| `user_interest_signals` | `user_interest_signals`, internal signals | User/entity/signal/weight/time; user/entity indexes | Self only | Internal/self-triggered allowlisted signal; server derives user; arbitrary weight/entity denied |
| `conversations` | `conversations`, `messages.getOrCreateDm/list` | Direct-pair key uniqueness; last-message timestamp; participant index | Members only | Authenticated creation through get/create only; self/block/inactive peer denied |
| `conversation_participants` | `conversation_participants`, message membership helpers | Unique conversation+user; read/mute/join fields; by-user index | Members can see participants | Membership is server-created; user updates own read/mute only; adding outsider denied |
| `messages` | `messages`, `messages.*` | Conversation/sender/body/kind/payload/reply/client ID/edit/delete; pagination and dedupe indexes | Members only, preserving deleted tombstones | Member sender creates; sender edits text/deletes own; reply same conversation; forged sender/kind payload denied |
| `conversation_typing` | `conversation_typing`, `presence.setTyping` | Session/tab+conversation key; expiry index | Members only, privacy/block aware | Member self only; short TTL; outsider/forged user denied |
| `place_invitations` | `place_invitations`, `messages.invite/respond` | Place/from/to/conversation/message/date/time/note/status/response refs | Sender or recipient/member context | Sender creates to peer; recipient changes response; unrelated member and sender response escalation denied |
| `message_reactions` | `message_reactions`, `messages.toggleReaction` | Unique message+user; emoji allowlist | Conversation members | Member self only; message membership checked; arbitrary emoji/user denied |
| `user_blocks` | `user_blocks`, `safety.block/unblock` | Unique blocker+blocked; no self; reverse lookup | Blocker sees own list; internal relationship checks both directions | Server derives blocker; self/forged blocker denied; block suppresses DM/notification/presence |
| `auth_lockouts` | `auth_lockouts`, internal auth flow | Normalized email; failure count/lock expiry | No public query | Auth internals only; generic responses and expiry/concurrency tests |
| `user_hidden_posts` | `user_hidden_posts`, `safety.hide/unhide` | Unique user+post | Self only; feed applies filter internally | Self only; visible/valid target; forged user denied |
| `place_media` | `place_media`, `files.finalizePlaceMedia` | Place/storage/alt/order/creator/time | Public only with visible place; managers see drafts | Place manager only; MIME/size/cross-place/cover ownership tests |
| `audit_logs` | `audit_logs`, `_lib/audit`, admin query | Actor/action/target/before/after/reason/request metadata/correlation/time; actor/target/action indexes | Admin/owner only | Internal append; immutable to all public capabilities; secrets redacted |
| `editorial_collections` | `editorial_collections`, `editorial.*` | Unique slug; kind/status/order/schedule/actors/timestamps | Published/in-window public; staff sees all | Place manager only; schedule/status validation; moderator denied |
| `editorial_collection_items` | `editorial_collection_items`, `editorial.*Item` | Unique collection+type+target; order; valid target type/ref | Public only through visible collection and visible target | Place manager only; dangling/duplicate/cross-kind target denied |
| `featured_placements` | `featured_placements`, `curation.*` | Unique live surface+type+target; status/order/schedule | Published/in-window public | Place manager only; duplicate live placement and hidden target denied |
| `auth.users` and Supabase Auth | Convex Auth `users`, accounts, sessions, verification codes/verifiers/rate limits | Normalized unique email, password hash, verification timestamp, rotating sessions | Current identity only through safe profile/session DTO | Auth library/internal functions only; no password/hash/token exposure |
| Storage `avatars` | Convex `_storage` + profile avatar reference | Images only; 5 MiB; one active reference policy | Public for visible profile via generated URL | Owner finalize/replace/delete; cross-user and SVG denied |
| Storage `experience-media` | Convex `_storage` + `post_media` | Images ≤8 MiB; videos ≤50 MiB; metadata/order | Published post public; draft author/staff | Post author/staff only; MIME/size/content metadata and orphan tests |
| Storage `place-media` | Convex `_storage` + `place_media` | Images only; 10 MiB; alt/order/cover references | Visible place public | Editor/admin/owner only; moderator/user denied |
| Storage `message-media` | Convex `_storage` + image message payload/reference | Images only; 8 MiB; conversation/sender binding | Current conversation members via generated URL | Member sender only; blocked/nonmember/cross-conversation read/finalize/delete denied |
| RPC `nearby_places`/viewport | `places.nearby`/`places.inViewport` | Valid integer coordinates, bounded candidates, exact Haversine, deterministic ties | Public visible places only | No write; malformed/range/ceiling tests |
| RPC/trigger aggregate refresh | Internal aggregate helpers and repair mutation | Same filters, Bayesian prior, confidence tiers, medians/modes/ties | Public aggregate queries | Source mutation/internal repair only; direct calls denied |
| RPC `get_or_create_dm`/`is_blocked_with`/membership | Message/safety authz helpers | Pair uniqueness and bidirectional block/member checks | Result only to caller | Identity derived; race, self, blocked, outsider tests |
| RPC `notify_event` and count triggers | Internal transactional notification/counter helpers | Dedupe and nonnegative exact counters | Recipient/public counts as applicable | No public generic RPC; concurrency and forged actor tests |
| Supabase Realtime channels | Reactive queries + presence/typing TTL tables | Query indexes, expiry, privacy, reconnect behavior | Same capability as corresponding query | Subscription cannot exceed query authorization; revocation test on block/ban |

## RLS and security rule-family parity matrix

| Rule family | Convex enforcement point | Required negative evidence |
| --- | --- | --- |
| Authentication required | `requireIdentity`/`requireVerifiedProfile` at the top of each protected public function | Guest rejected from every mutation except auth and allowed anonymous analytics |
| Account-state gate | `requireActiveProfile` checks deleted, banned, suspension expiry, email verification | Existing socket/session cannot mutate after ban/delete/suspend; expired suspension succeeds |
| Server-derived identity | Auth user/profile mapping in every mutation | Forged user/author/actor/reporter/sender fields are absent or ignored and cannot affect another user |
| Role authenticity | Profile role loaded in Convex, never accepted as argument/JWT custom client claim | User passing `role=owner` remains denied |
| Staff decomposition | `requireModerator`, `requirePlaceManager`, `requireAdmin`, `requireOwner` | Moderator cannot edit places; editor cannot moderate/users/ranking; admin cannot grant owner/admin; user denied all |
| Last owner | Transaction counts active owners before demotion/gating | Last owner demote/ban/suspend/delete rejected under races |
| Public status filtering | Shared visible profile/place/post/collection predicates | Draft/hidden/deleted/private/followers-only rows do not appear through IDs, search, feed, nested joins, or storage URLs |
| Ownership | Resource-specific owner checks before read/write | Another user denied preferences, drafts, saves, collections, feedback, hidden posts, edits, and media |
| Relationship visibility | Follow/block/conversation helpers | Nonfollower denied followers post; either-direction block suppresses feed/message/notification/presence |
| Conversation membership | `requireConversationMember` in every message-domain query/mutation | Guessed conversation/message/file IDs fail for list, react, reply, edit, delete, read, mute, typing, invite |
| Moderation target scope | Capability plus target type/status validation | Editor cannot hide post; moderator cannot ban; invalid target type/ref rejected |
| Notification integrity | Internal-only creation derives actor/recipient facts and dedupes atomically | Self, blocked pair, duplicate event/message, forged actor, and another recipient's read mutation fail |
| Analytics integrity | Event allowlist, property validator, size/rate limits, derived identity | Unknown event, oversized/nested secret-like properties, and another user ID fail |
| Storage authorization | Pre-upload intent plus finalize/read/delete recheck | Stolen upload URL/storage ID, wrong MIME/size/owner/target, SVG, orphan, and private message reads fail |
| GPS privacy | Verification action computes then discards coordinates | DB export, logs, errors, analytics, and audit contain no raw user latitude/longitude |
| Audit immutability | No public update/delete function; append helper strips secrets | Staff/admin cannot alter/delete audit; sensitive keys are redacted |
| Rate limiting/lockout | Persistent Convex lockout/rate tables, normalized identifiers | Parallel failures cannot evade threshold; response does not reveal account existence |
| Session invalidation | Convex Auth `invalidateSessions` plus per-call account gate | Current/others/all scopes verified; ban/delete invalidates all; password change invalidates selected others |
| Password/reset/verification | Password provider with local SMTP and one-time expiring codes | Reuse, expiry, wrong email/code, unverified login, enumeration, and logged-secret tests |
| Owner bootstrap | Internal one-time compare against server env and zero-owner check | Wrong email, second owner, client metadata, and concurrent first logins cannot self-promote |
| User export/deletion | Self-only export projection; current-password confirmation; soft-delete plus session invalidation | Another user export/delete denied; deleted identity cannot sign in; private credentials/tokens omitted |
| Referential/uniqueness parity | Validators and indexed transactional lookups | Dangling IDs, duplicates, self-relations, cross-post replies, invalid merges, and invalid enum/range writes fail |
| Counter/aggregate parity | Source mutation transaction plus internal deterministic recompute | Duplicate/concurrent actions never make counts negative or different from source rows |

## Evidence bundle

The implementation handoff must include command output or machine-readable artifacts for:

1. Compose config, bound ports, container image digests, health, and persistence after restart.
2. Admin-key file permissions and a secret scan showing no tracked/private key material.
3. Convex codegen/deploy and schema/index inventory.
4. Seed run 1/run 2 counts and checksum, including 22 editorial HCMC places and all taxonomy/config defaults.
5. Full unit/contract/Convex test output with positive and negative authorization cases.
6. Lint, app typecheck, production build, and all Playwright projects.
7. Guest screenshots/traces for discover/search/place; user evidence for auth/onboarding/create/save/verify/message/settings; admin evidence for moderation/user/place/taxonomy/ranking/flags/collections/audit/import/media.
8. Residual dependency/import/env scan and `npm ls` output.
9. Final `git diff --check`, `git status --short`, and confirmation that the original uncommitted changes were preserved.

## Definition of done

- Self-hosted Convex backend, site proxy, dashboard, and local mail are healthy, loopback-bound, pinned, persistent, and documented.
- Admin-key generation is noninteractive, secret-safe, ignored, mode `0600`, and never printed or bundled.
- All 52 active domain tables, Auth tables, four storage domains, RPC behaviors, triggers, indexes, constraints, enums, relations, and RLS intent have implemented Convex parity.
- Email/password sign-up, login, logout, verification, reset/update/change, lockout, owner bootstrap, remember/session scopes, ban/suspension/deletion, and role checks work against Convex Auth.
- Every public Convex query/mutation/action uses the correct shared identity/account/capability/resource check; all matrix negative tests pass.
- Discover/search/place/map/feed/profile/social/experience/verification/notification/messaging/presence/settings/admin workflows preserve route and user-visible behavior.
- Storage enforces type, size, ownership, membership/staff capability, target visibility, generated URL authorization, replacement/deletion, and orphan cleanup.
- Realtime messages, reactions, invites, notifications, read/mute, presence, and typing use Convex subscriptions and react across two browser contexts.
- Haversine, ranking, aggregate confidence, tie-breaking, and pagination are deterministic and fixture-tested.
- Seed is idempotent and contains the current HCMC taxonomy/editorial inventory; demo users require explicit ignored credentials.
- All commands in Phase 8 pass without skipped required suites, fake responses, weakened assertions, or placeholder/no-op product implementations.
- There are no runtime imports, packages, environment variables, clients, RPCs, storage URLs, channels, setup instructions, or scripts requiring Supabase.
- The only remaining Supabase references are under `database/supabase-archive/` and historical text explicitly labeled non-runtime.
- No commit, push, public deployment, tunnel, LaunchAgent, or non-loopback listener is created as part of local implementation.
- Existing uncommitted work, especially `app/layout.tsx` and `package-lock.json`, is preserved and deliberately integrated rather than overwritten.

## Worker lane boundaries

The full migration is too broad for one responsible worker run: it spans 52 tables, authentication, four storage policies, realtime, 30+ routes, admin, and data invariants. One worker run may safely deliver Phases 0–2 (contracts, local stack, schema/authz kernel, and idempotent seed) as a non-runtime foundation. It must not switch application routes before the follow-up lanes are complete.

Shared-file integrator lane (runs first and last; sole owner):

- Owns `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `compose.convex.yml`, `convex.json`, `convex/schema.ts`, `convex/validators.ts`, generated files, `types/database.ts`, `app/layout.tsx`, `proxy.ts`, `next.config.ts`, test configs, archive moves, and final docs.
- Accepts schema/index/function requirements from domain lanes; domain lanes do not edit these shared files.

Lane A — auth/profile:

- Owns `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`, `convex/authEmails.ts`, `convex/account.ts`, `convex/sessions.ts`, `convex/profiles.ts`, `lib/auth/**`, `features/auth/**`, auth/profile/onboarding/settings routes, and auth/account tests.
- Depends on the schema/authz kernel; exposes authenticated server-wrapper requirements to the integrator.

Lane B — catalog/discovery/feed:

- Owns `convex/catalog.ts`, `convex/places.ts`, `convex/discovery.ts`, `convex/search.ts`, `convex/curation.ts`, `convex/ranking.ts`, `convex/feed.ts`, `convex/flags.ts`, corresponding feature query modules, public route adapters, and ranking/discovery/feed tests.
- Must not implement social mutations or edit shared schema/types.

Lane C — experience/social/storage:

- Owns `convex/experiences.ts`, `convex/social.ts`, `convex/verification.ts`, `convex/notifications.ts`, `convex/analytics.ts`, `convex/files.ts`, `convex/crons.ts`, experience/social/verification/notification/media adapters, and their tests.
- Coordinates message-media requirements with Lane D through the integrator; it owns generic storage helpers, not message authorization.

Lane D — messaging/realtime/safety:

- Owns `convex/messages.ts`, `convex/presence.ts`, `convex/safety.ts`, `features/messages/**`, `features/presence/**`, `features/realtime/**`, `features/safety/**`, share/invite message adapters, and message/presence/safety tests.
- Uses Lane C's generic file primitives but owns conversation-member checks and message-media finalize/read behavior.

Lane E — admin/moderation/editorial:

- Owns `convex/admin.ts`, `convex/moderation.ts`, `convex/editorial.ts`, `convex/imports.ts`, `features/admin/**`, `app/admin/**`, CSV/admin tests, and admin Playwright flows.
- Uses shared capability helpers; does not add broad `isStaff` shortcuts where a narrower capability applies.

Lane F — verification/cutover:

- Owns contract/E2E orchestration, secret/residual scans, evidence bundle, archived SQL validation, and cross-lane regression triage.
- Does not “fix” failures by weakening authorization, skipping suites, or introducing compatibility fallbacks to Supabase.

Merge/order boundary:

1. Integrator lands Phases 0–2.
2. Lane A establishes authenticated wrappers.
3. Lanes B–E work in parallel on disjoint files against the fixed generated API.
4. Integrator applies requested schema/index additions and regenerates API once per reviewed batch.
5. Lane F runs cross-domain tests.
6. Integrator performs Phase 8 removal/archive only after every route has a Convex implementation.

## Unresolved source-grounded questions

1. `README.md` advertises optional Google OAuth, but the button is disabled by default and the migration brief explicitly requires email/password, not Google. Decide whether Convex Google OAuth is part of parity or whether the hidden flag and dormant UI are intentionally removed at cutover.
2. Current experience media is publicly readable even for drafts, while the migration requirements ask for proper generated URLs and ownership enforcement. This plan intentionally strengthens draft media to author/staff-only; confirm that no external draft-share workflow depends on public URLs.
3. `lib/media/video.ts` is an explicit no-op and no caller currently enqueues processing. This plan treats original video upload as the complete MVP behavior and removes the fake queue boundary; confirm transcoding/poster generation is not a hidden acceptance requirement.
4. The SQL seed is authoritative for taxonomy/editorial places, while `scripts/seed-demo.ts` adds optional social/demo data and the README currently contains a hardcoded demo password. Confirm whether final parity evidence should include only SQL editorial data or also an opt-in, credential-injected Convex social demo dataset.
5. The `avatars` bucket and display path exist, but no avatar upload/delete UI exists in the repository. Confirm whether this migration should implement only backend storage-policy parity or add a net-new profile avatar workflow.
