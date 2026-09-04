/**
 * Hosted/demo seed: creates auth users + experiences after taxonomy/places SQL has run.
 *
 *   npx tsx scripts/seed-demo.ts
 *
 * Opt-in only. Requires ENABLE_DEMO_SEED=true, SUPABASE_SERVICE_ROLE_KEY,
 * and SEED_DEMO_CREDENTIALS_JSON in ignored local environment.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // .env.local optional if vars already exported
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const PEACEFUL = "11111111-1111-4111-8111-111111111001";
const RECHARGED = "11111111-1111-4111-8111-111111111002";
const INSPIRED = "11111111-1111-4111-8111-111111111003";
const WORKSHOP = "44444444-4444-4444-8444-444444444001";
const TAODAN = "44444444-4444-4444-8444-444444444005";
const DINH = "44444444-4444-4444-8444-444444444007";
const DECK = "44444444-4444-4444-8444-444444444015";

if (process.env.ENABLE_DEMO_SEED !== "true") {
  console.error("Demo seed is disabled. Set ENABLE_DEMO_SEED=true explicitly.");
  process.exit(1);
}

type DemoCredentials = Record<string, { email: string; password: string }>;
let credentials: DemoCredentials;
try {
  credentials = JSON.parse(process.env.SEED_DEMO_CREDENTIALS_JSON ?? "") as DemoCredentials;
} catch {
  console.error("SEED_DEMO_CREDENTIALS_JSON must be valid JSON in ignored local environment.");
  process.exit(1);
}

const demoProfiles = [
  { username: "realidi", name: "Realidi", role: "admin" },
  { username: "linhsaigon", name: "Linh Trần", role: "user" },
  { username: "minhwander", name: "Minh Võ", role: "creator" },
  { username: "ancafe", name: "An Nguyễn", role: "user" },
] as const;

const demoUsers = demoProfiles.map((profile) => {
  const supplied = credentials[profile.username];
  if (!supplied?.email || !supplied.password || supplied.password.length < 8) {
    throw new Error(`Missing valid ignored credentials for demo profile ${profile.username}`);
  }
  return { ...profile, ...supplied };
});

const bios: Record<string, string> = {
  realidi: "Tài khoản chính thức của Realidi.",
  linhsaigon: "Hay ngồi quán cà phê yên ở Sài Gòn.",
  minhwander: "Đi bộ công viên buổi sáng, rồi viết trải nghiệm.",
  ancafe: "Thích chỗ có câu chuyện, không phải chỗ đông để chụp.",
};

async function main() {
  const ids: Record<string, string> = {};
  for (const u of demoUsers) {
    const created = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username, display_name: u.name },
    });
    const id = created.data.user?.id;
    if (!id) {
      const { data } = await admin
        .from("profiles")
        .select("id")
        .in("username", u.username === "realidi" ? ["realidi", "feltadmin"] : [u.username])
        .maybeSingle();
      if (data) ids[u.username] = data.id;
      if (data && u.username === "realidi") {
        await admin
          .from("profiles")
          .update({ username: "realidi", display_name: "Realidi", bio: bios.realidi, role: "admin" })
          .eq("id", data.id);
      }
      continue;
    }
    ids[u.username] = id;
    await admin.from("profiles").update({ role: u.role, bio: bios[u.username] ?? null }).eq("id", id);
  }

  const linh = ids.linhsaigon;
  const minh = ids.minhwander;
  const an = ids.ancafe;
  if (!linh || !minh || !an) {
    console.log("Demo users are ready or already existed.");
  }

  const posts = [
    {
      author: linh,
      place: WORKSHOP,
      caption: "Ngồi tầng trên gần hai tiếng. Cà phê sạch, ồn bên dưới không len lên nhiều. Đúng chỗ khi đầu đang đầy.",
      mood: PEACEFUL,
      rating: 5,
      crowd: "quiet",
      worth: 5,
      spend: 95000,
      context: "solo",
      verified: true,
      hoursAgo: 5,
      day: "weekday",
      period: "morning",
    },
    {
      author: minh,
      place: TAODAN,
      caption: "Sáng sớm, còn sương trên lá. Đi bộ 40 phút rồi ra uống nước. Thành phố chưa kịp ồn.",
      mood: RECHARGED,
      rating: 5,
      crowd: "quiet",
      worth: 5,
      spend: 0,
      context: "solo",
      verified: true,
      hoursAgo: 26,
      day: "weekend",
      period: "morning",
    },
    {
      author: an,
      place: DINH,
      caption: "Lần đầu vào đường hầm. Nặng hơn mình nghĩ — nhưng đó là lý do nên đi, không phải để check-in.",
      mood: INSPIRED,
      rating: 4,
      crowd: "normal",
      worth: 4,
      spend: 40000,
      context: "friends",
      verified: false,
      hoursAgo: 54,
      day: "weekend",
      period: "afternoon",
    },
    {
      author: linh,
      place: DECK,
      caption: "Hoàng hôn trên sông, bàn sát lan can. Đắt, nhưng đúng mood muốn chậm với một người.",
      mood: "11111111-1111-4111-8111-111111111006",
      rating: 5,
      crowd: "normal",
      worth: 4,
      spend: 850000,
      context: "couple",
      verified: true,
      hoursAgo: 90,
      day: "weekday",
      period: "evening",
    },
  ];

  for (const p of posts) {
    if (!p.author) continue;
    const { data: post } = await admin
      .from("experience_posts")
      .insert({
        author_id: p.author,
        place_id: p.place,
        caption: p.caption,
        status: "published",
        published_at: new Date(Date.now() - p.hoursAgo * 3600_000).toISOString(),
        visit_context: p.context,
        verification_status: p.verified ? "verified" : "unverified",
      })
      .select("id")
      .single();
    if (!post) continue;
    await admin.from("experience_mood_ratings").insert({
      experience_post_id: post.id,
      mood_id: p.mood,
      rating: p.rating,
    });
    await admin.from("experience_metrics").insert({
      experience_post_id: post.id,
      crowd_level: p.crowd,
      worth_it: p.worth,
      spend_per_person: p.spend,
      visit_day_type: p.day,
      visit_time_period: p.period,
    });
    if (p.verified) {
      await admin.from("visit_verifications").insert({
        user_id: p.author,
        place_id: p.place,
        experience_post_id: post.id,
        method: "admin",
        result: "verified",
        confidence: 1,
        distance_meters: 18,
        verified_at: new Date().toISOString(),
        metadata: { seeded: true },
      });
      await admin.from("visit_claims").upsert({ user_id: p.author, place_id: p.place });
    }
    await admin.rpc("refresh_place_aggregates", { p_place_id: p.place });
    await admin.rpc("refresh_place_time_stats", { p_place_id: p.place });
  }

  if (linh && minh) {
    await admin.from("follows").upsert({ follower_id: linh, following_id: minh });
    await admin.from("saves").upsert({ user_id: linh, place_id: WORKSHOP });
    await admin.from("saves").upsert({ user_id: minh, place_id: TAODAN });
  }

  console.log("Demo seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
