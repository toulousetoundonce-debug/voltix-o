import type { PricingInput, RegionalZone, ServiceLine } from "./types";
import { PRICING_CONFIG } from "./config";

export function resolveZone(input: PricingInput): RegionalZone {
  const wilayaKey = input.wilaya?.trim().replace(/\s+/gu, "_") ?? "";
  return input.zone ?? PRICING_CONFIG.zoneByWilaya[wilayaKey] ?? "other";
}

export function laborSkill(serviceLine: ServiceLine): "basic" | "skilled" | "specialist" {
  return serviceLine === "industrial" ? "specialist" : serviceLine === "smart-home" ? "skilled" : "basic";
}

export function uncertainty(input: PricingInput): number {
  let value = input.detailLevel === "unknown" ? 0.35 : input.detailLevel === "estimated" ? 0.23 : 0.14;
  if (input.renovation) value += 0.08;
  if (input.accessDifficulty === "unknown") value += 0.06;
  if (input.accessDifficulty === "difficult") value += 0.04;
  return Math.min(0.55, value);
}

export function confidenceScore(input: PricingInput): number {
  return Math.max(20, Math.min(95, Math.round(100 - uncertainty(input) * 100)));
}
