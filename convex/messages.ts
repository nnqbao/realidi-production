import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { optionalIdentity, requireConversationMember, requireVerifiedProfile } from "./_lib/authz";
import { areBlocked } from "./_lib/blocks";
import { iso } from "./_lib/dtos";
import { invariant } from "./_lib/errors";
import { notifyEvent } from "./_lib/notify";
import { normalizeSearchText } from "./_lib/search";
import { pairKey, unorderedPairKey } from "./_lib/uniqueness";
import { invitationStatus, messageKind } from "./validators";

const PAGE = 40;
const TYPING_MS = 4_000;
const RECENT_READ_MS = 20_000;
const REACTIONS = ["❤️", "👍", "😂", "😮", "😢"] as const;

function inviteStatusOf(value: unknown): "pending" | "accepted" | "maybe" | "declined" {
  if (value === "accepted" || value === "maybe" || value === "declined") return value;
  return "pending";
}

type Ctx = QueryCtx | MutationCtx;

async function profileLite(ctx: Ctx, profile: Doc<"profiles">) {
  return {
    id: profile._id as string,
    username: profile.username,
    display_name: profile.display_name,
    avatar_path:
      profile.avatar_storage_id === undefined ? null : await ctx.storage.getUrl(profile.avatar_storage_id),
    bio: profile.bio ?? null,
    last_seen_at: iso(profile.last_seen_at),
    last_active_at: iso(profile.last_active_at),
    show_activity_status: profile.show_activity_status,
  };
}

async function membership(ctx: Ctx, conversationId: Id<"conversations">, userId: Id<"profiles">) {
  return await ctx.db
    .query("conversation_participants")
    .withIndex("by_pair", (q) => q.eq("pair_key", `${conversationId}:${userId}`))
    .unique();
}

async function peerRow(ctx: Ctx, conversationId: Id<"conversations">, userId: Id<"profiles">) {
  const rows = await ctx.db
    .query("conversation_participants")
    .withIndex("by_conversation", (q) => q.eq("conversation_id", conversationId))
    .collect();
  return rows.find((row) => row.user_id !== userId) ?? null;
}

async function requirePeer(ctx: MutationCtx, conversationId: Id<"conversations">, userId: Id<"profiles">) {
  const other = await peerRow(ctx, conversationId, userId);
  invariant(other !== null, "NOT_FOUND", "Peer not found");
  if (await areBlocked(ctx, userId, other.user_id)) {
    invariant(false, "FORBIDDEN", "BLOCKED");
  }
  return other;
}

async function ensureDirect(ctx: MutationCtx, me: Id<"profiles">, otherId: Id<"profiles">) {
  invariant(me !== otherId, "VALIDATION_FAILED", "NO_SELF_DM");
  const other = await ctx.db.get(otherId);
  invariant(
    other !== null && other.deleted_at === undefined && other.banned_at === undefined,
    "NOT_FOUND",
    "User not found",
  );
  invariant(!(await areBlocked(ctx, me, otherId)), "FORBIDDEN", "BLOCKED");
  const key = unorderedPairKey(me, otherId);
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_direct_pair", (q) => q.eq("direct_pair_key", key))
    .unique();
  if (existing) return existing._id;
  const now = Date.now();
  const conversationId = await ctx.db.insert("conversations", {
    is_direct: true,
    direct_pair_key: key,
    last_message_at: now,
    created_at: now,
  });
  await ctx.db.insert("conversation_participants", {
    conversation_id: conversationId,
    user_id: me,
    pair_key: `${conversationId}:${me}`,
    joined_at: now,
    muted: false,
  });
  await ctx.db.insert("conversation_participants", {
    conversation_id: conversationId,
    user_id: otherId,
    pair_key: `${conversationId}:${otherId}`,
    joined_at: now,
    muted: false,
  });
  return conversationId;
}

