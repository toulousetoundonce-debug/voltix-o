import { NextResponse } from "next/server";
import { sosSchema } from "@/lib/schemas";
import { EMERGENCY_LABELS } from "@/lib/validation";
import { deliver, getClientIp, isSameOrigin, rateLimit, readJsonBody } from "@/lib/security";
import { sendTelegramAlert, sendTelegramPhoto } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 6;

function fail(status: number, error: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: { ...HEADERS, ...headers } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return fail(403, "طلب غير مسموح به.");
  }

  const limit = rateLimit(`sos:${getClientIp(req)}`, MAX_REQUESTS, WINDOW_MS);
  if (!limit.ok) {
    return fail(429, "تم تجاوز عدد المحاولات المسموح بها. حاول لاحقاً أو اتصل بنا هاتفياً.", undefined, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  const body = await readJsonBody(req, 8 * 1024 * 1024);
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

  const label = EMERGENCY_LABELS[data.emergencyType];
  const mapsUrl = data.location
    ? `https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`
    : null;

  const text = [
    `🚨 SOS - ${label}`,
    `الاسم: ${data.fullName}`,
    `الهاتف: ${data.phone}`,
    ...(data.description ? [`وصف المشكلة: ${data.description}`] : []),
    `الموقع: ${mapsUrl ?? "غير مرفق"}`,
    ...(data.voiceTranscript ? [`التفريغ الصوتي: ${data.voiceTranscript}`] : []),
    ...(data.aiDiagnosis ? [`التشخيص الذكي: ${data.aiDiagnosis}`] : []),
  ].join("\n");

  const telegramResult = await sendTelegramAlert(
    `🚨 بلاغ طوارئ - ${label}`,
    {
      الاسم: data.fullName,
      الهاتف: data.phone,
      "نوع الطوارئ": label,
      ...(data.description ? { "وصف المشكلة": data.description } : {}),
      ...(data.voiceTranscript ? { "التفريغ الصوتي": data.voiceTranscript } : {}),
      ...(data.aiDiagnosis ? { "التشخيص الذكي": data.aiDiagnosis } : {}),
      ...(data.imageBase64 ? { "صورة العطل": "مرفقة للمراجعة الهندسية" } : {}),
      "رابط الموقع": mapsUrl ?? "غير مرفق",
    },
    data.location ? { lat: data.location.lat, lng: data.location.lng } : undefined,
  );
  console.info("[SOS] Telegram delivery.", telegramResult);
  const photoResult = data.imageBase64
    ? await sendTelegramPhoto(
        data.imageBase64,
        `📷 صورة لوحة كهربائية مرفقة ببلاغ SOS من ${data.fullName}. يرجى مراجعتها هندسياً.`,
      )
    : null;
  if (photoResult) console.info("[SOS] Telegram photo attachment.", photoResult);

  const status = await deliver(process.env.SOS_WEBHOOK_URL, {
    type: "sos",
    text,
    content: text,
    fullName: data.fullName,
    phone: data.phone,
    emergencyType: data.emergencyType,
    emergencyLabel: label,
    description: data.description ?? null,
    aiDiagnosis: data.aiDiagnosis ?? null,
    voiceTranscript: data.voiceTranscript ?? null,
    imageAttachmentIncluded: Boolean(data.imageBase64),
    location: data.location ?? null,
    mapsUrl,
    receivedAt: new Date().toISOString(),
  });

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
