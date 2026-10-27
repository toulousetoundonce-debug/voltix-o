import type { RegionalZone } from "./types";

export const PRICING_CONFIG = {
  vatRate: 0.19,
  vatNeedsAccountantReview: true,
  marginPct: 0.18,
  contingencyPct: 0.12,
  consumablesPct: 0.06,
  laborRates: { basic: 1800, skilled: 3000, specialist: 4800 },
  transport: { perKm: 45, base: 2500 },
  regionalCoefficients: {
    "north-center": 1.08,
    "high-plateaux": 1,
    south: 1.22,
    other: 1.05,
  } satisfies Record<RegionalZone, number>,
  usdDzdRate: 135,
  usdDzdUpdatedAt: "2026-10-26",
  copperIndex: 1,
  copperIndexUpdatedAt: "2026-10-26",
  dataStaleAfterDays: 180,
  quoteValidityDays: 14,
  inspection: { free: true },
  transportDistanceKmByZone: {
    "north-center": 25,
    "high-plateaux": 55,
    south: 120,
    other: 45,
  } satisfies Record<RegionalZone, number>,
  zoneByWilaya: {
    الجزائر: "north-center", وهران: "north-center", تيزي_وزو: "north-center", بجاية: "north-center",
    البليدة: "north-center", سطيف: "high-plateaux", باتنة: "high-plateaux", الجلفة: "high-plateaux",
    الأغواط: "high-plateaux", بسكرة: "high-plateaux", أدرار: "south", تمنراست: "south",
    إليزي: "south", تندوف: "south", ورقلة: "south", بشار: "south",
  } as Record<string, RegionalZone>,
  roiSavings: {} as Record<string, { monthlyDzd: number }>,
} as const;
