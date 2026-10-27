import { PRICING_OPTION_IDS, SERVICE_LINES } from "./types";
import { z } from "zod";

export const pricingInputSchema = z.object({
  requestId: z.string().uuid().optional(),
  serviceLine: z.enum(SERVICE_LINES),
  quantity: z.number().int().min(0).max(2_000),
  areaM2: z.number().int().min(0).max(20_000).optional(),
  tier: z.enum(["economy", "standard", "premium"]).optional(),
  wilaya: z.string().trim().max(80).optional(),
  zone: z.enum(["north-center", "high-plateaux", "south", "other"]).optional(),
  detailLevel: z.enum(["known", "estimated", "unknown"]).optional(),
  renovation: z.boolean().optional(),
  accessDifficulty: z.enum(["normal", "difficult", "unknown"]).optional(),
  includeVat: z.boolean().optional(),
  options: z.array(z.enum(PRICING_OPTION_IDS)).max(12).optional(),
});

const boqLineSchema = z.object({
  id: z.string(),
  nameAr: z.string(),
  quantity: z.number().int().nonnegative(),
  unit: z.enum(["project", "m2", "point", "circuit", "camera", "kW"]),
  unitPriceDzd: z.number().nonnegative(),
  totalDzd: z.number().nonnegative(),
  tier: z.enum(["economy", "standard", "premium"]),
});

export const pricingEstimateSchema = z.object({
  currency: z.literal("DZD"),
  includeVat: z.boolean(),
  vatRate: z.number().min(0).max(1),
  expected: z.number().nonnegative(),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  confidenceScore: z.number().int().min(0).max(100),
  confidence: z.enum(["منخفضة", "متوسطة", "مرتفعة"]),
  boq: z.array(boqLineSchema),
  breakdown: z.object({
    materials: z.number().nonnegative(),
    labor: z.number().nonnegative(),
    transport: z.number().nonnegative(),
    contingency: z.number().nonnegative(),
  }),
  durationRangeDays: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }),
  assumptions: z.array(z.string()),
  priceDrivers: z.array(z.string()),
  tiers: z.record(z.enum(["economy", "standard", "premium"]), z.object({
    expected: z.number().nonnegative(),
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    boq: z.array(boqLineSchema),
  })),
  internalWarnings: z.array(z.string()),
  zone: z.enum(["north-center", "high-plateaux", "south", "other"]),
});
