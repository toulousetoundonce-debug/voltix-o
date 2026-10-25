import { NextResponse } from "next/server";
import { isSameOrigin, readJsonBody, sanitize } from "@/lib/security";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { EMERGENCY_VALUES, type EmergencyType } from "@/lib/validation";
import { analyzeFaultImageWithGroq, GroqVisionError } from "@/lib/ai/groq-vision";
import { isSupabaseFaultImageUrl } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 150 * 1024;
const MAX_IMAGE_BASE64_LENGTH = 4 * Math.ceil(MAX_IMAGE_BYTES / 3);
const MAX_REQUEST_BYTES = 5_800_000;
const HEADERS = { "Cache-Control": "no-store" };

interface VisionResult {
  diagnosis: string;
  riskLevel: "خطر مرتفع" | "متوسط" | "عادي";
  recommendation: string;
}

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: HEADERS });
}

function engineeringGuidance(emergencyType: EmergencyType | null): VisionResult {
  const defaultRecommendation =
    "لا تفتح اللوحة ولا تلمس الأسلاك أو القواطع. ابتعد عن مصدر الخطر واترك المعاينة لفني مؤهل.";
  const guidance: Partial<Record<EmergencyType, Pick<VisionResult, "riskLevel" | "recommendation">>> = {
    dangerous_short_circuit: {
      riskLevel: "خطر مرتفع",
      recommendation:
        "ابتعد عن اللوحة ولا تلمس القواطع أو الأسلاك. اتصل بخدمات الطوارئ المحلية عند وجود دخان أو شرر أو خطر مباشر.",
    },
    industrial_line_down: {
      riskLevel: "متوسط",
      recommendation:
        "لا تعاود تشغيل خط الإنتاج ولا تفتح لوحة التحكم. دوّن مؤشرات الإنذار من مسافة آمنة واترك فحصها للفني المسؤول.",
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
      "لم يكتمل فحص الصورة. هذه إرشادات أمان عامة ولا تصف ما يظهر فيها؛ ستبقى الصورة مرفقة للمراجعة الهندسية عند إرسال البلاغ.",
    riskLevel: selected?.riskLevel ?? "متوسط",
    recommendation: selected?.recommendation ?? defaultRecommendation,
  };
}

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "/api/vision-check");
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "تم تجاوز عدد محاولات فحص الصور. حاول لاحقاً." },
      { status: 429, headers: { ...HEADERS, ...rateLimitHeaders(limit) } },
    );
  }
  if (!isSameOrigin(request)) return fail(403, "طلب غير مسموح به.");

  const body = await readJsonBody(request, MAX_REQUEST_BYTES);
  if (!body.ok) return fail(body.status, body.error);
  if (!body.data || typeof body.data !== "object") {
    return fail(400, "أرسل صورة للفحص.");
  }

  const imageBase64 = "imageBase64" in body.data ? body.data.imageBase64 : undefined;
  const imageUrl = "imageUrl" in body.data ? body.data.imageUrl : undefined;
  if (imageUrl !== undefined && (typeof imageUrl !== "string" || !isSupabaseFaultImageUrl(imageUrl))) {
    return fail(400, "رابط الصورة غير صالح أو لا ينتمي إلى مساحة التخزين المهيأة.");
  }
  if (imageUrl === undefined && typeof imageBase64 !== "string") return fail(400, "أرسل صورة للفحص.");
  const match =
    typeof imageBase64 === "string"
      ? imageBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
      : null;
  if (imageUrl === undefined && !match) return fail(415, "الصيغ المدعومة هي JPEG وPNG وWebP.");
  if (match && match[2].length > MAX_IMAGE_BASE64_LENGTH) {
    return fail(413, "حجم الصورة بعد الضغط يجب ألا يتجاوز 4 ميغابايت.");
  }
  if (match && Buffer.from(match[2], "base64").byteLength > MAX_IMAGE_BYTES) {
    return fail(413, "حجم الصورة بعد فك الترميز يتجاوز الحد المسموح.");
  }

  const submittedType =
    "emergencyType" in body.data &&
    typeof body.data.emergencyType === "string" &&
    EMERGENCY_VALUES.includes(body.data.emergencyType as EmergencyType)
      ? (body.data.emergencyType as EmergencyType)
      : null;
  const submittedDescription =
    "description" in body.data && typeof body.data.description === "string"
      ? sanitize(body.data.description, 1_500)
      : "";

  try {
    if (typeof imageUrl === "string" || match) {
      const image =
        typeof imageUrl === "string"
          ? imageUrl
          : `data:${match![1]};base64,${match![2]}`;
      const result = await analyzeFaultImageWithGroq({
        image,
        emergencyType: submittedType ?? undefined,
        description: submittedDescription || undefined,
      });
      return NextResponse.json({ ok: true, result }, { headers: HEADERS });
    }

    return fail(400, "أرسل صورة صالحة للفحص.");
  } catch (error) {
    const code =
      error instanceof GroqVisionError
        ? error.code
        : "unknown";
    console.warn("[VISION CHECK] Image analysis request failed.", { code });
    return NextResponse.json(
      {
        ok: true,
        mode: "manual-review",
        result: engineeringGuidance(submittedType),
        message: "تعذّر إكمال فحص الصورة الآن؛ ستبقى الصورة مرفقة للمراجعة الهندسية عند إرسال البلاغ.",
      },
      { headers: HEADERS },
    );
  }
}
