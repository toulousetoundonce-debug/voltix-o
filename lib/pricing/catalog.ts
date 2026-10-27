import type { PricingCatalogItem } from "./types";

const updatedAt = "2026-10-26";
const source = "قيمة افتراضية للاختبار — تستبدل بعرض مورد جزائري";

export const PRICING_CATALOG: PricingCatalogItem[] = [
  { id: "industrial-panel", nameAr: "لوحة وقواطع صناعية", serviceLine: "industrial", unit: "circuit", unitPrice: { economy: 18000, standard: 32000, premium: 58000 }, currencyBasis: "DZD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "industrial-cable", nameAr: "كابل وتمديد صناعي", serviceLine: "industrial", unit: "m2", unitPrice: { economy: 900, standard: 1600, premium: 2700 }, currencyBasis: "DZD", copperSensitive: true, source, updatedAt, needsReview: true },
  { id: "commercial-panel", nameAr: "لوحة توزيع تجارية", serviceLine: "commercial", unit: "circuit", unitPrice: { economy: 14000, standard: 26000, premium: 44000 }, currencyBasis: "DZD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "commercial-cable", nameAr: "كابل وتمديد تجاري", serviceLine: "commercial", unit: "m2", unitPrice: { economy: 650, standard: 1150, premium: 1950 }, currencyBasis: "DZD", copperSensitive: true, source, updatedAt, needsReview: true },
  { id: "smart-controller", nameAr: "وحدة تحكم منزلية محلية", serviceLine: "smart-home", unit: "project", unitPrice: { economy: 65000, standard: 145000, premium: 295000 }, currencyBasis: "USD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "smart-point", nameAr: "نقطة ذكية", serviceLine: "smart-home", unit: "point", unitPrice: { economy: 6500, standard: 11500, premium: 19500 }, currencyBasis: "USD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "smart-cable", nameAr: "تمديدات وتحكم", serviceLine: "smart-home", unit: "m2", unitPrice: { economy: 400, standard: 800, premium: 1350 }, currencyBasis: "DZD", copperSensitive: true, source, updatedAt, needsReview: true },
  { id: "cctv-camera", nameAr: "كاميرا مراقبة مع ملحقاتها", serviceLine: "cctv-network", unit: "camera", unitPrice: { economy: 12500, standard: 24000, premium: 46000 }, currencyBasis: "USD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "cctv-recording", nameAr: "مسجل وشبكة تخزين", serviceLine: "cctv-network", unit: "project", unitPrice: { economy: 48000, standard: 92000, premium: 180000 }, currencyBasis: "USD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "addon-surge-industrial", nameAr: "حماية من زيادة الجهد", serviceLine: "industrial", unit: "project", unitPrice: { economy: 18000, standard: 32000, premium: 56000 }, currencyBasis: "DZD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "addon-ats-industrial", nameAr: "تحويل آلي لمولد احتياطي", serviceLine: "industrial", unit: "project", unitPrice: { economy: 55000, standard: 95000, premium: 165000 }, currencyBasis: "DZD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "addon-surge-commercial", nameAr: "حماية جهد للمنشأة", serviceLine: "commercial", unit: "project", unitPrice: { economy: 12000, standard: 22000, premium: 38000 }, currencyBasis: "DZD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "addon-ups-smart", nameAr: "مزود طاقة احتياطي UPS", serviceLine: "smart-home", unit: "project", unitPrice: { economy: 32000, standard: 68000, premium: 125000 }, currencyBasis: "USD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "addon-scenes-smart", nameAr: "مشاهد تحكم محلية إضافية", serviceLine: "smart-home", unit: "point", unitPrice: { economy: 2500, standard: 4200, premium: 7500 }, currencyBasis: "DZD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "addon-nightvision-cctv", nameAr: "رؤية ليلية محسّنة", serviceLine: "cctv-network", unit: "camera", unitPrice: { economy: 3500, standard: 7500, premium: 13500 }, currencyBasis: "USD", copperSensitive: false, source, updatedAt, needsReview: true },
  { id: "addon-vlan-cctv", nameAr: "عزل شبكة الكاميرات VLAN", serviceLine: "cctv-network", unit: "project", unitPrice: { economy: 16000, standard: 32000, premium: 60000 }, currencyBasis: "DZD", copperSensitive: false, source, updatedAt, needsReview: true },
];
