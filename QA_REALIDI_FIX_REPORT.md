# Realidi QA fix report — final pass

Date: 2026-08-31  
Stack: Next.js 16.3.3 App Router, React 19, Supabase (Postgres + Realtime + Storage), Vitest, npm.

This pass fixed only the three remaining bugs. Flows that already passed were not restyled.

Verified on `next start` at `http://127.0.0.1:3000` as Linh Trần (`/user/linhsaigon`).

---

## 1. Root cause — empty username on `/profile/edit`

Canonical field is `profiles.username` (`^[a-z0-9_]{3,30}$`). No new column.

The edit form used a controlled input named `username`. Chrome/password managers treat that name as a login identifier. After hydrate they overwrite React state with `""` (the login identifier is the email, not the handle). The server already passed `linhsaigon`; the browser then cleared it.

`defaultValue` and session props cannot win against autofill on `name="username"`.

Fix:

- Do not mount the form until `getEditableProfile()` returns a non-empty username (`loading` → skeleton).
- Visible handle input is `name="profile_handle"` (`PROFILE_USERNAME_FIELD`), `autoComplete="off"`, `readOnly` until focus.
- Client and server both `normalizeUsername` (trim, strip `@`, lowercase) and validate with `usernameSchema`.
- Empty or invalid username cannot submit. Current username is allowed. Taken usernames are rejected excluding the current user.
- After save: toast, `revalidatePath("/", "layout")`, redirect to `/user/:username`.

Live check: after reload, `input[name="profile_handle"]` value is `linhsaigon`. There is no `input[name="username"]` on the page.

---

## 2. Root cause — realtime “Đang kết nối lại…” at ~6s

Realtime is **Supabase Realtime** (`wss` derived from `NEXT_PUBLIC_SUPABASE_URL`). It does not go through Cloudflare Tunnel. The Next.js origin only serves HTTP.

The custom channel layer treated `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` as fatal, called `removeChannel`, then `subscribe()` again. `CLOSED` from our own `removeChannel` scheduled another retry → reconnect loop. Timing (~3–4s error + 1.8s banner delay) matched the 6s report.

Presence used the same removeChannel-retry loop on the shared socket, so chat and presence fought.

Fix:

- One browser `createBrowserClient` singleton (`isSingleton: true`). Heartbeat 20s, channel timeout 20s, empty-channel disconnect 120s, exponential reconnect with jitter.
- Token refresh via `accessToken` + `setAuth` on `TOKEN_REFRESHED`. Logout is the only full `realtime.disconnect()`.
- Components subscribe/unsubscribe **their** channel only. They do not recreate the client or disconnect the socket on unmount or conversation change.
- Banner is driven by socket `isConnected()` / `isConnecting()`, and only after **1.8s of reconnecting/disconnected**. First-connect is not a reconnect.
- After a real reconnect, the thread merges messages by id (no duplicates).
- Dev-only logs: `realtime: connecting | connected | subscribed | disconnected | reconnect attempt | reconnected`. No tokens. Silent in production.

Live check on `/messages/d85b36e5-91a9-4c7e-aa36-947452346999`: samples at 3s, 6s, 9s, 12s, 20s, then a further 40s watch. **“Đang kết nối lại…” never appeared.** Combined hold > 60s.

---

## 3. Root cause — notification “duplicates”

Writer is a single server path: `sendMessage` → `insertNotification` → RPC `notify_event`. No notification trigger. Realtime does not insert notifications.

The two rows on Linh’s list:

| created_at | matching message |
| --- | --- |
| 2026-08-31T04:09:11Z | message `c72f1bd6-…` (body null) |
| 2026-08-31T04:09:28Z | message `10fff33a-…` (`hi`) |

They are **two different messages**, 17 seconds apart, both without `message_id` / `idempotency_key`. They were not deleted.

`00011` and `00012` had not been applied on local Supabase (`idempotency_key` column missing). They are now applied locally.

Idempotency now:

- Key `message:${messageId}` (null key if `messageId` missing → insert skipped).
- Unique index `(user_id, metadata->>'message_id')` where `type = 'message'`.
- `notify_event` returns the existing row on conflict. No conversation-level coalesce UPDATE (that mixed two messages into one key).
- Cleanup only deletes extras that share a non-null `idempotency_key` or the same `message_id`. Unkeyed history is kept.
- UI groups consecutive message rows from the same actor + conversation as “đã gửi N tin nhắn” without dropping rows.

Live check after grouping: one line **“Trần Anh Vũ đã gửi 2 tin nhắn”**. Database still has two rows.

---

## 4. Files changed

Username

- `features/profile/edit-state.ts`
- `features/profile/edit-form.tsx`
- `app/(app)/profile/edit/page.tsx`
- `features/auth/actions.ts`

Realtime

