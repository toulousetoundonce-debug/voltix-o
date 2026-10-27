import { z } from "zod";
import { EMERGENCY_VALUES, normalizePhoneNumber } from "./validation";

export const emergencyPhoneSchema = z
  .string({ error: "رقم الهاتف مطلوب" })
  .max(40, "رقم الهاتف غير صالح")
  .transform(normalizePhoneNumber)
  .pipe(z.string().regex(/^\+213[567]\d{8}$/, "أدخل رقم هاتف جزائرياً صحيحاً"));

export const emergencyLocaleSchema = z.enum(["ar-DZ", "fr-FR", "en-US"]);
export type EmergencyLocale = z.infer<typeof emergencyLocaleSchema>;

export const emergencySeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type EmergencySeverity = z.infer<typeof emergencySeveritySchema>;

export const emergencyVoiceReportSchema = z
  .object({
    transcript: z.string().trim().min(1).max(1_500),
    detectedLanguage: z.enum(["ar-DZ", "fr-FR", "en-US", "mixed", "unknown"]),
    emergencyType: z.enum(EMERGENCY_VALUES),
    severity: emergencySeveritySchema,
    summaryAr: z.string().trim().min(1).max(500).refine((value) => /[\u0600-\u06ff]/u.test(value)),
    safetyAdviceAr: z
      .array(z.string().trim().min(1).max(240).refine((value) => /[\u0600-\u06ff]/u.test(value)))
      .max(6),
    needsImmediateCall: z.boolean(),
  })
  .strict();

export type EmergencyVoiceReport = z.infer<typeof emergencyVoiceReportSchema>;

export const legacyVoiceAnalysisSchema = z
  .object({
    summary: z.string().trim().min(1).max(500),
    urgency: z.enum(["high", "medium", "low"]),
    category: z.enum(["industrial", "smart-home", "cctv", "electrical-fault"]),
    safetyAdvice: z.string().trim().min(1).max(500),
  })
  .strict();

export const voiceApiResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  transcript: z.string().optional(),
  analysis: legacyVoiceAnalysisSchema.optional(),
  voiceReport: emergencyVoiceReportSchema.optional(),
  usedFallback: z.boolean().optional(),
  usedFallbackModel: z.boolean().optional(),
});

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const ARABIC_LETTERS: Record<string, string> = {
  "\u0622": "\u0627",
  "\u0623": "\u0627",
  "\u0625": "\u0627",
  "\u0671": "\u0627",
  "\u0649": "\u064A",
  "\u0629": "\u0647",
};
export function normalizeArabic(input: string): string {
  return input
    .replace(ARABIC_DIACRITICS, "")
    .replace(/[\u0622\u0623\u0625\u0671\u0649\u0629]/g, (letter) => ARABIC_LETTERS[letter] ?? letter)
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/(?<=[a-z])([3579])|([3579])(?=[a-z])/giu, (digit) => {
      const arabizi: Record<string, string> = {
        "3": "\u0639",
        "5": "\u062E",
        "7": "\u062D",
        "9": "\u0642",
      };
      return arabizi[digit] ?? digit;
    })
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

const ARABIZI_LETTERS: Record<string, string> = {
  "3": "\u0639",
  "5": "\u062E",
  "7": "\u062D",
  "9": "\u0642",
  "2": "\u0621",
  a: "\u0627",
  b: "\u0628",
  c: "\u0643",
  d: "\u062F",
  e: "\u064A",
  f: "\u0641",
  g: "\u062C",
  h: "\u0647",
  i: "\u064A",
  j: "\u062C",
  k: "\u0643",
  l: "\u0644",
  m: "\u0645",
  n: "\u0646",
  o: "\u0648",
  p: "\u0628",
  q: "\u0642",
  r: "\u0631",
  s: "\u0633",
  t: "\u062A",
  u: "\u0648",
  v: "\u0641",
  w: "\u0648",
  x: "\u0643\u0633",
  y: "\u064A",
  z: "\u0632",
};

