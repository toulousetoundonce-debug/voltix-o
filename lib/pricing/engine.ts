import { PRICING_CATALOG } from "./catalog";
import { PRICING_CONFIG } from "./config";
import { confidenceScore, laborSkill, resolveZone, uncertainty } from "./rules";
import type { BoqLine, PriceTier, PricingEstimate, PricingInput, TierEstimate } from "./types";

const roundForDisplay = (value: number) => Math.round(value / (value >= 1_000_000 ? 5_000 : 1_000)) * (value >= 1_000_000 ? 5_000 : 1_000);
const clampQuantity = (value: number, max: number) => Math.max(0, Math.min(max, Math.floor(value)));

function fresh(date: string, now: Date): boolean {
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) && now.getTime() - parsed <= PRICING_CONFIG.dataStaleAfterDays * 86_400_000;
}

function tierBreakdown(input: PricingInput, tier: PriceTier, zone: PricingEstimate["zone"]): {
  total: number;
  boq: BoqLine[];
  materials: number;
  labor: number;
  transport: number;
  contingency: number;
} {
  const quantity = clampQuantity(input.quantity, 2_000);
  const area = clampQuantity(input.areaM2 ?? 0, 20_000);
  const optionIds = new Set(input.options ?? []);
  const items = PRICING_CATALOG.filter((item) =>
    item.serviceLine === input.serviceLine &&
    (!item.id.startsWith("addon-") || optionIds.has(item.id)),
  );
  const fx = (basis: "DZD" | "USD") => (basis === "USD" ? PRICING_CONFIG.usdDzdRate : 1);
  const copper = PRICING_CONFIG.copperIndex;
  const boq = items.map((item) => {
    const itemQuantity = item.unit === "project" ? 1 :
      item.unit === "m2" ? Math.max(area, quantity) : quantity;
    const unitPriceDzd = Math.round(item.unitPrice[tier] * fx(item.currencyBasis) * (item.copperSensitive ? copper : 1));
    return {
      id: item.id,
      nameAr: item.nameAr,
      quantity: itemQuantity,
      unit: item.unit,
      unitPriceDzd,
      totalDzd: unitPriceDzd * itemQuantity,
      tier,
    };
  });
  const materials = boq.reduce((sum, line) => sum + line.totalDzd, 0);
  const skill = laborSkill(input.serviceLine);
  const complexity = (input.renovation ? 1.2 : 1) * (input.accessDifficulty === "difficult" ? 1.18 : 1);
  const labor = Math.round(quantity * PRICING_CONFIG.laborRates[skill] * complexity);
  const transport = Math.round(
    PRICING_CONFIG.transport.base +
    PRICING_CONFIG.transport.perKm * PRICING_CONFIG.transportDistanceKmByZone[zone],
  );
  const consumables = Math.round(materials * PRICING_CONFIG.consumablesPct);
  const beforeMarkup = materials + labor + transport + consumables;
  const contingency = Math.round(beforeMarkup * PRICING_CONFIG.contingencyPct);
  const total = roundForDisplay(
    (beforeMarkup + contingency) *
    (1 + PRICING_CONFIG.marginPct) *
    PRICING_CONFIG.regionalCoefficients[zone],
  );
  return { total, boq, materials, labor, transport, contingency };
}