- `lib/supabase/client.ts`
- `features/realtime/log.ts`
- `features/realtime/connection.ts`
- `features/realtime/use-realtime-channel.ts`
- `features/realtime/reconnect.ts`
- `features/messages/thread.tsx`
- `features/presence/provider.tsx`

Notifications

- `features/notifications/keys.ts`
- `features/notifications/actions.ts`
- `features/notifications/dedupe.ts`
- `features/notifications/list.tsx`
- `features/messages/actions.ts`

Tests / report

- `tests/profile-edit.test.ts`
- `tests/qa-pilot.test.ts`
- `QA_REALIDI_FIX_REPORT.md`

---

## 5. Migrations added

`supabase/migrations/00011_notification_idempotency.sql` (previous pass; **applied locally this pass**)

- `notifications.idempotency_key`
- unread unique index
- `notify_event`

`supabase/migrations/00012_notification_message_id.sql` (**applied locally this pass**)

- Safe cleanup of proven duplicates (same `idempotency_key` or same `user_id` + `message_id`); keep oldest
- Unique `(user_id, metadata->>'message_id')` for `type = 'message'`
- `notify_event` rewritten: per-message lookup, no conversation coalesce

Apply on any other environment:

```bash
npx supabase migration up --local
# or paste 00011 then 00012 into the Supabase SQL editor
```

---

## 6. Environment variables

No new variables. No tunnel hostname hardcoded.

Required:

- `NEXT_PUBLIC_SUPABASE_URL` — Realtime `wss` is derived from this. Must be the Supabase project URL, not `localhost`, when the page is served over HTTPS.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Realtime does **not** use `NEXT_PUBLIC_APP_URL`. Do not point it at the Cloudflare hostname.

---

## 7. Tests added

- `tests/profile-edit.test.ts`: field must not be `name="username"`; form not ready with empty username; empty cannot submit; keep `linhsaigon`.
- `tests/qa-pilot.test.ts`: per-`message_id` keys; no key without `message_id`; proven-duplicate cleanup; consecutive UI grouping; reconnect banner not shown on first-connect.
- Existing reconnect delay / presence / comment hash tests kept.

Result: **10 files, 76 tests passed**.

---

## 8. Realtime 60-second check

Conversation `d85b36e5-91a9-4c7e-aa36-947452346999` on production `next start`.

| elapsed | “Đang kết nối lại…” |
| --- | --- |
| 3s | no |
| 6s | no |
| 9s | no |
| 12s | no |
| 20s | no |
| +40s (still on thread) | no hits |

Pass for a single session on a healthy network. Two-account send/receive was not executed (would write production/local chat data).

---

## 9. Two-account test

Not run end-to-end (no second session, no new production messages).

Covered instead:

- Unit: same `messageId` → same key; different `messageId` → different keys; insert skipped without `messageId`.
- DB: two historical notifications map to two distinct `messages` rows.
- UI: those two rows display as one grouped line.
- Unique index + RPC prevent a retry of the same `message_id` from inserting a second row after `00012`.

---

## 10. Lint

```
npx eslint app components features lib tests --max-warnings=0
```

**Pass** (0 errors, 0 warnings).

---

## 11. Typecheck

```
npx tsc --noEmit
```

**Pass**. Production `next build` also ran TypeScript successfully.

---

## 12. Production build

```
npm run build
```

**Pass** (Next.js 16.3.3 Turbopack). Served with `npx next start -H 127.0.0.1 -p 3000`.

Playwright e2e: browsers not installed in this environment (`npx playwright install` required). Guest specs were not executed.

---

## 13. Remaining issues

- Historical message notifications without `message_id` were kept. UI groups them; DB still has two rows for two messages.
- `00011` / `00012` must be applied on any non-local Supabase project before idempotency is enforced there.
- Two-account live send, unread badge, logout last-seen, and offline reconnect were not re-run in this session.
- Playwright Chromium is missing; existing e2e could not launch.
- Next.js still warns that `middleware` should move to `proxy`. Unchanged.
- Mapbox still optional; Google Maps CTA unchanged.

---

## 14. Cloudflare / WebSocket

Supabase Realtime connects from the browser to `{NEXT_PUBLIC_SUPABASE_URL}` as `wss://…/realtime/v1/websocket`. Cloudflare Tunnel only proxies the Next.js HTTP server. Quick Tunnels do not need a WebSocket upgrade for chat.

Production:

```bash
npm run build
NODE_ENV=production npx next start -H 0.0.0.0 -p 3000
cloudflared tunnel --url http://127.0.0.1:3000
```

Do **not** tunnel `next dev`.

If `NEXT_PUBLIC_SUPABASE_URL` is `http://127.0.0.1:54321` (local stack), a remote tunnel client cannot reach Realtime. Use the hosted Supabase URL for any shared demo. On that local stack, this pass used `127.0.0.1:3000` against local Realtime and the socket stayed up for >60s.

HTTPS pages must not use `ws://`. The Supabase client upgrades `https://` → `wss://` automatically when the URL is HTTPS.
