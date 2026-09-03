export type WhyThisMatchInput = {
  moodName?: string | null;
  reasons: string[];
  crowd: string | null;
  bestContext: string | null;
  bestTime: string | null;
  typicalSpend: number | null;
  budgetMax: number | null;
  verifiedCount: number;
  isEditorialPick: boolean;
  distanceMeters: number | null;
};

export function whyThisMatchLines(input: WhyThisMatchInput): string[] {
  const lines: string[] = [];
  if (
    input.moodName &&
    (input.reasons.includes("mood_strong") || input.reasons.includes("mood_moderate"))
  ) {
    lines.push(`Phù hợp với mood ${input.moodName}`);
  }
  if (input.crowd === "quiet" && input.bestTime === "morning") {
    lines.push("Thường yên vào buổi sáng");
  } else if (input.crowd === "quiet") {
    lines.push("Thường yên, ít đông");
  }
  if (input.bestContext === "solo") {
    lines.push("Được nhiều người đi một mình đánh giá tốt");
  }
  if (input.budgetMax != null && input.typicalSpend != null && input.typicalSpend <= input.budgetMax) {
    lines.push("Khoảng chi tiêu phù hợp ngân sách của bạn");
  }
  if (input.reasons.includes("nearby") || (input.distanceMeters != null && input.distanceMeters < 2500)) {
    lines.push("Gần vị trí của bạn");
  }
  if (input.verifiedCount >= 3) {
    lines.push(`${input.verifiedCount} trải nghiệm đã xác minh`);
  }
  if (lines.length === 0 && input.isEditorialPick) {
    lines.push("Được Realidi chọn vì hợp với cộng đồng");
  }
  return lines.slice(0, 3);
}
