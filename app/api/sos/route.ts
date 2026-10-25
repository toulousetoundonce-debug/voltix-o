import { NextResponse } from "next/server";
import { sosSchema } from "@/lib/schemas";
import { EMERGENCY_LABELS } from "@/lib/validation";
import { deliver, isSameOrigin, readJsonBody } from "@/lib/security";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { sendTelegramAlert, sendTelegramPhoto, sendTelegramPhotoUrl } from "@/lib/telegram";
import { analyzeWithDeepSeek, type DeepSeekReport } from "@/lib/ai/deepseek";
import { DEEPSEEK_CHAT_MODEL, isDeepSeekEnabled } from "@/lib/ai/config";
import { isSupabaseFaultImageUrl } from "@/lib/supabase-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const MAX_IMAGE_BASE64_LENGTH = 4 * Math.ceil((4 * 1024 * 1024) / 3);

function fail(status: number, error: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: { ...HEADERS, ...headers } });
}

export async function POST(req: Request) {
  const limit = checkRateLimit(req, "/api/sos");
  if (!limit.allowed) {
    return fail(429, "تم تجاوز عدد المحاولات المسموح بها. حاول لاحقاً أو اتصل بنا هاتفياً.", undefined, {
      ...rateLimitHeaders(limit),
    });
  }
  if (!isSameOrigin(req)) {
    return fail(403, "طلب غير مسموح به.");
  }

  const body = await readJsonBody(req, 5_800_000);
  if (!body.ok) {
    return fail(body.status, body.error);
  }

  const parsed = sosSchema.safeParse(body.data);
  if (!parsed.success) {
    return fail(400, "تحقق من البيانات المدخلة.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;

  // Honeypot: bots fill the hidden field. Answer with a fake success and drop the request.
  if (data.website && data.website.trim() !== "") {
    return NextResponse.json({ ok: true, message: "تم استلام البلاغ." }, { headers: HEADERS });
  }
  if (data.imageBase64 && data.imageBase64.split(",")[1].length > MAX_IMAGE_BASE64_LENGTH) {
    return fail(413, "حجم صورة البلاغ بعد الضغط يجب ألا يتجاوز 4 ميغابايت.");
  }
  if (data.imageUrl && !isSupabaseFaultImageUrl(data.imageUrl)) {
    return fail(400, "رابط صورة البلاغ غير صالح أو لا ينتمي إلى مساحة التخزين المهيأة.");
  }

  const label = EMERGENCY_LABELS[data.emergencyType];
  let textTriage: DeepSeekReport | undefined;
  if (isDeepSeekEnabled() && (data.description || data.aiDiagnosis)) {
    try {
      textTriage = await analyzeWithDeepSeek(
        {
          description: [data.description, data.aiDiagnosis].filter(Boolean).join("\n"),
          emergencyType: data.emergencyType,
          fieldReport: true,
        },
        { timeoutMs: 8_000, model: DEEPSEEK_CHAT_MODEL },
      );
    } catch {
      console.warn("[SOS] Optional field report was unavailable.");
    }
  }
  const mapsUrl = data.location
    ? `https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`
    : null;

  const text = [
    `🚨 SOS - ${label}`,
    `الاسم: ${data.fullName ?? "غير مذكور"}`,
    `الهاتف: ${data.phone}`,
    ...(data.description ? [`وصف المشكلة: ${data.description}`] : []),
    `الموقع: ${mapsUrl ?? "غير مرفق"}`,
    ...(data.voiceTranscript ? [`التفريغ الصوتي: ${data.voiceTranscript}`] : []),
    ...(data.aiDiagnosis ? [`التشخيص الذكي: ${data.aiDiagnosis}`] : []),
  ].join("\n");

  const photoCaption = `📷 صورة عطل مرفقة ببلاغ SOS من ${data.fullName ?? "غير مذكور"}. يرجى مراجعتها هندسياً.`;
  const [telegramResult, photoResult, status] = await Promise.all([
    sendTelegramAlert(
      `🚨 بلاغ طوارئ - ${label}`,
      {
        الاسم: data.fullName ?? "غير مذكور",
        الهاتف: data.phone,
        "نوع الطوارئ": label,
        ...(data.description ? { "وصف المشكلة": data.description } : {}),
        ...(data.voiceTranscript ? { "التفريغ الصوتي": data.voiceTranscript } : {}),
        ...(data.aiDiagnosis ? { "التشخيص الذكي": data.aiDiagnosis } : {}),
        ...(textTriage
          ? {
              "ملخص الفرز الأولي": textTriage.summary,
              "ملاحظات الفرز": textTriage.findings.join("\n"),
              "الإجراءات الموصى بها": textTriage.recommended_actions.join("\n"),
              "المعدات المطلوبة": textTriage.required_tools.join("\n"),
              "الثقة": textTriage.confidence ?? "غير محددة",
            }
          : {}),
        ...(data.imageBase64 || data.imageUrl ? { "صورة العطل": "مرفقة للمراجعة الهندسية" } : {}),
        "رابط الموقع": mapsUrl ?? "غير مرفق",
      },
      data.location ? { lat: data.location.lat, lng: data.location.lng } : undefined,
      `https://wa.me/${data.phone.replace(/\D/g, "")}?text=${encodeURIComponent("مرحباً، نتواصل معك بخصوص بلاغ العطل المرسل إلى Voltix Dynamics.")}`,
    ),
    data.imageUrl
      ? sendTelegramPhotoUrl(data.imageUrl, photoCaption)
      : data.imageBase64
        ? sendTelegramPhoto(data.imageBase64, photoCaption)
        : Promise.resolve(null),
    deliver(process.env.SOS_WEBHOOK_URL, {
      type: "sos",
      text,
      content: text,
      fullName: data.fullName ?? null,
      phone: data.phone,
      emergencyType: data.emergencyType,
      emergencyLabel: label,
      description: data.description ?? null,
      aiDiagnosis: data.aiDiagnosis ?? null,
      voiceTranscript: data.voiceTranscript ?? null,
      imageAttachmentIncluded: Boolean(data.imageBase64 || data.imageUrl),
      imageUrl: data.imageUrl ?? null,
      location: data.location ?? null,
      mapsUrl,
      receivedAt: new Date().toISOString(),
    }),
  ]);
  console.info("[SOS] Telegram delivery.", telegramResult);
  if (photoResult) console.info("[SOS] Telegram photo attachment.", photoResult);

  if (status === "sent" || telegramResult.ok || photoResult?.ok) {
    return NextResponse.json(
      {
        ok: true,
        message: "تم استلام بلاغ الطوارئ. سيتصل بك فريقنا في أقرب وقت ممكن.",
        ...(photoResult && !photoResult.ok
          ? { imageAttachmentError: photoResult.reason ?? "تعذّر إرسال الصورة للمراجعة." }
          : {}),
      },
      { headers: HEADERS },
    );
  }

  if (status === "unconfigured") {
    console.error("[SOS] SOS_WEBHOOK_URL is not set: the emergency request was NOT delivered.");
  }
  return fail(
    status === "unconfigured" ? 503 : 502,
    "تعذّر إرسال البلاغ حالياً. يرجى الاتصال بنا هاتفياً مباشرة.",
  );
}
