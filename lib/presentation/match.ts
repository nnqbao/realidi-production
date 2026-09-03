import type { ConfidenceTier } from "@/lib/ranking";

export type MatchLabel = "early_signal" | "good_match" | "strong_match";

export function matchHeadline(match: MatchLabel): string {
  if (match === "strong_match") return "Rất khớp";
  if (match === "good_match") return "Khớp tốt";
  return "Khớp sơ bộ";
}

export function confidenceHeadline(tier: ConfidenceTier | string): string {
  if (tier === "established") return "Phù hợp tốt";
  if (tier === "emerging") return "Có tín hiệu phù hợp";
  return "Tín hiệu ban đầu";
}

export function confidenceHelper(tier: ConfidenceTier | string): string {
  if (tier === "early_signal") {
    return "Dựa trên một số trải nghiệm đầu tiên của cộng đồng.";
  }
  return "Dựa trên trải nghiệm thật từ người đã ghé.";
}

export function experienceSignalCopy(input: {
  match: MatchLabel;
  confidenceTier: ConfidenceTier | string;
  experienceCount: number;
  verifiedCount: number;
}): { match: string; signal: string; helper?: string } {
  const lowConfidence = input.confidenceTier === "early_signal" || input.experienceCount < 5;
  const match = matchHeadline(lowConfidence ? "early_signal" : input.match);
  if (lowConfidence) {
    const n = input.experienceCount;
    return {
      match: confidenceHeadline("early_signal"),
      signal: n > 0 ? `Hiện có ${n} trải nghiệm được chia sẻ trên Realidi.` : "Dữ liệu cộng đồng đang được hình thành.",
      helper: "Dữ liệu cộng đồng đang được hình thành.",
    };
  }
  if (input.verifiedCount > 0) {
    return {
      match,
      signal: `${input.verifiedCount} trải nghiệm đã xác minh`,
      helper: confidenceHelper(input.confidenceTier),
    };
  }
  return {
    match,
    signal: `${input.experienceCount} trải nghiệm`,
    helper: confidenceHelper(input.confidenceTier),
  };
}
