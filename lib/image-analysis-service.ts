export interface ImageAnalysisResult {
  diagnosis: string;
  riskLevel: "خطر مرتفع" | "متوسط" | "عادي";
  recommendation: string;
}

interface ImageAnalysisInput {
  image: Blob;
  emergencyType?: string;
  description?: string;
}

type FailureCode = "not_configured" | "timeout" | "network" | "http" | "invalid_response";

export class ImageAnalysisServiceError extends Error {
  constructor(readonly code: FailureCode) {
    super("تعذّر إكمال فحص الصورة.");
    this.name = "ImageAnalysisServiceError";
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeRiskLevel(value: unknown): ImageAnalysisResult["riskLevel"] | null {
  if (typeof value !== "string") return null;
  const risk = value.trim().toLowerCase();
  if (["خطر مرتفع", "high", "critical", "danger", "عالي"].includes(risk)) return "خطر مرتفع";
  if (["متوسط", "medium", "moderate"].includes(risk)) return "متوسط";
  if (["عادي", "low", "normal", "منخفض"].includes(risk)) return "عادي";
  return null;
}

function parseAnalysis(payload: unknown): ImageAnalysisResult | null {
  let value = asObject(payload);
  if (!value) return null;
  value = asObject(value.result) ?? asObject(value.data) ?? value;

  const diagnosis = value.diagnosis ?? value.summary;
  const recommendation = value.recommendation ?? value.recommended_action;
  const riskLevel = normalizeRiskLevel(value.riskLevel ?? value.risk_level ?? value.risk);
  if (
    typeof diagnosis !== "string" ||
    !diagnosis.trim() ||
    typeof recommendation !== "string" ||
    !recommendation.trim() ||
    !riskLevel
  ) {
    return null;
  }

  return { diagnosis: diagnosis.trim(), riskLevel, recommendation: recommendation.trim() };
}

export async function analyzeFaultImage(input: ImageAnalysisInput): Promise<ImageAnalysisResult> {
  const endpoint =
    process.env.IMAGE_ANALYSIS_ENDPOINT?.trim() || "https://voltix-dpe94xwm0x88.edgeone.dev/";
  let target: URL;
  try {
    target = new URL(endpoint);
  } catch {
    throw new ImageAnalysisServiceError("not_configured");
  }
  if (target.protocol !== "https:") throw new ImageAnalysisServiceError("not_configured");

  const form = new FormData();
  const extension =
    input.image.type === "image/png" ? "png" : input.image.type === "image/webp" ? "webp" : "jpg";
  form.set("image", input.image, `fault-image.${extension}`);
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
      throw new ImageAnalysisServiceError(controller.signal.aborted ? "timeout" : "network");
    }

    if (!response.ok) throw new ImageAnalysisServiceError("http");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ImageAnalysisServiceError("invalid_response");
    }

    const result = parseAnalysis(payload);
    if (!result) throw new ImageAnalysisServiceError("invalid_response");
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
