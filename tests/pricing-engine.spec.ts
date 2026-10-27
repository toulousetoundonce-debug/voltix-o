import { describe, expect, it } from "vitest";
import { computePricingEstimate } from "@/lib/pricing/engine";
import { PRICING_CATALOG } from "@/lib/pricing/catalog";
import type { PricingInput, ServiceLine } from "@/lib/pricing/types";

const services: ServiceLine[] = ["industrial", "commercial", "smart-home", "cctv-network"];
const base: PricingInput = {
  serviceLine: "commercial",
  quantity: 12,
  areaM2: 120,
  tier: "standard",
  zone: "north-center",
  detailLevel: "known",
};

describe("pricing engine", () => {
  it("always orders ranges and tiers and keeps BOQ totals equal to breakdown", () => {
    for (const serviceLine of services) {
      const estimate = computePricingEstimate({ ...base, serviceLine });
      expect(estimate.min).toBeLessThanOrEqual(estimate.expected);
      expect(estimate.expected).toBeLessThanOrEqual(estimate.max);
      expect(estimate.tiers.economy.expected).toBeLessThan(estimate.tiers.standard.expected);
      expect(estimate.tiers.standard.expected).toBeLessThan(estimate.tiers.premium.expected);
      expect(estimate.boq.reduce((sum, line) => sum + line.totalDzd, 0)).toBeGreaterThan(0);
      expect(Object.values(estimate.breakdown).reduce((sum, value) => sum + value, 0)).toBe(estimate.expected);
    }
  });

  it("increases cost as service quantity grows", () => {
    for (const serviceLine of services) {
      const low = computePricingEstimate({ ...base, serviceLine, quantity: 5 });
      const high = computePricingEstimate({ ...base, serviceLine, quantity: 20 });
      expect(high.expected).toBeGreaterThan(low.expected);
    }
  });

  it("widens the range for unknown details", () => {
    const known = computePricingEstimate({ ...base, detailLevel: "known" });
    const unknown = computePricingEstimate({ ...base, detailLevel: "unknown" });
    expect(unknown.max - unknown.min).toBeGreaterThan(known.max - known.min);
    expect(unknown.confidenceScore).toBeLessThan(known.confidenceScore);
  });

  it("applies regional coefficients and flags all placeholder prices for review", () => {
    const north = computePricingEstimate({ ...base, zone: "north-center" });
    const south = computePricingEstimate({ ...base, zone: "south" });
    expect(south.expected).toBeGreaterThan(north.expected);
    expect(PRICING_CATALOG.length).toBe(16);
    expect(PRICING_CATALOG.every((item) => item.needsReview && item.source && item.updatedAt)).toBe(true);
    expect(computePricingEstimate({ ...base, serviceLine: "industrial" }).internalWarnings.length).toBeGreaterThan(0);
  });

  it("includes the configured VAT and respects the HT option", () => {
    const ttc = computePricingEstimate({ ...base, includeVat: true });
    const ht = computePricingEstimate({ ...base, includeVat: false });
    expect(ttc.expected).toBeGreaterThan(ht.expected);
    expect(ht.includeVat).toBe(false);
  });

  it.each([
    ["industrial", "north-center", 4, 80],
    ["industrial", "south", 18, 600],
    ["commercial", "high-plateaux", 8, 160],
    ["commercial", "north-center", 30, 500],
    ["smart-home", "south", 24, 240],
    ["smart-home", "other", 60, 800],
    ["cctv-network", "north-center", 6, 100],
    ["cctv-network", "high-plateaux", 32, 400],
  ] as const)("returns deterministic bounded estimate for %s / %s", (serviceLine, zone, quantity, areaM2) => {
    const input = { ...base, serviceLine, zone, quantity, areaM2 };
    const estimate = computePricingEstimate(input);
    expect({
      expected: estimate.expected,
      min: estimate.min,
      max: estimate.max,
      confidenceScore: estimate.confidenceScore,
    }).toMatchSnapshot();
  });

  it("clamps extreme quantities and never returns negative values", () => {
    const estimate = computePricingEstimate({ ...base, quantity: 999_999, areaM2: 99_999 });
    expect(estimate.expected).toBeGreaterThan(0);
    expect(estimate.min).toBeGreaterThanOrEqual(0);
  });
});