async function hydrateOne(ctx: Ctx, msg: Doc<"messages">, viewerId: Id<"profiles">) {
  const sender = await ctx.db.get(msg.sender_id);
  const payload = msg.payload ?? {};
  let reply = null;
  if (msg.reply_to_message_id) {
    const parent = await ctx.db.get(msg.reply_to_message_id);
    if (parent) {
      const replySender = await ctx.db.get(parent.sender_id);
      reply = {
        id: parent._id as string,
        body: parent.deleted_at !== undefined ? "Tin nhắn đã được thu hồi." : (parent.body ?? null),
        kind: parent.kind,
        senderName: replySender?.display_name ?? null,
      };
    }
  }
  const reactionRows = await ctx.db
    .query("message_reactions")
    .withIndex("by_message", (q) => q.eq("message_id", msg._id))
    .collect();
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const row of reactionRows) {
    const cur = grouped.get(row.reaction) ?? { count: 0, mine: false };
    cur.count += 1;
    if (row.user_id === viewerId) cur.mine = true;
    grouped.set(row.reaction, cur);
  }
  let imageUrl: string | null = null;
  if (msg.kind === "image" && msg.deleted_at === undefined && typeof payload.storageId === "string") {
    imageUrl = await ctx.storage.getUrl(payload.storageId as Id<"_storage">);
  }
  let post = null;
  if (msg.kind === "post" && typeof payload.postId === "string") {
    const doc = await ctx.db.get(payload.postId as Id<"experience_posts">);
    if (doc) {
      const author = await ctx.db.get(doc.author_id);
      const place = doc.place_id ? await ctx.db.get(doc.place_id) : null;
      const media = await ctx.db
        .query("post_media")
        .withIndex("by_post_order", (q) => q.eq("post_id", doc._id))
        .first();
      post = {
        id: doc._id as string,
        caption: doc.caption ?? null,
        verificationStatus: doc.verification_status,
        author: author
          ? {
              username: author.username,
              display_name: author.display_name,
              avatar_path:
                author.avatar_storage_id === undefined
                  ? null
                  : await ctx.storage.getUrl(author.avatar_storage_id),
            }
          : { username: "", display_name: "Người dùng", avatar_path: null },
        placeName: place?.name ?? null,
        thumbnail: media ? await ctx.storage.getUrl(media.storage_id) : null,
      };
    }
  }
  let place = null;
  const placeId = typeof payload.placeId === "string" ? payload.placeId : null;
  if ((msg.kind === "place" || msg.kind === "invite") && placeId) {
    const doc = await ctx.db.get(placeId as Id<"places">);
    if (doc) {
      const category = doc.category_id ? await ctx.db.get(doc.category_id) : null;
      const moods = await ctx.db
        .query("place_moods")
        .withIndex("by_place", (q) => q.eq("place_id", doc._id))
        .collect();
      let moodName: string | null = null;
      let best = -1;
      for (const link of moods) {
        if (link.weight <= best) continue;
        const mood = await ctx.db.get(link.mood_id);
        if (mood) {
          best = link.weight;
          moodName = mood.name_vi;
        }
      }
      const cost = await ctx.db
        .query("place_cost_stats")
        .withIndex("by_place", (q) => q.eq("place_id", doc._id))
        .unique();
      const exp = await ctx.db
        .query("place_experience_stats")
        .withIndex("by_place", (q) => q.eq("place_id", doc._id))
        .unique();
      const spend = cost?.median_spend_per_person;
      place = {
        id: doc._id as string,
        slug: doc.slug,
        name: doc.name,
        district: doc.district ?? null,
        categoryName: category?.name_vi ?? null,
        cover: doc.cover_image_path ?? null,
        moodName,
        spendLabel:
          spend === undefined
            ? null
            : spend === 0
              ? "Miễn phí"
              : `~${Math.round(spend / 1000)}K/người`,
        verified: (exp?.verified_sample_count ?? 0) > 0,
      };
    }
  }
  let profile = null;
  if (msg.kind === "profile" && typeof payload.username === "string") {
    const person = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", payload.username as string))
      .unique();
    if (person) {
      profile = {
        id: person._id as string,
        username: person.username,
        display_name: person.display_name,
        avatar_path:
          person.avatar_storage_id === undefined ? null : await ctx.storage.getUrl(person.avatar_storage_id),
        bio: person.bio ?? null,
        followers: null as number | null,
      };
    }
  }
  return {
    id: msg._id as string,
    conversation_id: msg.conversation_id as string,
    sender_id: msg.sender_id as string,
    body: msg.body ?? null,
    kind: msg.kind,
    payload,
    created_at: new Date(msg.created_at).toISOString(),
    deleted_at: iso(msg.deleted_at),
    edited_at: iso(msg.edited_at),
    client_id: msg.client_id ?? null,
    reply_to_message_id: msg.reply_to_message_id ?? null,
    reply,
    sender: sender ? await profileLite(ctx, sender) : null,
    reactions: [...grouped.entries()].map(([reaction, value]) => ({ reaction, ...value })),
    imageUrl,
    post,
    place,
    profile,
    invite:
      msg.kind === "invite"
        ? {
            invitationId: typeof payload.invitationId === "string" ? payload.invitationId : null,
            status: inviteStatusOf(payload.status),
            suggestedDate: typeof payload.suggestedDate === "string" ? payload.suggestedDate : null,
            suggestedTime: typeof payload.suggestedTime === "string" ? payload.suggestedTime : null,
            note: typeof payload.note === "string" ? payload.note : (msg.body ?? null),
          }
        : null,
    status: "sent" as const,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const mine = await ctx.db
      .query("conversation_participants")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .take(80);
    const out = [];
    for (const row of mine) {
      const convo = await ctx.db.get(row.conversation_id);
      if (!convo) continue;
      const other = await peerRow(ctx, row.conversation_id, profile._id);
      const otherProfile = other ? await ctx.db.get(other.user_id) : null;
      const last = await ctx.db
        .query("messages")
        .withIndex("by_conversation_created", (q) => q.eq("conversation_id", row.conversation_id))
        .order("desc")
        .first();
      const unread = Boolean(
        last &&
          last.deleted_at === undefined &&
          last.sender_id !== profile._id &&
          (row.last_read_at === undefined || last.created_at > row.last_read_at),
      );
      out.push({
        id: row.conversation_id as string,
        other: otherProfile ? await profileLite(ctx, otherProfile) : null,
        last: last
          ? {
              id: last._id as string,
              body: last.body ?? null,
              kind: last.kind,
              sender_id: last.sender_id as string,
              created_at: new Date(last.created_at).toISOString(),
              deleted_at: iso(last.deleted_at),
            }
          : null,
        unread,
        lastAt: new Date(convo.last_message_at || last?.created_at || convo.created_at).toISOString(),
        muted: row.muted,
      });
    }
    return out.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await optionalIdentity(ctx);
    if (identity === null) return 0;
    const rows = await ctx.db
      .query("conversation_participants")
      .withIndex("by_user", (q) => q.eq("user_id", identity.profile._id))
      .take(80);
    let count = 0;
    for (const row of rows) {
      const last = await ctx.db
        .query("messages")
        .withIndex("by_conversation_created", (q) => q.eq("conversation_id", row.conversation_id))
        .order("desc")
        .first();
      if (
        last &&
        last.deleted_at === undefined &&
        last.sender_id !== identity.profile._id &&
        (row.last_read_at === undefined || last.created_at > row.last_read_at)
      ) {
        count += 1;
      }
    }
    return count;
  },
});

