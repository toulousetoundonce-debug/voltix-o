import { randomInt } from "node:crypto";
import { z } from "zod";
import { classifyEmergencySeverity, emergencyPhoneSchema, type EmergencySeverity } from "@/lib/emergency-voice";
import { emergencyStrings } from "@/lib/emergency-strings";
import { createMapsCoordinatesHref } from "@/lib/site";
import { EMERGENCY_LABELS, type EmergencyType } from "@/lib/validation";

const severitySchema = z.enum(["low", "medium", "high", "critical"]);
const confidenceSchema = z.enum(["low", "medium", "high"]);

export const emergencyReportSchema = z.object({
  referenceId: z.string().regex(/^VX-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/),
  createdAt: z.string().datetime(),
  displayTime: z.string().min(1).max(40),
  severity: severitySchema,
  emergencyType: z.string().trim().min(1).max(100),
  customerWords: z.string().max(2_000),
  detectedLanguage: z.enum(["ar-DZ", "ar", "fr", "en"]),
  triage: z.object({
    problemSummary: z.string().trim().min(1).max(500),
    probableCause: z.string().trim().min(1).max(500),
    immediateSafetyAdvice: z.array(z.string().trim().min(1).max(300)).max(4),
    technicianAction: z.array(z.string().trim().min(1).max(300)).max(5),
    questionsForCall: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
    toolsToBring: z.array(z.string().trim().min(1).max(120)).max(8),
    confidence: confidenceSchema,
    analysisAvailable: z.boolean(),
  }),
  imageFindings: z.string().trim().max(800).nullable(),
  location: z.object({
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    accuracy: z.number().min(0).max(1_000_000).nullable(),
    address: z.string().trim().max(240),
    mapsUrl: z.string().url().nullable(),
    wazeUrl: z.string().url().nullable(),
  }),
  customer: z.object({
    name: z.string().trim().max(80),
    phone: z.string().regex(/^\+213[567]\d{8}$/),
    whatsappUrl: z.string().url(),
  }),
  hasPhoto: z.boolean(),
  hasVoice: z.boolean(),
});

export type EmergencyReport = z.infer<typeof emergencyReportSchema>;

export interface EmergencyReportInput {
  createdAt?: Date;
  fullName?: string;
  phone: string;
  description?: string;
  voiceTranscript?: string;
  aiDiagnosis?: string;
  emergencyType?: EmergencyType;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  hasPhoto: boolean;
}

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function localDateParts(date: Date): { date: string; display: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Algiers",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour");
  const minute = value("minute");
  return {
    date: `${year}${month}${day}`,
    display: `${day}/${month}/20${year} ${hour}:${minute} (${emergencyStrings.telegram.timeZoneLabel})`,
  };
}

export function createEmergencyReferenceId(date = new Date()): string {
  const { date: compactDate } = localDateParts(date);
  const suffix = Array.from({ length: 4 }, () =>
    REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)],
  ).join("");
  return `VX-${compactDate}-${suffix}`;
}

function inferEmergencyType(text: string): EmergencyType {
  const normalized = text.toLocaleLowerCase();
  if (/كاميرا|مراقب|cctv|camera|alarme|إنذار|انذار/u.test(normalized)) {
    return "security_system_down";
  }
  if (/انقطاع|طار الضو|قطع الضو|ما كاينش|coupure|power outage/u.test(normalized)) {
    return "industrial_line_down";
  }
  if (/ماس كهربائي|كورتو|شرر|شرار|دخان|حريق|صعق|كهربتني|ريحة محروق|ريحة حريق|court.?circuit|fumee|fire|shock|burning/u.test(normalized)) {
    return "dangerous_short_circuit";
  }
  return "control_panel_fault";
}

function inferLanguage(text: string): EmergencyReport["detectedLanguage"] {
  if (!text) return "ar";
  const arabic = /[\u0600-\u06ff]/u.test(text);
  const latin = /[a-z]/iu.test(text);
  if (arabic && latin) return "ar";
  if (arabic) return "ar-DZ";
  if (/\b(?:ma kayen|ma kayench|ma kanch|daw|dho|kouran|kahraba|sirkwi)\b/iu.test(text)) {
    return "ar";
  }
  if (/\b(?:le|la|les|un|une|courant|compteur|disjoncteur|fumee|brule)\b/iu.test(text)) {
    return "fr";
  }
  return "en";
}

function imageAnalysisText(aiDiagnosis: string | undefined, hasPhoto: boolean): string | null {
  if (!hasPhoto) return null;
  const imageLine = aiDiagnosis
    ?.split(/\r?\n/u)
    .find((line) => /تشخيص الصورة/u.test(line));
  if (!imageLine) return emergencyStrings.telegram.photoNeedsReview;
  return imageLine
    .replace(/^.*?تشخيص الصورة\s*(?:\([^)]*\))?\s*:\s*/u, "")
    .trim()
    .slice(0, 800) || emergencyStrings.telegram.photoNeedsReview;
}

