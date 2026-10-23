import { NextResponse } from "next/server";
import { getClientIp, isSameOrigin, rateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 14 * 1024 * 1024;
const TIMEOUT_MS = 45_000;
const MAX_TRANSCRIPT_LENGTH = 1_500;
const HEADERS = { "Cache-Control": "no-store" };
const MODEL = "gemini-2.5-flash";
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

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "طلب غير مسموح به.");
  const limit = rateLimit(`voice-sos:${getClientIp(request)}`, 4, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "تم تجاوز عدد المحاولات. حاول لاحقاً." },
      { status: 429, headers: { ...HEADERS, "Retry-After": String(limit.retryAfter) } },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_AUDIO_BYTES + 100_000) return fail(413, "حجم التسجيل كبير جداً.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "تعذّرت قراءة الملف الصوتي.");
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return fail(400, "أرفق تسجيلاً صوتياً صالحاً.");
  if (audio.size > MAX_AUDIO_BYTES) return fail(413, "الحد الأقصى لحجم التسجيل 14 ميغابايت.");
  const mimeType = audio.type.toLowerCase().split(";")[0];
  if (!AUDIO_TYPES.has(mimeType)) return fail(415, "صيغة الصوت غير مدعومة. استخدم WebM أو MP4 أو OGG أو WAV.");

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("[VOICE SOS] GEMINI_API_KEY is not configured.");
    return fail(500, "مفتاح GEMINI_API_KEY غير موجود في ملف .env.local. أضفه ثم أعد تشغيل الخادم.");
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
        return fail(503, "مفتاح Gemini غير صالح. حدّث GEMINI_API_KEY في .env.local بمفتاح Google AI Studio صالح.");
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
        ? generated.transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH)
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
          ? analysisData.summary.trim().slice(0, 500)
          : fallback.summary,
      urgency,
      category,
      safetyAdvice:
        typeof analysisData.safetyAdvice === "string" && analysisData.safetyAdvice.trim()
          ? analysisData.safetyAdvice.trim().slice(0, 500)
          : fallback.safetyAdvice,
    };

    return NextResponse.json(
      { ok: true, transcript, analysis, usedFallback, provider: "gemini", model: MODEL },
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
