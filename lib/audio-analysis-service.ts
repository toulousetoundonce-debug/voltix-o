export interface VoiceAnalysis {
  summary: string;
  urgency: "high" | "medium" | "low";
  category: "industrial" | "smart-home" | "cctv" | "electrical-fault";
  safetyAdvice: string;
}

interface AudioAnalysisInput {
  audio: File;
  emergencyType?: string;
  description?: string;
}

export interface AudioAnalysisResult {
  transcript: string;
  analysis: VoiceAnalysis;
  usedFallback: boolean;
}

type FailureCode = "not_configured" | "timeout" | "network" | "http" | "invalid_response";

export class AudioAnalysisServiceError extends Error {
  constructor(readonly code: FailureCode) {
    super("تعذّر تحليل التسجيل الصوتي.");
    this.name = "AudioAnalysisServiceError";
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeUrgency(value: unknown): VoiceAnalysis["urgency"] | null {
  if (typeof value !== "string") return null;
  const urgency = value.trim().toLowerCase();
  if (["high", "critical", "urgent", "مرتفع", "عالي"].includes(urgency)) return "high";
  if (["medium", "moderate", "متوسط"].includes(urgency)) return "medium";
  if (["low", "normal", "منخفض", "عادي"].includes(urgency)) return "low";
  return null;
}

function normalizeCategory(value: unknown): VoiceAnalysis["category"] | null {
  if (typeof value !== "string") return null;
  const category = value.trim().toLowerCase();
  if (["industrial", "صناعي"].includes(category)) return "industrial";
  if (["smart-home", "smart_home", "منزل ذكي"].includes(category)) return "smart-home";
  if (["cctv", "security", "أمني", "كاميرات"].includes(category)) return "cctv";
  if (["electrical-fault", "electrical_fault", "electrical", "كهربائي"].includes(category)) {
    return "electrical-fault";
  }
  return null;
}

function parseAnalysis(value: Record<string, unknown>): VoiceAnalysis | null {
  const nested = asObject(value.analysis) ?? asObject(value.result) ?? asObject(value.data);
  const data = nested ?? value;
  const summary = data.summary ?? data.diagnosis;
  const safetyAdvice = data.safetyAdvice ?? data.safety_advice ?? data.recommendation;
  const urgency = normalizeUrgency(data.urgency ?? data.riskLevel ?? data.risk_level);
  const category = normalizeCategory(data.category);
  if (
    typeof summary !== "string" ||
    !summary.trim() ||
    typeof safetyAdvice !== "string" ||
    !safetyAdvice.trim() ||
    !urgency ||
    !category
  ) {
    return null;
  }
  return { summary: summary.trim(), urgency, category, safetyAdvice: safetyAdvice.trim() };
}

export async function analyzeFaultAudio(input: AudioAnalysisInput): Promise<AudioAnalysisResult> {
  const endpoint =
    process.env.AUDIO_ANALYSIS_ENDPOINT?.trim() || "https://voltix-dpe94xwm0x88.edgeone.dev/";
  let target: URL;
  try {
    target = new URL(endpoint);
  } catch {
    throw new AudioAnalysisServiceError("not_configured");
  }
  if (target.protocol !== "https:") throw new AudioAnalysisServiceError("not_configured");

  const form = new FormData();
  form.set("audio", input.audio, input.audio.name || "voice-report");
  if (input.emergencyType) form.set("emergencyType", input.emergencyType);
  if (input.description) form.set("description", input.description);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    let response: Response;
    try {
      response = await fetch(target, {
        method: "POST",
        body: form,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      throw new AudioAnalysisServiceError(controller.signal.aborted ? "timeout" : "network");
    }
    if (!response.ok) throw new AudioAnalysisServiceError("http");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AudioAnalysisServiceError("invalid_response");
    }

    const value = asObject(payload);
    if (!value) throw new AudioAnalysisServiceError("invalid_response");
    const nested = asObject(value.result) ?? asObject(value.data) ?? value;
    const transcriptValue = nested.transcript ?? nested.text;
    if (typeof transcriptValue !== "string" || !transcriptValue.trim()) {
      throw new AudioAnalysisServiceError("invalid_response");
    }

    const analysis = parseAnalysis(value);
    return {
      transcript: transcriptValue.trim(),
      analysis:
        analysis ?? {
          summary: transcriptValue.trim(),
          urgency: "medium",
          category: "electrical-fault",
          safetyAdvice: "لا تفتح اللوحة ولا تلمس الأسلاك؛ انتظر فحص مهندس كهرباء مؤهل.",
        },
      usedFallback: !analysis,
    };
  } finally {
    clearTimeout(timeout);
  }
}