export const peer = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const mine = await membership(ctx, args.conversationId, profile._id);
    if (mine === null) return null;
    const other = await peerRow(ctx, args.conversationId, profile._id);
    if (other === null) return null;
    const person = await ctx.db.get(other.user_id);
    const blockedByMe = await ctx.db
      .query("user_blocks")
      .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(profile._id, other.user_id)))
      .unique();
    const blockedMe = await ctx.db
      .query("user_blocks")
      .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(other.user_id, profile._id)))
      .unique();
    return {
      profile: person ? await profileLite(ctx, person) : null,
      muted: mine.muted,
      blockedByMe: blockedByMe !== null,
      blocked: blockedByMe !== null || blockedMe !== null,
      peerLastReadAt: iso(other.last_read_at),
    };
  },
});

export const thread = query({
  args: {
    conversationId: v.id("conversations"),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const mine = await membership(ctx, args.conversationId, profile._id);
    invariant(mine !== null, "FORBIDDEN", "Conversation membership required");
    const other = await peerRow(ctx, args.conversationId, profile._id);
    const blocked = other ? await areBlocked(ctx, profile._id, other.user_id) : false;
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) => q.eq("conversation_id", args.conversationId))
      .order("desc")
      .take(200);
    const filtered =
      args.cursor === undefined ? rows : rows.filter((row) => row.created_at < args.cursor!);
    const page = filtered.slice(0, PAGE);
    const nextCursor = filtered.length > PAGE ? page[page.length - 1]?.created_at ?? null : null;
    const chronological = [...page].reverse();
    const messages = [];
    for (const row of chronological) messages.push(await hydrateOne(ctx, row, profile._id));
    const typingRows = await ctx.db
      .query("conversation_typing")
      .withIndex("by_conversation_expiry", (q) => q.eq("conversation_id", args.conversationId))
      .collect();
    const now = Date.now();
    const typing = typingRows.some(
      (row) => row.user_id !== profile._id && row.expires_at > now,
    );
    return {
      messages,
      nextCursor: nextCursor === null ? null : new Date(nextCursor).toISOString(),
      typing,
      peerLastReadAt: iso(other?.last_read_at),
      muted: mine.muted,
      blocked,
      blockedByMe: other
        ? (await ctx.db
            .query("user_blocks")
            .withIndex("by_pair", (q) => q.eq("pair_key", pairKey(profile._id, other.user_id)))
            .unique()) !== null
        : false,
    };
  },
});

