import { NextResponse } from "next/server";
import { isSameOrigin, sanitize } from "@/lib/security";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { analyzeWithDeepSeek, sanitizeCustomerText } from "@/lib/ai/deepseek";
import { GROQ_STT_MODEL, isDeepSeekEnabled } from "@/lib/ai/config";
import { sendTelegramAnalysisReport } from "@/lib/telegram";
import { analyzeFaultAudio, AudioAnalysisServiceError } from "@/lib/audio-analysis-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = Math.floor(5.5 * 1024 * 1024);
const MAX_REQUEST_BYTES = 5_900_000;
const TIMEOUT_MS = 45_000;
const MAX_TRANSCRIPT_LENGTH = 1_500;
const HEADERS = { "Cache-Control": "no-store" };
const MODEL = "gemini-2.5-flash";
const STT_TIMEOUT_MS = 8_000;
const AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);

interface VoiceAnalysis {
  summary: string;
  urgency: "high" | "medium" | "low";
  category: "industrial" | "smart-home" | "cctv" | "electrical-fault";
  safetyAdvice: string;
}

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: HEADERS });
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getGeneratedText(body: unknown): string {
  if (
    !body ||
    typeof body !== "object" ||
    !("candidates" in body) ||
    !Array.isArray(body.candidates) ||
    !body.candidates[0] ||
    typeof body.candidates[0] !== "object" ||
    !("content" in body.candidates[0]) ||
    !body.candidates[0].content ||
    typeof body.candidates[0].content !== "object" ||
    !("parts" in body.candidates[0].content) ||
    !Array.isArray(body.candidates[0].content.parts)
  ) {
    return "";
  }

  const parts: unknown[] = body.candidates[0].content.parts;
  return parts
    .filter(
      (part: unknown): part is { text: string } =>
        Boolean(part && typeof part === "object" && "text" in part && typeof part.text === "string"),
    )
    .map((part: { text: string }) => part.text)
    .join("\n")
    .trim();
}

function fallbackAnalysis(transcript: string): VoiceAnalysis {
  const urgent = /شرر|دخان|احتراق|حريق|incendie|صعق|صدمة كهربائية|أسلاك مكشوفة/i.test(transcript);
  return {
    summary: transcript.slice(0, 500),
    urgency: urgent ? "high" : "medium",
    category: "electrical-fault",
    safetyAdvice: urgent
      ? "ابتعد عن مصدر الخطر ولا تلمس المعدات. اتصل بخدمات الطوارئ المحلية إذا كان هناك خطر مباشر."
      : "لا تفتح اللوحة ولا تلمس الأسلاك؛ انتظر فحص مهندس كهرباء مؤهل.",
  };
}

