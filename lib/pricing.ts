// Pricing engine shared by the calculator UI and the /api/quote route.
// The server recomputes the estimate from the raw inputs, so the client value is never trusted.
//
// >>> All monetary constants below are PLACEHOLDERS. Adjust CURRENCY and the rates to your
// >>> real price list before going live.

export const CURRENCY = "دج";

export const PROJECT_TYPE_VALUES = ["smart_home", "industrial_electrical", "commercial", "cctv"] as const;
export type ProjectType = (typeof PROJECT_TYPE_VALUES)[number];

export const TIER_VALUES = ["economic", "advanced", "professional"] as const;
export type Tier = (typeof TIER_VALUES)[number];

export const AREA_MIN = 50;
export const AREA_MAX = 2000;
export const AREA_STEP = 10;

export interface ProjectConfig {
  label: string;
  description: string;
  unitLabel: string;
  unitHint: string;
  unitMin: number;
  unitMax: number;
  unitDefault: number;
  /** Fixed cost: study, design, commissioning, mobilisation. */
  fixed: number;
  /** Cost per square metre. */
  perM2: number;
  /** Cost per unit (smart point / circuit / camera). */
  perUnit: number;
}

export const PROJECTS: Record<ProjectType, ProjectConfig> = {
  smart_home: {
    label: "منزل ذكي متكامل (Smart Home)",
    description: "أتمتة بخادم محلي: إضاءة، تكييف، ستائر، حساسات وسيناريوهات.",
    unitLabel: "عدد النقاط الذكية",
    unitHint: "مفاتيح، حساسات، مآخذ ذكية، ستائر، أقفال",
    unitMin: 5,
    unitMax: 200,
    unitDefault: 30,
    fixed: 90_000,
    perM2: 3_000,
    perUnit: 7_500,
  },
  industrial_electrical: {
    label: "تأسيس كهرباء صناعية ومعمارية",
    description: "توزيع كهربائي، لوحات تحكم، تأريض وحماية محركات.",
    unitLabel: "حجم اللوحة الكهربائية (عدد الدارات)",
    unitHint: "عدد الدارات والقواطع في لوحة التوزيع الرئيسية",
    unitMin: 6,
    unitMax: 200,
    unitDefault: 24,
    fixed: 160_000,
    perM2: 3_800,
    perUnit: 14_000,
  },
  commercial: {
    label: "كهرباء تجارية ومكاتب",
    description: "إنارة ومخارج ولوحات توزيع وتجهيزات كهربائية للمحلات والمكاتب.",
    unitLabel: "عدد النقاط والدوائر",
    unitHint: "مخارج الإنارة والطاقة والدوائر الرئيسية",
    unitMin: 5,
    unitMax: 200,
    unitDefault: 24,
    fixed: 95_000,
    perM2: 2_500,
    perUnit: 8_500,
  },
  cctv: {
    label: "نظام كاميرات مراقبة وأمان شبكي (CCTV)",
    description: "كاميرات عالية الدقة، تسجيل محلي وشبكة معزولة.",
    unitLabel: "عدد الكاميرات",
    unitHint: "داخلية وخارجية، شاملة نقاط التمديد",
    unitMin: 2,
    unitMax: 64,
    unitDefault: 8,
    fixed: 70_000,
    perM2: 450,
    perUnit: 28_000,
  },
};

export interface TierConfig {
  label: string;
  multiplier: number;
  description: string;
}

export const TIERS: Record<Tier, TierConfig> = {
  economic: {
    label: "عملي واقتصادي",
    multiplier: 1.0,
    description: "معدات موثوقة بأفضل قيمة، تغطي الاحتياج الأساسي بكفاءة.",
  },
  advanced: {
    label: "قياسي متطور",
    multiplier: 1.4,
    description: "معدات أعلى جودة، أتمتة أوسع وتنظيم أدق للكابلات.",
  },
  professional: {
    label: "احترافي بمعايير صناعية وخادم محلي (Local Server)",
    multiplier: 1.85,
    description: "معدات بمعايير صناعية، خادم محلي، عزل شبكي وتوثيق فني كامل.",
  },
};

export interface EstimateInput {
  projectType: ProjectType;
  area: number;
  units: number;
  tier: Tier;
}

export interface Estimate {
  base: number;
  min: number;
  max: number;
}

const ROUND_STEP = 5_000;
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * cost = (fixed + perM2 * effectiveArea + perUnit * units) * tierMultiplier
 * effectiveArea gives a 25% scale discount on the part of the area above 500 m².
 * The displayed range is -10% / +20% around the base to reflect site conditions.
 */
export function computeEstimate(input: EstimateInput): Estimate {
  const project = PROJECTS[input.projectType];
  const tier = TIERS[input.tier];
  const effectiveArea = Math.min(input.area, 500) + Math.max(0, input.area - 500) * 0.75;
  const raw =
    (project.fixed + project.perM2 * effectiveArea + project.perUnit * input.units) *
    tier.multiplier;
  return {
    base: roundTo(raw, ROUND_STEP),
    min: roundTo(raw * 0.9, ROUND_STEP),
    max: roundTo(raw * 1.2, ROUND_STEP),
  };
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