export const byId = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const msg = await ctx.db.get(args.messageId);
    if (msg === null) return null;
    const mine = await membership(ctx, msg.conversation_id, profile._id);
    if (mine === null) return null;
    return await hydrateOne(ctx, msg, profile._id);
  },
});

export const searchPeople = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const needle = normalizeSearchText(args.query).slice(0, 40);
    if (needle.length < 2) return [];
    const rows = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "user"))
      .take(80);
    const out = [];
    for (const row of rows) {
      if (row._id === profile._id || row.username === "realidi") continue;
      if (row.deleted_at !== undefined || row.banned_at !== undefined) continue;
      const hay = normalizeSearchText(`${row.username} ${row.display_name}`);
      if (!hay.includes(needle)) continue;
      out.push(await profileLite(ctx, row));
      if (out.length >= 12) break;
    }
    return out;
  },
});

export const attachablePlaces = query({
  args: {},
  handler: async (ctx) => {
    await requireVerifiedProfile(ctx);
    const rows = await ctx.db
      .query("places")
      .withIndex("by_city_status", (q) => q.eq("city", "TP. Hồ Chí Minh").eq("status", "active"))
      .take(40);
    const out = [];
    for (const place of rows.sort((a, b) => a.name.localeCompare(b.name, "vi"))) {
      const category = place.category_id ? await ctx.db.get(place.category_id) : null;
      out.push({
        id: place._id as string,
        slug: place.slug,
        name: place.name,
        district: place.district ?? null,
        cover_image_path: place.cover_image_path ?? null,
        categoryName: category?.name_vi ?? null,
      });
    }
    return out;
  },
});