async function transcribeWithGroq(audio: File): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("Speech transcription is not configured.");

  const form = new FormData();
  form.set("file", audio, "voice-report");
  form.set("model", GROQ_STT_MODEL);
  form.set("response_format", "json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Speech transcription returned HTTP ${response.status}.`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("text" in body) || typeof body.text !== "string") {
      throw new Error("Speech transcription returned an invalid response.");
    }
    return sanitizeCustomerText(body.text, MAX_TRANSCRIPT_LENGTH);
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAnalysisReport(
  transcript: string,
  analysis: VoiceAnalysis,
  report?: Awaited<ReturnType<typeof analyzeWithDeepSeek>>,
) {
  try {
    const delivery = await sendTelegramAnalysisReport({
      kind: "voice",
      receivedAt: new Date().toISOString(),
      problem: transcript,
      summary: report?.summary ?? analysis.summary,
      findings: report?.findings ?? [],
      recommendedActions: report?.recommended_actions ?? [analysis.safetyAdvice],
      requiredTools: report?.required_tools ?? [],
      confidence: report?.confidence,
    });
    if (!delivery.ok) console.warn("[VOICE SOS] Optional Telegram report was not delivered.");
  } catch {
    console.warn("[VOICE SOS] Optional Telegram report was not delivered.");
  }
}

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "/api/voice-sos");
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "تم تجاوز عدد المحاولات. حاول لاحقاً." },
      { status: 429, headers: { ...HEADERS, ...rateLimitHeaders(limit) } },
    );
  }
  if (!isSameOrigin(request)) return fail(403, "طلب غير مسموح به.");

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return fail(413, "حجم التسجيل يتجاوز الحد الآمن (5.5 ميبيبايت). اختصر التسجيل وحاول مجدداً.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "تعذّرت قراءة الملف الصوتي.");
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return fail(400, "أرفق تسجيلاً صوتياً صالحاً.");
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail(413, "حجم التسجيل يتجاوز الحد المسموح (5.5 ميبيبايت). اختصر التسجيل وحاول مجدداً.");
  }
  const mimeType = audio.type.toLowerCase().split(";")[0];
  if (!AUDIO_TYPES.has(mimeType)) return fail(415, "صيغة الصوت غير مدعومة. استخدم WebM أو MP4 أو OGG أو WAV.");

  const emergencyTypeValue = form.get("emergencyType");
  const descriptionValue = form.get("description");
  try {
    const result = await analyzeFaultAudio({
      audio,
      emergencyType:
        typeof emergencyTypeValue === "string" ? sanitize(emergencyTypeValue, 80) : undefined,
      description:
        typeof descriptionValue === "string" ? sanitize(descriptionValue, MAX_TRANSCRIPT_LENGTH) : undefined,
    });
    const transcript = sanitizeCustomerText(result.transcript, MAX_TRANSCRIPT_LENGTH);
    if (!transcript) throw new AudioAnalysisServiceError("invalid_response");
    const fallback = fallbackAnalysis(transcript);
    const analysis = {
      summary: sanitizeCustomerText(result.analysis.summary, 500) || fallback.summary,
      urgency: result.analysis.urgency,
      category: result.analysis.category,
      safetyAdvice: sanitizeCustomerText(result.analysis.safetyAdvice, 500) || fallback.safetyAdvice,
    } satisfies VoiceAnalysis;
    await sendAnalysisReport(transcript, analysis);
    return NextResponse.json(
      { ok: true, transcript, analysis, usedFallback: result.usedFallback },
      { headers: HEADERS },
    );
  } catch (error) {
    const code = error instanceof AudioAnalysisServiceError ? error.code : "unknown";
    console.warn("[VOICE SOS] Audio analysis request failed; using the existing speech fallback.", { code });
  }

  if (isDeepSeekEnabled()) {
    let transcript = "";
    try {
      transcript = await transcribeWithGroq(audio);
    } catch {
      console.warn("[VOICE SOS] Speech transcription failed.");
      return fail(502, "تعذّر تفريغ التسجيل الصوتي الآن. حاول مجدداً أو اكتب وصف العطل.");
    }

    if (transcript) {
      let report: Awaited<ReturnType<typeof analyzeWithDeepSeek>> | undefined;
      try {
        report = await analyzeWithDeepSeek({ transcript });
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error && typeof error.code === "string"
            ? error.code
            : "unknown";
        console.warn("[VOICE SOS] Optional analysis failed; using safe local guidance.", { code });
      }
      const fallback = fallbackAnalysis(transcript);
      const analysis: VoiceAnalysis = report
        ? {
            summary: sanitizeCustomerText(report.summary, 500),
            urgency: /شرر|دخان|احتراق|حريق|incendie|صعق|صدمة كهربائية|أسلاك مكشوفة/i.test(
              `${report.summary} ${report.findings.join(" ")}`,
            )
              ? "high"
              : "medium",
            category: "electrical-fault",
            safetyAdvice: fallback.safetyAdvice,
          }
        : fallback;
      await sendAnalysisReport(transcript, analysis, report);
      return NextResponse.json(
        { ok: true, transcript, analysis, usedFallback: !report },
        { headers: HEADERS },
      );
    }
    return fail(502, "لم نتمكن من فهم التسجيل بوضوح. أعد المحاولة أو اكتب وصف العطل.");
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("[VOICE SOS] GEMINI_API_KEY is not configured.");
    return fail(500, "خدمة تحليل الصوت غير مهيأة حالياً. اكتب وصف العطل أو حاول لاحقاً.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const audioBase64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'استمع إلى التسجيل كما هو، وافرغ كلامه حرفياً بلغته الأصلية (قد يكون بالعربية الفصحى أو الدارجة الجزائرية أو الفرنسية)، ثم حلل بلاغ العطل. أعد JSON فقط بالمفاتيح التالية: {"transcript":"النص المفرغ","summary":"ملخص العطل بالعربية","urgency":"high|medium|low","category":"industrial|smart-home|cctv|electrical-fault","safetyAdvice":"نصيحة أمان فورية بالعربية"}. لا تخمّن تفاصيل غير مسموعة. عند ذكر شرر أو دخان أو احتراق أو صعق، اجعل الاستعجال high وانصح بالابتعاد وطلب خدمات الطوارئ المحلية عند وجود خطر مباشر. لا تطلب لمس أو فتح المعدات.',
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: audioBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 700,
          },
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const providerError = await response.text();
      console.error(`[VOICE SOS] Gemini returned HTTP ${response.status}.`);
      if (
        response.status === 401 ||
        response.status === 403 ||
        (response.status === 400 && /API key not valid|API_KEY_INVALID/i.test(providerError))
      ) {
        return fail(503, "تعذّر التحقق من إعداد خدمة الصوت. اكتب وصف العطل أو حاول لاحقاً.");
      }
      if (response.status === 429) {
        return NextResponse.json(
          { ok: false, error: "خدمة تحليل الصوت مشغولة حالياً. حاول بعد قليل أو اكتب وصف العطل." },
          { status: 429, headers: HEADERS },
        );
      }
      return fail(502, "تعذّر تحليل التسجيل الصوتي حالياً. حاول مجدداً أو اكتب وصف العطل.");
    }

    const responseBody: unknown = await response.json();
    const generated = parseJsonObject(getGeneratedText(responseBody));
    const transcript =
      typeof generated?.transcript === "string"
        ? sanitizeCustomerText(generated.transcript, MAX_TRANSCRIPT_LENGTH)
        : "";
    if (!transcript) {
      console.error("[VOICE SOS] Gemini did not return a usable transcript.");
      return fail(502, "لم نتمكن من فهم التسجيل بوضوح. أعد المحاولة أو اكتب وصف العطل.");
    }

    const analysisData = generated ?? {};
    const fallback = fallbackAnalysis(transcript);
    const urgency =
      analysisData.urgency === "high" || analysisData.urgency === "medium" || analysisData.urgency === "low"
        ? analysisData.urgency
        : fallback.urgency;
    const category =
      analysisData.category === "industrial" ||
      analysisData.category === "smart-home" ||
      analysisData.category === "cctv" ||
      analysisData.category === "electrical-fault"
        ? analysisData.category
        : fallback.category;
    const usedFallback =
      typeof analysisData.summary !== "string" ||
      !analysisData.summary.trim() ||
      typeof analysisData.safetyAdvice !== "string" ||
      !analysisData.safetyAdvice.trim() ||
      urgency !== analysisData.urgency ||
      category !== analysisData.category;
    const analysis: VoiceAnalysis = {
      summary:
        typeof analysisData.summary === "string" && analysisData.summary.trim()
          ? sanitizeCustomerText(analysisData.summary, 500)
          : fallback.summary,
      urgency,
      category,
      safetyAdvice:
        typeof analysisData.safetyAdvice === "string" && analysisData.safetyAdvice.trim()
          ? sanitizeCustomerText(analysisData.safetyAdvice, 500)
          : fallback.safetyAdvice,
    };

    return NextResponse.json(
      { ok: true, transcript, analysis, usedFallback },
      { headers: HEADERS },
    );
  } catch (error) {
    if (controller.signal.aborted) return fail(504, "استغرق تحليل الصوت وقتاً أطول من المتوقع.");
    console.error("[VOICE SOS] Gemini request failed.", error);
    return fail(502, "تعذّر الاتصال بخدمة تحليل الصوت.");
  } finally {
    clearTimeout(timeout);
  }
}