export function computePricingEstimate(input: PricingInput, now = new Date()): PricingEstimate {
  const zone = resolveZone(input);
  const optionIds = new Set(input.options ?? []);
  const selectedTier = input.tier ?? "standard";
  const tiers = {} as Record<PriceTier, TierEstimate>;
  for (const tier of ["economy", "standard", "premium"] as const) {
    const result = tierBreakdown({ ...input, quantity: clampQuantity(input.quantity, 2_000) }, tier, zone);
    const spread = uncertainty(input);
    tiers[tier] = {
      expected: result.total,
      min: roundForDisplay(result.total * (1 - spread)),
      max: roundForDisplay(result.total * (1 + spread)),
      boq: result.boq,
    };
  }
  const result = tierBreakdown(input, selectedTier, zone);
  const includeVat = input.includeVat ?? true;
  const taxMultiplier = includeVat ? 1 + PRICING_CONFIG.vatRate : 1;
  const expected = roundForDisplay(tiers[selectedTier].expected * ((input.includeVat ?? true) ? 1 + PRICING_CONFIG.vatRate : 1));
  const componentTaxMultiplier = (input.includeVat ?? true) ? 1 + PRICING_CONFIG.vatRate : 1;
  const preContingencyFactor = (1 + PRICING_CONFIG.marginPct) * PRICING_CONFIG.regionalCoefficients[zone];
  const materialLines = result.boq.map((line) => {
    const unitPriceDzd = Math.round(line.unitPriceDzd * preContingencyFactor * componentTaxMultiplier);
    return { ...line, unitPriceDzd, totalDzd: unitPriceDzd * line.quantity };
  });
  const materialsShown = materialLines.reduce((sum, line) => sum + line.totalDzd, 0);
  const laborShown = Math.round(result.labor * preContingencyFactor * componentTaxMultiplier);
  const transportShown = Math.round(result.transport * preContingencyFactor * componentTaxMultiplier);
  const contingencyShown = Math.max(0, expected - materialsShown - laborShown - transportShown);
  const warnings = PRICING_CATALOG
    .filter((item) => item.serviceLine === input.serviceLine &&
      (!item.id.startsWith("addon-") || optionIds.has(item.id)))
    .flatMap((item) => [
      ...(item.needsReview ? [`سعر يحتاج مراجعة: ${item.id}`] : []),
      ...(!fresh(item.updatedAt, now) ? [`سعر قديم: ${item.id}`] : []),
    ]);
  if (!fresh(PRICING_CONFIG.usdDzdUpdatedAt, now)) warnings.push("سعر صرف USD/DZD قديم.");
  if (!fresh(PRICING_CONFIG.copperIndexUpdatedAt, now)) warnings.push("مؤشر النحاس قديم.");
  if (PRICING_CONFIG.vatNeedsAccountantReview) warnings.push("معدل TVA يحتاج تأكيد المحاسب.");
  const durationBase = Math.max(1, Math.ceil(input.quantity / (input.serviceLine === "industrial" ? 8 : 12)));
  const finalTiers = Object.fromEntries(
    Object.entries(tiers).map(([key, value]) => [
      key,
      {
        ...value,
        expected: roundForDisplay(value.expected * taxMultiplier),
        min: roundForDisplay(value.min * taxMultiplier),
        max: roundForDisplay(value.max * taxMultiplier),
        boq: value.boq.map((line) => ({
          ...line,
          unitPriceDzd: Math.round(line.unitPriceDzd * taxMultiplier),
          totalDzd: Math.round(line.totalDzd * taxMultiplier),
        })),
      },
    ]),
  ) as Record<PriceTier, TierEstimate>;
  return {
    currency: "DZD",
    includeVat,
    vatRate: PRICING_CONFIG.vatRate,
    expected,
    min: Math.min(expected, finalTiers[selectedTier].min),
    max: Math.max(expected, finalTiers[selectedTier].max),
    confidenceScore: confidenceScore(input),
    confidence: confidenceScore(input) >= 75 ? "مرتفعة" : confidenceScore(input) >= 55 ? "متوسطة" : "منخفضة",
    boq: [
      ...materialLines,
      { id: "labor-total", nameAr: "أجور التركيب والاختبار", quantity: 1, unit: "project", unitPriceDzd: laborShown, totalDzd: laborShown, tier: selectedTier },
      { id: "transport-total", nameAr: "النقل والتنقل", quantity: 1, unit: "project", unitPriceDzd: transportShown, totalDzd: transportShown, tier: selectedTier },
      { id: "contingency-total", nameAr: "احتياط واستهلاك وهامش", quantity: 1, unit: "project", unitPriceDzd: contingencyShown, totalDzd: contingencyShown, tier: selectedTier },
    ],
    breakdown: {
      materials: materialsShown,
      labor: laborShown,
      transport: transportShown,
      contingency: contingencyShown,
    },
    durationRangeDays: { min: durationBase, max: Math.max(durationBase, Math.ceil(durationBase * 1.8)) },
    assumptions: [
      "الأسعار في الكتالوج افتراضية إرشادية وتحتاج تأكيد المورد.",
      "الكميات تقديرية ولا تشمل الأعمال المخفية أو الإصلاحات غير الظاهرة.",
      `صلاحية التقدير ${PRICING_CONFIG.quoteValidityDays} يوماً؛ السعر النهائي بعد المعاينة الميدانية.`,
    ],
    priceDrivers: [
      "نوع الجدران ومسارات التمديد",
      "المسافة الفعلية للكابلات",
      input.renovation ? "حالة التمديدات القديمة" : "حالة الموقع عند التنفيذ",
      input.accessDifficulty === "difficult" ? "صعوبة الوصول للموقع" : "سهولة الوصول ومواعيد العمل",
      "ظروف الموقع وتوفر المواد",
    ],
    tiers: finalTiers,
    internalWarnings: warnings,
    zone,
  };
}

export function formatPricingMoney(value: number): string {
  return `${new Intl.NumberFormat("ar-DZ-u-nu-latn", { maximumFractionDigits: 0 }).format(value)} دج`;
}