export const attachablePosts = query({
  args: {},
  handler: async (ctx) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const authored = await ctx.db
      .query("experience_posts")
      .withIndex("by_author_created", (q) => q.eq("author_id", profile._id))
      .order("desc")
      .take(20);
    const saved = await ctx.db
      .query("saved_posts")
      .withIndex("by_user_created", (q) => q.eq("user_id", profile._id))
      .take(20);
    const items: Array<{ id: string; caption: string | null; placeName: string | null }> = [];
    const seen = new Set<string>();
    for (const post of authored) {
      if (post.status !== "published" || post.deleted_at !== undefined) continue;
      const place = post.place_id ? await ctx.db.get(post.place_id) : null;
      items.push({ id: post._id, caption: post.caption ?? null, placeName: place?.name ?? null });
      seen.add(post._id);
    }
    for (const row of saved) {
      if (seen.has(row.post_id)) continue;
      const post = await ctx.db.get(row.post_id);
      if (!post || post.status !== "published" || post.deleted_at !== undefined) continue;
      const place = post.place_id ? await ctx.db.get(post.place_id) : null;
      items.push({ id: post._id, caption: post.caption ?? null, placeName: place?.name ?? null });
    }
    return items.slice(0, 24);
  },
});

export const shared = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    invariant(
      (await membership(ctx, args.conversationId, profile._id)) !== null,
      "FORBIDDEN",
      "Conversation membership required",
    );
    const rows = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) => q.eq("conversation_id", args.conversationId))
      .order("desc")
      .take(80);
    const out = [];
    for (const row of rows) {
      if (row.deleted_at !== undefined) continue;
      if (row.kind !== "image" && row.kind !== "place" && row.kind !== "post" && row.kind !== "invite") continue;
      out.push(await hydrateOne(ctx, row, profile._id));
      if (out.length >= 60) break;
    }
    return out;
  },
});

export const shareRecipients = query({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const seen = new Set<string>([profile._id]);
    const people: Array<{
      id: string;
      username: string;
      display_name: string;
      avatar_path: string | null;
      source: string;
    }> = [];
    const convos = await ctx.db
      .query("conversation_participants")
      .withIndex("by_user", (q) => q.eq("user_id", profile._id))
      .take(40);
    for (const row of convos) {
      const other = await peerRow(ctx, row.conversation_id, profile._id);
      if (!other || seen.has(other.user_id)) continue;
      const person = await ctx.db.get(other.user_id);
      if (!person) continue;
      seen.add(person._id);
      const lite = await profileLite(ctx, person);
      people.push({ ...lite, source: "recent" });
    }
    const q = args.query?.trim() ?? "";
    if (q.length >= 2) {
      const found = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q2) => q2.eq("role", "user"))
        .take(80);
      const needle = normalizeSearchText(q);
      for (const row of found) {
        if (seen.has(row._id) || row.deleted_at !== undefined) continue;
        if (!normalizeSearchText(`${row.username} ${row.display_name}`).includes(needle)) continue;
        seen.add(row._id);
        const lite = await profileLite(ctx, row);
        people.push({ ...lite, source: "search" });
      }
    } else {
      const follows = await ctx.db
        .query("follows")
        .withIndex("by_follower", (q2) => q2.eq("follower_id", profile._id))
        .take(20);
      for (const follow of follows) {
        if (seen.has(follow.following_id)) continue;
        const person = await ctx.db.get(follow.following_id);
        if (!person) continue;
        seen.add(person._id);
        const lite = await profileLite(ctx, person);
        people.push({ ...lite, source: "following" });
      }
    }
    return people.slice(0, 16);
  },
});

