export const GEO_PARITY = {
  earthRadiusMeters: 6_371_000,
  samePoint: {
    points: [10.78, 106.7, 10.78, 106.7] as const,
    meters: 0,
  },
  saigonScale: {
    points: [10.7769, 106.6954, 10.772, 106.6983] as const,
    meters: 630.2515213225538,
  },
  antipodal: {
    points: [0, 0, 0, 180] as const,
    meters: 20_015_086.79602057,
  },
  validBoundary: [
    [-90, -180],
    [90, 180],
  ] as const,
  invalid: [
    [-90.000001, 0],
    [90.000001, 0],
    [0, -180.000001],
    [0, 180.000001],
  ] as const,
} as const;
