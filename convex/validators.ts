import { v } from "convex/values";

export const userRole = v.union(
  v.literal("user"), v.literal("creator"), v.literal("moderator"),
  v.literal("editor"), v.literal("admin"), v.literal("owner"),
);
export type UserRole = "user" | "creator" | "moderator" | "editor" | "admin" | "owner";

export const moodLayer = v.union(v.literal("current_state"), v.literal("desired_feeling"));
export const placeStatus = v.union(
  v.literal("active"), v.literal("pending"), v.literal("temporarily_closed"),
  v.literal("permanently_closed"), v.literal("hidden"), v.literal("merged"),
  v.literal("draft"), v.literal("archived"),
);
export const placeSource = v.union(
  v.literal("editorial"), v.literal("user"), v.literal("import"), v.literal("provider"),
);
export const postStatus = v.union(
  v.literal("draft"), v.literal("published"), v.literal("hidden"), v.literal("deleted"),
);
export const postType = v.union(
  v.literal("experience"), v.literal("check_in"), v.literal("photo"),
  v.literal("video"), v.literal("community"), v.literal("question"),
);
export const postVisibility = v.union(
  v.literal("public"), v.literal("followers"), v.literal("private"),
);
export const verificationStatus = v.union(
  v.literal("unverified"), v.literal("verification_pending"),
  v.literal("verified"), v.literal("verification_failed"),
);
export const verificationMethod = v.union(
  v.literal("onsite_geolocation"), v.literal("admin"),
  v.literal("media_evidence"), v.literal("partner"),
);
export const verificationResult = v.union(
  v.literal("pending"), v.literal("verified"), v.literal("failed"),
);
export const moderationStatus = v.union(
  v.literal("pending"), v.literal("approved"), v.literal("hidden"), v.literal("rejected"),
);
export const visitContext = v.union(
  v.literal("solo"), v.literal("couple"), v.literal("friends"),
  v.literal("family"), v.literal("work"), v.literal("other"),
);
export const crowdLevel = v.union(
  v.literal("quiet"), v.literal("normal"), v.literal("busy"), v.literal("very_busy"),
);
export const visitDayType = v.union(
  v.literal("weekday"), v.literal("weekend"), v.literal("holiday"),
);
export const visitTimePeriod = v.union(
  v.literal("morning"), v.literal("afternoon"), v.literal("evening"), v.literal("night"),
);
export const mediaType = v.union(v.literal("image"), v.literal("video"));
export const confidenceTier = v.union(
  v.literal("early_signal"), v.literal("emerging"), v.literal("established"),
);
export const reportStatus = v.union(
  v.literal("pending"), v.literal("investigating"), v.literal("resolved"), v.literal("dismissed"),
);
export const reportPriority = v.union(
  v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"),
);
export const reportTargetType = v.union(
  v.literal("post"), v.literal("comment"), v.literal("user"), v.literal("place"),
  v.literal("message"), v.literal("conversation"),
);
export const moderationTargetType = v.union(
  v.literal("post"), v.literal("comment"), v.literal("user"),
  v.literal("place"), v.literal("report"),
);
export const notificationType = v.union(
  v.literal("new_follower"), v.literal("post_like"), v.literal("post_comment"),
  v.literal("comment_reply"), v.literal("post_saved"), v.literal("verified_visit"),
  v.literal("system"), v.literal("message"), v.literal("community_answer"),
  v.literal("place_invite"),
);
export const messageKind = v.union(
  v.literal("text"), v.literal("post"), v.literal("place"), v.literal("profile"),
  v.literal("invite"), v.literal("image"), v.literal("system"),
);
export const invitationStatus = v.union(
  v.literal("pending"), v.literal("accepted"), v.literal("maybe"), v.literal("declined"),
);
export const saveIntent = v.union(v.literal("saved"), v.literal("want_to_go"));
export const feedbackKind = v.union(v.literal("fit"), v.literal("wrong_mood"));
export const editorialKind = v.union(
  v.literal("place"), v.literal("post"), v.literal("mood"),
  v.literal("home"), v.literal("explore"),
);
export const editorialStatus = v.union(
  v.literal("draft"), v.literal("published"), v.literal("archived"),
);
export const featuredSurface = v.union(v.literal("home"), v.literal("explore"));
export const reaction = v.union(
  v.literal("❤️"), v.literal("👍"), v.literal("😂"), v.literal("😮"), v.literal("😢"),
);
export const entityType = v.union(
  v.literal("place"), v.literal("mood"), v.literal("author"),
  v.literal("post"), v.literal("category"), v.literal("area"),
);

export const scalarJson = v.union(v.null(), v.boolean(), v.number(), v.string());
export const flatJson = v.record(v.string(), scalarJson);
export const timestamp = v.number();
export const optionalTimestamp = v.optional(timestamp);
export const nonNegativeNumber = v.number();
export const normalizedKey = v.string();