export const getOrCreateDirect = mutation({
  args: { userId: v.id("profiles") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    return await ensureDirect(ctx, profile._id, args.userId);
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.optional(v.string()),
    kind: v.optional(messageKind),
    payload: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
    clientId: v.optional(v.string()),
    replyToMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    await requireConversationMember(ctx, args.conversationId);
    const other = await requirePeer(ctx, args.conversationId, profile._id);
    if (args.clientId) {
      const key = `${profile._id}:${args.clientId}`;
      const dup = await ctx.db
        .query("messages")
        .withIndex("by_sender_client", (q) => q.eq("sender_client_key", key))
        .unique();
      if (dup) return await hydrateOne(ctx, dup, profile._id);
    }
    if (args.replyToMessageId) {
      const parent = await ctx.db.get(args.replyToMessageId);
      invariant(parent !== null && parent.conversation_id === args.conversationId, "NOT_FOUND", "Reply target missing");
    }
    const kind = args.kind ?? "text";
    const payload = args.payload ?? {};
    if (kind === "image") {
      invariant(typeof payload.storageId === "string", "VALIDATION_FAILED", "Image requires storageId");
      const meta = await ctx.db.system.get(payload.storageId as Id<"_storage">);
      invariant(meta !== null, "NOT_FOUND", "Upload not found");
    }
    const body = args.body?.trim() || undefined;
    invariant(kind !== "text" || Boolean(body), "VALIDATION_FAILED", "Empty message");
    if (body) invariant(body.length <= 2000, "VALIDATION_FAILED", "Message too long");
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversation_id: args.conversationId,
      sender_id: profile._id,
      body,
      kind,
      payload,
      reply_to_message_id: args.replyToMessageId,
      client_id: args.clientId,
      sender_client_key: args.clientId ? `${profile._id}:${args.clientId}` : undefined,
      created_at: now,
    });
    await ctx.db.patch(args.conversationId, { last_message_at: now });
    const recentlyActive = other.last_read_at !== undefined && now - other.last_read_at < RECENT_READ_MS;
    if (!other.muted && !recentlyActive) {
      await notifyEvent(ctx, {
        recipientId: other.user_id,
        type: "message",
        messageId,
        metadata: { conversation_id: args.conversationId, message_id: messageId },
      });
    }
    const created = await ctx.db.get(messageId);
    return await hydrateOne(ctx, created!, profile._id);
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), body: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const msg = await ctx.db.get(args.messageId);
    invariant(msg !== null, "NOT_FOUND", "Message not found");
    await requireConversationMember(ctx, msg.conversation_id);
    invariant(msg.sender_id === profile._id && msg.kind === "text", "FORBIDDEN", "Cannot edit");
    const trimmed = args.body.trim();
    invariant(trimmed.length >= 1 && trimmed.length <= 2000, "VALIDATION_FAILED", "Invalid body");
    await ctx.db.patch(msg._id, { body: trimmed, edited_at: Date.now() });
    return { ok: true as const };
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const msg = await ctx.db.get(args.messageId);
    invariant(msg !== null, "NOT_FOUND", "Message not found");
    await requireConversationMember(ctx, msg.conversation_id);
    invariant(msg.sender_id === profile._id, "FORBIDDEN", "Cannot delete");
    await ctx.db.patch(msg._id, { deleted_at: Date.now(), body: undefined });
    return { ok: true as const };
  },
});

export const toggleReaction = mutation({
  args: { messageId: v.id("messages"), reaction: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    invariant((REACTIONS as readonly string[]).includes(args.reaction), "VALIDATION_FAILED", "Invalid reaction");
    const msg = await ctx.db.get(args.messageId);
    invariant(msg !== null, "NOT_FOUND", "Message not found");
    await requireConversationMember(ctx, msg.conversation_id);
    const key = pairKey(profile._id, args.messageId);
    const existing = await ctx.db
      .query("message_reactions")
      .withIndex("by_pair", (q) => q.eq("pair_key", key))
      .unique();
    if (existing?.reaction === args.reaction) {
      await ctx.db.delete(existing._id);
      return { reaction: null };
    }
    if (existing) {
      await ctx.db.patch(existing._id, { reaction: args.reaction as (typeof REACTIONS)[number] });
      return { reaction: args.reaction };
    }
    await ctx.db.insert("message_reactions", {
      message_id: args.messageId,
      user_id: profile._id,
      pair_key: key,
      reaction: args.reaction as (typeof REACTIONS)[number],
      created_at: Date.now(),
    });
    return { reaction: args.reaction };
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const mine = await membership(ctx, args.conversationId, profile._id);
    invariant(mine !== null, "FORBIDDEN", "Conversation membership required");
    await ctx.db.patch(mine._id, { last_read_at: Date.now() });
    return { ok: true as const };
  },
});

