import { NextResponse } from "next/server";
import { getClientIp, isSameOrigin, rateLimit, readJsonBody } from "@/lib/security";
import { EMERGENCY_VALUES, type EmergencyType } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 45_000;
const HEADERS = { "Cache-Control": "no-store" };
const MODEL = "gemini-2.5-flash";

interface VisionResult {
  diagnosis: string;
  riskLevel: "خطر مرتفع" | "متوسط" | "عادي";
  recommendation: string;
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

function engineeringGuidance(emergencyType: EmergencyType | null) {
  const defaultRecommendation =
    "لا تفتح اللوحة ولا تلمس الأسلاك أو القواطع. من مسافة آمنة، دوّن أي دخان أو رائحة احتراق أو تغير لون ظاهر، واترك المعاينة لفني مؤهل.";
  const guidance: Partial<Record<EmergencyType, { riskLevel: VisionResult["riskLevel"]; recommendation: string }>> = {
    dangerous_short_circuit: {
      riskLevel: "خطر مرتفع",
      recommendation:
        "ابتعد عن اللوحة ولا تلمس القواطع أو الأسلاك. إذا أمكن فصل التغذية من مكان آمن فافعل، واتصل بخدمات الطوارئ المحلية عند وجود دخان أو شرر أو خطر مباشر.",
    },
    industrial_line_down: {
      riskLevel: "متوسط",
      recommendation:
        "لا تعاود تشغيل خط الإنتاج ولا تفتح لوحة التحكم. دوّن مؤشرات الإنذار الظاهرة من مسافة آمنة واترك عزل العطل للفني المسؤول.",
    },
    control_panel_fault: {
      riskLevel: "متوسط",
      recommendation:
        "لا تفتح لوحة التحكم ولا تلمس الموصلات. سجّل رموز الأعطال الظاهرة من الخارج واترك فحص اللوحة لمهندس مؤهل.",
    },
    security_system_down: {
      riskLevel: "عادي",
      recommendation:
        "لا تفتح مزود الطاقة أو تمديدات النظام. دوّن مؤشرات الحالة الظاهرة من الخارج ودع الفريق يفحص التوصيلات.",
    },
  };
  const selected = emergencyType ? guidance[emergencyType] : undefined;
  return {
    diagnosis:
      "لم تتوفر حالياً نتيجة تحليل بصري آلي. ستُرفق الصورة للمراجعة الهندسية؛ هذه الإرشادات لا تصف ما يظهر في الصورة.",
    riskLevel: selected?.riskLevel ?? "متوسط",
    recommendation: selected?.recommendation ?? defaultRecommendation,
  } satisfies VisionResult;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "طلب غير مسموح به.");
  const limit = rateLimit(`vision-check:${getClientIp(request)}`, 5, 10 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "تم تجاوز عدد محاولات فحص الصور. حاول لاحقاً." },
      { status: 429, headers: { ...HEADERS, "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body = await readJsonBody(request, 7 * 1024 * 1024);
  if (!body.ok) return fail(body.status, body.error);
  if (!body.data || typeof body.data !== "object" || !("imageBase64" in body.data)) {
    return fail(400, "أرسل صورة للفحص.");
  }

  const { imageBase64 } = body.data;
  if (typeof imageBase64 !== "string") return fail(400, "صيغة الصورة غير صالحة.");
  const match = imageBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return fail(415, "الصيغ المدعومة هي JPEG وPNG وWebP.");
  if (match[2].length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3)) {
    return fail(413, "حجم الصورة بعد الضغط يجب ألا يتجاوز 5 ميغابايت.");
  }

  const submittedType =
    "emergencyType" in body.data &&
    typeof body.data.emergencyType === "string" &&
    EMERGENCY_VALUES.includes(body.data.emergencyType as EmergencyType)
      ? (body.data.emergencyType as EmergencyType)
      : null;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("[VISION CHECK] GEMINI_API_KEY is not configured.");
    return NextResponse.json(
      {
        ok: true,
        mode: "manual-review",
        result: engineeringGuidance(submittedType),
        message: "مفتاح تحليل الصور غير مضبوط؛ ستُرفق الصورة للمراجعة عند إرسال بلاغ SOS.",
      },
      { headers: HEADERS },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
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
                    'أنت مهندس كهرباء خبير في Voltix Dynamics. افحص صورة اللوحة الكهربائية أو مكان العطل بصرياً، ولا تفترض أي شيء لا يظهر بوضوح. أعد JSON فقط بالمفاتيح: {"diagnosis":"تشخيص فني مختصر بالعربية لحالة الأسلاك أو القواطع الظاهرة","riskLevel":"خطر مرتفع|متوسط|عادي","recommendation":"التوصية الهندسية الأولية قبل وصول فريق Voltix"}. عند عدم وضوح الصورة، اذكر ذلك صراحة ولا تخترع عطلاً. نبّه دائماً إلى عدم فتح اللوحة أو لمس الأسلاك الحية وأن الفحص عن بعد لا يغني عن معاينة مهندس مؤهل.',
                },
                {
                  inline_data: {
                    mime_type: match[1],
                    data: match[2],
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 500,
          },
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const providerError = await response.text();
      console.error(`[VISION CHECK] Gemini returned HTTP ${response.status}.`);
      if (
        response.status === 401 ||
        response.status === 403 ||
        (response.status === 400 && /API key not valid|API_KEY_INVALID/i.test(providerError))
      ) {
        return fail(503, "مفتاح Gemini غير صالح. حدّث GEMINI_API_KEY في .env.local بمفتاح Google AI Studio صالح.");
      }
      if (response.status === 429) {
        return NextResponse.json(
          { ok: false, error: "خدمة تحليل الصور مشغولة حالياً. ستبقى الصورة مرفقة ويمكن إرسالها للمراجعة." },
          { status: 429, headers: HEADERS },
        );
      }
      return fail(502, "تعذّر تحليل الصورة آلياً الآن. ستبقى الصورة مرفقة ويمكن إرسال البلاغ للمراجعة.");
    }

    const responseBody: unknown = await response.json();
    const generated = parseJsonObject(getGeneratedText(responseBody));
    if (
      !generated ||
      typeof generated.diagnosis !== "string" ||
      !generated.diagnosis.trim() ||
      !["خطر مرتفع", "متوسط", "عادي"].includes(String(generated.riskLevel)) ||
      typeof generated.recommendation !== "string" ||
      !generated.recommendation.trim()
    ) {
      console.error("[VISION CHECK] Gemini returned an invalid structured response.");
      return fail(502, "وصل رد غير مكتمل من خدمة الصور. ستبقى الصورة مرفقة ويمكن إرسال البلاغ للمراجعة.");
    }

    const result: VisionResult = {
      diagnosis: generated.diagnosis.trim().slice(0, 1_000),
      riskLevel: generated.riskLevel as VisionResult["riskLevel"],
      recommendation: generated.recommendation.trim().slice(0, 1_000),
    };

    return NextResponse.json({ ok: true, result, provider: "gemini", model: MODEL }, { headers: HEADERS });
  } catch (error) {
    if (controller.signal.aborted) return fail(504, "استغرق فحص الصورة وقتاً أطول من المتوقع.");
    console.error("[VISION CHECK] Gemini request failed.", error);
    return fail(502, "تعذّر الاتصال بخدمة فحص الصور. ستبقى الصورة مرفقة لإرسالها مع البلاغ.");
  } finally {
    clearTimeout(timeout);
  }
}
