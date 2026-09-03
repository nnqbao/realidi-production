import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "Tên người dùng cần từ 3 đến 30 ký tự.")
  .max(30, "Tên người dùng cần từ 3 đến 30 ký tự.")
  .regex(/^[a-z0-9_]+$/, "Chỉ dùng chữ thường, số và dấu gạch dưới.");

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/g, "").toLowerCase();
}

export const signUpSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự.").max(72),
    confirmPassword: z.string().min(8).max(72),
    displayName: z.string().min(2).max(60),
    username: usernameSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận chưa khớp.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8).max(72),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().min(2).max(60),
  username: usernameSchema,
  bio: z.string().max(280).optional().nullable(),
});

export const onboardingSchema = z.object({
  currentStateMoodId: z.string().uuid().optional().nullable(),
  desiredMoodIds: z.array(z.string().uuid()).max(3),
  styleIds: z.array(z.string().uuid()).max(4),
  visitContexts: z.array(
    z.enum(["solo", "couple", "friends", "family", "work", "other"]),
  ),
  budgetMax: z.number().int().positive().optional().nullable(),
  timeMinutes: z.number().int().positive().optional().nullable(),
});

export const discoveryFiltersSchema = z.object({
  moodId: z.string().uuid().optional().nullable(),
  radiusMeters: z.coerce.number().int().positive().max(50_000).optional().nullable(),
  budgetMax: z.coerce.number().int().positive().optional().nullable(),
  timeMinutes: z.coerce.number().int().positive().max(24 * 60).optional().nullable(),
  crowd: z.enum(["quiet", "normal", "busy", "very_busy"]).optional().nullable(),
  visitContext: z.enum(["solo", "couple", "friends", "family", "work", "other"]).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  styleId: z.string().uuid().optional().nullable(),
  q: z.string().max(80).optional().nullable(),
  lat: z.coerce.number().optional().nullable(),
  lng: z.coerce.number().optional().nullable(),
});

export const experienceCreateSchema = z.object({
  placeId: z.string().uuid().optional().nullable(),
  postType: z.enum(["experience", "check_in", "photo", "video", "community", "question"]).optional(),
  caption: z.string().max(2000).optional().nullable(),
  visitDate: z.string().optional().nullable(),
  visitContext: z.enum(["solo", "couple", "friends", "family", "work", "other"]).optional().nullable(),
  moodRatings: z
    .array(
      z.object({
        moodId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
      }),
    )
    .max(5)
    .default([]),
  crowdLevel: z.enum(["quiet", "normal", "busy", "very_busy"]).optional().nullable(),
  worthIt: z.number().int().min(1).max(5).optional().nullable(),
  spendPerPerson: z.number().int().min(0).max(50_000_000).optional().nullable(),
  visitDayType: z.enum(["weekday", "weekend", "holiday"]).optional().nullable(),
  visitTimePeriod: z.enum(["morning", "afternoon", "evening", "night"]).optional().nullable(),
  mediaPaths: z.array(z.string().min(1)).max(8).default([]),
  areaLabel: z.string().max(80).optional().nullable(),
  budgetMax: z.number().int().positive().optional().nullable(),
  timeLabel: z.string().max(40).optional().nullable(),
  crowdPreference: z.enum(["quiet", "normal", "busy", "very_busy"]).optional().nullable(),
});

export const commentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional().nullable(),
});

export const reportSchema = z.object({
  targetType: z.enum(["post", "comment", "user", "place", "message", "conversation"]),
  targetId: z.string().uuid(),
  reason: z.enum([
    "spam",
    "harassment",
    "hate",
    "inappropriate",
    "misleading",
    "impersonation",
    "privacy",
    "offensive",
    "other",
  ]),
  details: z.string().max(1000).optional().nullable(),
});

export const verifyVisitSchema = z.object({
  placeId: z.string().uuid(),
  experiencePostId: z.string().uuid().optional().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  accuracyMeters: z.number().optional().nullable(),
});

export const moodAdminSchema = z.object({
  slug: z.string().min(2).max(40),
  layer: z.enum(["current_state", "desired_feeling"]),
  nameVi: z.string().min(1).max(80),
  nameEn: z.string().min(1).max(80),
  descriptionVi: z.string().max(300).optional().nullable(),
  descriptionEn: z.string().max(300).optional().nullable(),
  colorToken: z.string().min(1).max(40),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
});

export const placeAdminSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120),
  shortDescription: z.string().max(180).optional().nullable(),
  description: z.string().max(4000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  district: z.string().max(80).optional().nullable(),
  city: z.string().min(1).max(80),
  latitude: z.number(),
  longitude: z.number(),
  priceLevel: z.number().int().min(1).max(4).optional().nullable(),
  typicalDurationMinutes: z.number().int().positive().optional().nullable(),
  editorialScore: z.number().min(0).max(1),
  adminQualityScore: z.number().min(0).max(1),
  status: z.enum([
    "active",
    "pending",
    "draft",
    "temporarily_closed",
    "permanently_closed",
    "hidden",
    "merged",
    "archived",
  ]),
  phone: z.string().max(40).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  googleMapsUrl: z.string().max(500).optional().nullable(),
  seoTitle: z.string().max(80).optional().nullable(),
  seoDescription: z.string().max(180).optional().nullable(),
  coverImagePath: z.string().max(400).optional().nullable(),
});

export const rankingConfigSchema = z.object({
  moodMatchWeight: z.number().min(0).max(1),
  trustWeight: z.number().min(0).max(1),
  freshnessWeight: z.number().min(0).max(1),
  proximityWeight: z.number().min(0).max(1),
  qualityEngagementWeight: z.number().min(0).max(1),
  bayesianPriorMean: z.number().min(1).max(5),
  bayesianPriorStrength: z.number().min(1).max(50),
  geofenceRadiusMeters: z.number().int().min(30).max(2000),
});