export const toggleMute = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const mine = await membership(ctx, args.conversationId, profile._id);
    invariant(mine !== null, "FORBIDDEN", "Conversation membership required");
    await ctx.db.patch(mine._id, { muted: !mine.muted });
    return { muted: !mine.muted };
  },
});

export const inviteToPlace = mutation({
  args: {
    placeId: v.id("places"),
    toUserId: v.optional(v.id("profiles")),
    conversationId: v.optional(v.id("conversations")),
    note: v.optional(v.string()),
    suggestedDate: v.optional(v.string()),
    suggestedTime: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const place = await ctx.db.get(args.placeId);
    invariant(place !== null, "NOT_FOUND", "Place not found");
    let conversationId = args.conversationId;
    if (!conversationId && args.toUserId) {
      conversationId = await ensureDirect(ctx, profile._id, args.toUserId);
    }
    invariant(conversationId !== undefined, "VALIDATION_FAILED", "NO_RECIPIENT");
    await requireConversationMember(ctx, conversationId);
    const other = await requirePeer(ctx, conversationId, profile._id);
    const now = Date.now();
    const invitationId = await ctx.db.insert("place_invitations", {
      place_id: args.placeId,
      from_user_id: profile._id,
      to_user_id: other.user_id,
      conversation_id: conversationId,
      suggested_date: args.suggestedDate,
      suggested_time: args.suggestedTime,
      note: args.note,
      status: "pending",
      created_at: now,
    });
    const messageId = await ctx.db.insert("messages", {
      conversation_id: conversationId,
      sender_id: profile._id,
      body: args.note,
      kind: "invite",
      payload: {
        placeId: args.placeId,
        placeName: place.name,
        placeSlug: place.slug,
        placeDistrict: place.district ?? null,
        suggestedDate: args.suggestedDate ?? null,
        suggestedTime: args.suggestedTime ?? null,
        invitationId,
        status: "pending",
        note: args.note ?? null,
      },
      created_at: now,
    });
    await ctx.db.patch(invitationId, { message_id: messageId });
    await ctx.db.patch(conversationId, { last_message_at: now });
    if (!other.muted) {
      await notifyEvent(ctx, {
        recipientId: other.user_id,
        type: "place_invite",
        messageId,
        metadata: { conversation_id: conversationId, invitation_id: invitationId },
      });
    }
    return conversationId;
  },
});

export const respondToInvite = mutation({
  args: {
    invitationId: v.id("place_invitations"),
    messageId: v.id("messages"),
    status: invitationStatus,
  },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    const invite = await ctx.db.get(args.invitationId);
    invariant(invite !== null && invite.to_user_id === profile._id, "FORBIDDEN", "Not your invite");
    const msg = await ctx.db.get(args.messageId);
    invariant(msg !== null, "NOT_FOUND", "Message not found");
    await requireConversationMember(ctx, msg.conversation_id);
    const now = Date.now();
    await ctx.db.patch(invite._id, { status: args.status, responded_at: now });
    await ctx.db.patch(msg._id, {
      payload: { ...msg.payload, status: args.status },
    });
    return { ok: true as const };
  },
});

export const setTyping = mutation({
  args: { conversationId: v.id("conversations"), sessionKey: v.string() },
  handler: async (ctx, args) => {
    const { profile } = await requireVerifiedProfile(ctx);
    await requireConversationMember(ctx, args.conversationId);
    const key = `${args.conversationId}:${profile._id}:${args.sessionKey}`;
    const existing = await ctx.db
      .query("conversation_typing")
      .withIndex("by_session_key", (q) => q.eq("session_key", key))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { typed_at: now, expires_at: now + TYPING_MS });
    } else {
      await ctx.db.insert("conversation_typing", {
        conversation_id: args.conversationId,
        user_id: profile._id,
        session_key: key,
        typed_at: now,
        expires_at: now + TYPING_MS,
      });
    }
    return { ok: true as const };
  },
});
