export const SERVICE_LINES = ["industrial", "commercial", "smart-home", "cctv-network"] as const;
export type ServiceLine = (typeof SERVICE_LINES)[number];
export const PRICE_TIERS = ["economy", "standard", "premium"] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];
export const PRICING_OPTION_IDS = [
  "addon-surge-industrial",
  "addon-ats-industrial",
  "addon-surge-commercial",
  "addon-ups-smart",
  "addon-scenes-smart",
  "addon-nightvision-cctv",
  "addon-vlan-cctv",
] as const;
export type PriceUnit = "project" | "m2" | "point" | "circuit" | "camera" | "kW";
export type CurrencyBasis = "DZD" | "USD";
export type RegionalZone = "north-center" | "high-plateaux" | "south" | "other";

export interface PricingCatalogItem {
  id: string;
  nameAr: string;
  serviceLine: ServiceLine;
  unit: PriceUnit;
  unitPrice: Record<PriceTier, number>;
  currencyBasis: CurrencyBasis;
  copperSensitive: boolean;
  source: string;
  updatedAt: string;
  needsReview: boolean;
}

export interface PricingInput {
  serviceLine: ServiceLine;
  quantity: number;
  areaM2?: number;
  tier?: PriceTier;
  zone?: RegionalZone;
  wilaya?: string;
  detailLevel?: "known" | "estimated" | "unknown";
  renovation?: boolean;
  accessDifficulty?: "normal" | "difficult" | "unknown";
  includeVat?: boolean;
  options?: string[];
}

export interface BoqLine {
  id: string;
  nameAr: string;
  quantity: number;
  unit: PriceUnit;
  unitPriceDzd: number;
  totalDzd: number;
  tier: PriceTier;
}

export interface TierEstimate {
  expected: number;
  min: number;
  max: number;
  boq: BoqLine[];
}

export interface PricingEstimate {
  currency: "DZD";
  includeVat: boolean;
  vatRate: number;
  expected: number;
  min: number;
  max: number;
  confidenceScore: number;
  confidence: "منخفضة" | "متوسطة" | "مرتفعة";
  boq: BoqLine[];
  breakdown: { materials: number; labor: number; transport: number; contingency: number };
  durationRangeDays: { min: number; max: number };
  assumptions: string[];
  priceDrivers: string[];
  tiers: Record<PriceTier, TierEstimate>;
  internalWarnings: string[];
  zone: RegionalZone;
}
