export type ConfidenceTier = "early_signal" | "emerging" | "established";

export function confidenceFromSamples(
  sampleCount: number,
  verifiedSampleCount: number,
): { confidence: number; tier: ConfidenceTier } {
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 0 ||
      !Number.isSafeInteger(verifiedSampleCount) || verifiedSampleCount < 0 ||
      verifiedSampleCount > sampleCount) {
    throw new RangeError("Sample counts must be nonnegative integers with verified <= total");
  }
  const confidence = Math.min(
    1,
    (sampleCount / 20) * 0.7 +
      (verifiedSampleCount / Math.max(sampleCount, 1)) * 0.3,
  );
  const tier = sampleCount < 5
    ? "early_signal"
    : sampleCount < 20 ? "emerging" : "established";
  return { confidence, tier };
}

export function bayesianAverage(
  average: number,
  sampleCount: number,
  priorMean = 3.2,
  priorStrength = 8,
): number {
  if (sampleCount < 0 || priorStrength <= 0) throw new RangeError("Invalid aggregate weights");
  return ((priorStrength * priorMean) + (sampleCount * average)) /
    (priorStrength + sampleCount);
}

export function deterministicMedian(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function deterministicMode<T extends string>(
  values: readonly T[],
  tieOrder: readonly T[],
): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = tieOrder[0];
  for (const candidate of tieOrder) {
    if ((counts.get(candidate) ?? 0) > (counts.get(best) ?? 0)) best = candidate;
  }
  return best;
}

export function assertCounter(value: number): number {
  if (!Number.isSafeInteger(value)) throw new RangeError("Counter must be a safe integer");
  return Math.max(0, value);
}
