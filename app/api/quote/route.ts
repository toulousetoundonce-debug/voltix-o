import { NextResponse } from "next/server";
import { computeEstimate, CURRENCY, PROJECTS, TIERS } from "@/lib/pricing";
import { quoteSchema } from "@/lib/schemas";
import { deliver, isSameOrigin, readJsonBody } from "@/lib/security";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { sendTelegramAlert } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
function fail(status: number, error: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: { ...HEADERS, ...headers } });
}

export async function POST(req: Request) {
  const limit = checkRateLimit(req, "/api/quote");
  if (!limit.allowed) {
    return fail(429, "تم تجاوز عدد المحاولات المسموح بها. حاول لاحقاً.", undefined, {
      ...rateLimitHeaders(limit),
    });
  }
  if (!isSameOrigin(req)) {
    return fail(403, "طلب غير مسموح به.");
  }

  const body = await readJsonBody(req);
  if (!body.ok) {
    return fail(body.status, body.error);
  }

  const parsed = quoteSchema.safeParse(body.data);
  if (!parsed.success) {
    return fail(400, "تحقق من البيانات المدخلة.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;

  // Honeypot: fake success for bots.
  if (data.website && data.website.trim() !== "") {
    return NextResponse.json({ ok: true, message: "تم استلام طلبك." }, { headers: HEADERS });
  }

  // The estimate is always recomputed on the server; any client-side value is ignored.
  const estimate = computeEstimate(data);
  const project = PROJECTS[data.projectType];
  const tier = TIERS[data.tier];

  const text = [
    "📊 طلب دراسة جديد",
    `الاسم: ${data.fullName}`,
    `الهاتف / واتساب: ${data.phone}`,
    `المدينة: ${data.city}`,
    `المشروع: ${project.label}`,
    `المساحة: ${data.area} م²`,
    `${project.unitLabel}: ${data.units}`,
    `مستوى التجهيز: ${tier.label}`,
    `التقدير: ${estimate.min} - ${estimate.max} ${CURRENCY}`,
    ...(data.aiDiagnosis ? [`التشخيص الذكي: ${data.aiDiagnosis}`] : []),
  ].join("\n");

  const telegramResult = await sendTelegramAlert("📊 طلب دراسة سعر جديد", {
    الاسم: data.fullName,
    الهاتف: data.phone,
    المدينة: data.city,
    المشروع: project.label,
    المساحة: `${data.area} م²`,
    [project.unitLabel]: data.units,
    "مستوى التجهيز": tier.label,
    التقدير: `${estimate.min} - ${estimate.max} ${CURRENCY}`,
    ...(data.aiDiagnosis ? { "التشخيص الذكي": data.aiDiagnosis } : {}),
  });
  console.info("[QUOTE] Telegram delivery.", telegramResult);

  const status = await deliver(process.env.QUOTE_WEBHOOK_URL, {
    type: "quote",
    text,
    content: text,
    fullName: data.fullName,
    phone: data.phone,
    city: data.city,
    projectType: data.projectType,
    area: data.area,
    units: data.units,
    tier: data.tier,
    aiDiagnosis: data.aiDiagnosis ?? null,
    estimate,
    currency: CURRENCY,
    receivedAt: new Date().toISOString(),
  });

  if (status === "sent" || telegramResult.ok) {
    return NextResponse.json(
      { ok: true, message: "تم استلام طلبك. سنتواصل معك قريباً لترتيب المعاينة والدراسة الفنية.", estimate },
      { headers: HEADERS },
    );
  }

  if (status === "unconfigured") {
    console.error("[QUOTE] QUOTE_WEBHOOK_URL is not set: the quote request was NOT delivered.");
  }
  return fail(
    status === "unconfigured" ? 503 : 502,
    "تعذّر إرسال الطلب حالياً. يرجى المحاولة لاحقاً أو التواصل معنا مباشرة.",
  );
}