function safeTruncate(value: string, limit: number): string {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function safetyAdvice(severity: EmergencySeverity): string[] {
  if (severity === "critical" || severity === "high") {
    return [emergencyStrings.safetyDangerMessage];
  }
  return [emergencyStrings.form.voiceSafeAdvice];
}

export function createEmergencyReport(input: EmergencyReportInput): EmergencyReport {
  const createdAt = input.createdAt ?? new Date();
  const phone = emergencyPhoneSchema.parse(input.phone);
  const sourceText = [input.description, input.voiceTranscript].filter(Boolean).join("\n");
  const selectedType = input.emergencyType;
  const inferredType = selectedType ?? inferEmergencyType(`${sourceText}\n${input.aiDiagnosis ?? ""}`);
  const reportText = `${sourceText}\n${input.aiDiagnosis ?? ""}`;
  const localSeverity = classifyEmergencySeverity(reportText);
  const severityRank: Record<EmergencySeverity, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  const diagnosisSeverity: EmergencySeverity =
    /critical|خطورة حرجة|طوارئ حرجة|خطر حرج/iu.test(input.aiDiagnosis ?? "")
      ? "critical"
      : /خطر مرتفع|عالي|مرتفع|\bhigh\b/iu.test(input.aiDiagnosis ?? "")
        ? "high"
        : /متوسط|\bmedium\b/iu.test(input.aiDiagnosis ?? "")
          ? "medium"
          : "low";
  const severity =
    severityRank[diagnosisSeverity] > severityRank[localSeverity]
      ? diagnosisSeverity
      : localSeverity;
  const words = [
    input.description ? `${emergencyStrings.telegram.labels.description}: ${input.description}` : "",
    input.voiceTranscript
      ? `${emergencyStrings.telegram.labels.voiceTranscript}: ${input.voiceTranscript}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const { display } = localDateParts(createdAt);
  const referenceId = createEmergencyReferenceId(createdAt);
  const lat = input.location && Number.isFinite(input.location.lat) ? input.location.lat : null;
  const lng = input.location && Number.isFinite(input.location.lng) ? input.location.lng : null;
  const mapsUrl = lat !== null && lng !== null ? createMapsCoordinatesHref(lat, lng) : null;
  const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    emergencyStrings.telegram.whatsappPrefill.replace("{referenceId}", referenceId),
  )}`;

  return emergencyReportSchema.parse({
    referenceId,
    createdAt: createdAt.toISOString(),
    displayTime: display,
    severity,
    emergencyType: `${EMERGENCY_LABELS[inferredType]}${selectedType ? "" : ` (${emergencyStrings.telegram.inferredAutomatically})`}`,
    customerWords: safeTruncate(words, 2_000),
    detectedLanguage: inferLanguage(sourceText),
    triage: {
      problemSummary:
        safeTruncate(sourceText || EMERGENCY_LABELS[inferredType], 500) ||
        EMERGENCY_LABELS[inferredType],
      probableCause: emergencyStrings.telegram.causeUnknown,
      immediateSafetyAdvice: safetyAdvice(severity),
      technicianAction: emergencyStrings.telegram.defaultTechnicianActions,
      questionsForCall: emergencyStrings.telegram.callQuestions,
      toolsToBring: emergencyStrings.telegram.defaultTools,
      confidence: "low",
      analysisAvailable: false,
    },
    imageFindings: imageAnalysisText(input.aiDiagnosis, input.hasPhoto),
    location: {
      lat,
      lng,
      accuracy: input.location?.accuracy ?? null,
      address: emergencyStrings.telegram.locationMissing,
      mapsUrl,
      wazeUrl: lat !== null && lng !== null
        ? `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`
        : null,
    },
    customer: {
      name: safeTruncate(input.fullName || emergencyStrings.telegram.nameMissing, 80),
      phone,
      whatsappUrl,
    },
    hasPhoto: input.hasPhoto,
    hasVoice: Boolean(input.voiceTranscript?.trim()),
  });
}

export function applyEmergencyTriage(
  base: EmergencyReport,
  triage: {
    summary: string;
    findings: string[];
    recommended_actions: string[];
    required_tools: string[];
    confidence?: "low" | "medium" | "high";
  },
): EmergencyReport {
  return emergencyReportSchema.parse({
    ...base,
    triage: {
      ...base.triage,
      problemSummary: safeTruncate(triage.summary, 500) || base.triage.problemSummary,
      probableCause: safeTruncate(triage.findings[0] ?? base.triage.probableCause, 500),
      technicianAction: triage.recommended_actions.slice(0, 5),
      toolsToBring: triage.required_tools.slice(0, 8),
      confidence: triage.confidence ?? "low",
      analysisAvailable: true,
    },
  });
}