function normalizeFrench(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function transliterateArabizi(input: string): string {
  const text = normalizeFrench(input);
  return text.replace(/ch|sh|kh|gh|dj|ou|th|dh|[a-z23579]/g, (sequence) => {
    const digraphs: Record<string, string> = {
      ch: "\u0634",
      sh: "\u0634",
      kh: "\u062E",
      gh: "\u063A",
      dj: "\u062C",
      ou: "\u0648",
      th: "\u062B",
      dh: "\u0630",
    };
    return digraphs[sequence] ?? ARABIZI_LETTERS[sequence] ?? sequence;
  });
}

function matchingText(input: string): string {
  return `${normalizeArabic(input)} ${normalizeArabic(transliterateArabizi(input))} ${normalizeFrench(input)}`;
}

const HAZARD_PATTERNS = {
  smoke: /دخان|fumee|smoke/u,
  actualFire: /حريق|حرايق|incendie|feu|flamme|fire/u,
  burningSmell: /ريحه\s*(?:حريق|محروق|حرق)|odeur.{0,12}(?:brule|brulee)|sent.{0,8}le.{0,8}brule|burning\s*smell/u,
  shock:
    /صعقه|صعق|كهربتني|صدمه كهربائيه|ضربني.{0,16}(?:الكوران|الكورون|كوران|الكهرباء)|(?:الكوران|الكورون).{0,16}ضربني|coup de jus|electrocution|electric shock|choc electrique/u,
  sparks: /شراره|يشرر|يشرار|شرر|etincelle|sparks|arc electrique|يشرر|يشرار/u,
  shortCircuit: /كورتو|كورتو سيركي|ماس كهربائي|court.?circuit|short circuit|sirkwi/u,
  outage: /طار الضو|قطع الضو|ما كاينش ضو|ماكانش ضو|ما كاينش كوران|ماكانش كوران|ma kayench (?:courant|daw|dho)|ma kanch courant|انقطاع الكهرباء|انقطاع التيار|coupure de courant|plus de courant|power outage|ضو.{0,10}(?:مقطوع|راح)/u,
  panelOrElectrical:
    /الضو|الضوء|الكوران|الكورون|كوران|كهرب|الطابلو|الكونتور|الديجونكتور|القاطع|الفيزه|الطابلو|البريز|السلك|فيل|electri|courant|compteur|disjoncteur|tableau|prise|cable|fil|fusible|electric/u,
  water: /ماء.{0,16}(?:الطابلو|الكهرباء|الكهربا|الاسلاك)|رطوبه|eau.{0,16}(?:tableau|electri|prise)|humidite|water.{0,16}(?:electric|panel)/u,
};

export function classifyEmergencySeverity(input: string): EmergencySeverity {
  const text = matchingText(input);
  const smoke = HAZARD_PATTERNS.smoke.test(text);
  const burningSmell = HAZARD_PATTERNS.burningSmell.test(text);
  const fireContext = text.replace(/ريحه\s*حريق|ريحة\s*حريق/g, "");
  const fire = HAZARD_PATTERNS.actualFire.test(fireContext);
  const shock = HAZARD_PATTERNS.shock.test(text);
  const sparks = HAZARD_PATTERNS.sparks.test(text);
  const outage = HAZARD_PATTERNS.outage.test(text);
  const panelOrElectrical = HAZARD_PATTERNS.panelOrElectrical.test(text);
  const waterNearElectricity = HAZARD_PATTERNS.water.test(text) && panelOrElectrical;

  if (smoke || fire || shock || (burningSmell && (outage || sparks))) return "critical";
  if (burningSmell || sparks || waterNearElectricity || HAZARD_PATTERNS.shortCircuit.test(text)) {
    return "high";
  }
  if (outage) return "medium";
  return "low";
}

export function needsImmediateElectricalCall(input: string): boolean {
  return classifyEmergencySeverity(input) === "critical";
}