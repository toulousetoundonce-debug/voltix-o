import { NextResponse } from "next/server";
import { computePricingEstimate } from "@/lib/pricing/engine";
import type { ServiceLine } from "@/lib/pricing/types";
import { CURRENCY, PROJECTS, TIERS } from "@/lib/pricing";
import { quoteSchema } from "@/lib/schemas";
import { deliver, isSameOrigin, readJsonBody } from "@/lib/security";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { sendTelegramAlert } from "@/lib/telegram";
import { getEstimateReference } from "@/lib/pricing/references";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
type QuoteOutcome = { status: number; body: Record<string, unknown> };
const idempotencyCache = new Map<string, { createdAt: number; promise: Promise<QuoteOutcome> }>();

function fail(status: number, error: string, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: { ...HEADERS, ...headers } });
}

function resolveServiceLine(projectType: string): ServiceLine {
  if (projectType === "smart_home") return "smart-home";
  if (projectType === "cctv") return "cctv-network";
  if (projectType === "commercial") return "commercial";
  return "industrial";
}

export async function POST(req: Request) {
  const limit = checkRateLimit(req, "/api/quote");
  if (!limit.allowed) {
    return fail(429, "تم تجاوز عدد المحاولات المسموح بها. حاول لاحقاً.", undefined, {
      ...rateLimitHeaders(limit),
    });
  }
  if (!isSameOrigin(req)) return fail(403, "طلب غير مسموح به.");

  const body = await readJsonBody(req);
  if (!body.ok) return fail(body.status, body.error);

  const parsed = quoteSchema.safeParse(body.data);
  if (!parsed.success) {
    return fail(400, "تحقق من البيانات المدخلة.", { fieldErrors: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;
  if (data.website?.trim()) {
    return NextResponse.json({ ok: true, message: "تم استلام طلبك." }, { headers: HEADERS });
  }

  for (const [key, entry] of idempotencyCache) {
    if (Date.now() - entry.createdAt > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(key);
  }
  if (data.requestId) {
    const duplicate = idempotencyCache.get(data.requestId);
    if (duplicate) {
      const outcome = await duplicate.promise;
      return NextResponse.json({ ...outcome.body, duplicate: true }, { status: outcome.status, headers: HEADERS });
    }
  }

  const estimate = computePricingEstimate({
    serviceLine: resolveServiceLine(data.projectType),
    areaM2: data.area,
    quantity: data.units,
    tier: data.tier === "economic" ? "economy" : data.tier === "professional" ? "premium" : "standard",
    wilaya: data.city,
    detailLevel: data.pricingDetailLevel ?? "unknown",
    includeVat: data.includeVat ?? true,
    options: data.options,
    renovation: data.renovation,
    accessDifficulty: data.accessDifficulty,
  });
  const project = PROJECTS[data.projectType];
  const tier = TIERS[data.tier];
  const referenceId = getEstimateReference(data.requestId);
  const boqSummary = estimate.boq.slice(0, 8)
    .map((line) => `${line.nameAr} × ${line.quantity} = ${line.totalDzd} دج`).join("\n");
  const text = [
    "📊 طلب معاينة وتقدير أولي",
    `المرجع: ${referenceId}`,
    `الاسم: ${data.fullName}`,
    `الهاتف / واتساب: ${data.phone}`,
    `المدينة: ${data.city}`,
    `المشروع: ${project.label}`,
    `المساحة: ${data.area} م²`,
    `${project.unitLabel}: ${data.units}`,
    `مستوى التجهيز: ${tier.label}`,
    `التقدير شامل TVA: ${estimate.min} - ${estimate.max} ${CURRENCY}`,
    `المتوقع: ${estimate.expected} دج · الثقة: ${estimate.confidence} (${estimate.confidenceScore}%)`,
    `المدة التقديرية: ${estimate.durationRangeDays.min}-${estimate.durationRangeDays.max} يوم`,
    `جدول الكميات: ${boqSummary}`,
    `الافتراضات: ${estimate.assumptions.join("؛ ")}`,
    `محركات السعر: ${estimate.priceDrivers.join("؛ ")}`,
    `جودة العميل داخلياً: اكتمال 60%؛ الكمية ${data.units}`,
    `تحذيرات داخلية: ${estimate.internalWarnings.join("؛ ") || "لا توجد"}`,
    ...(data.aiDiagnosis ? [`التشخيص الذكي: ${data.aiDiagnosis}`] : []),
  ].join("\n");
  const customerWhatsappUrl =
    `https://wa.me/${data.phone.replace(/\D/gu, "")}?text=${encodeURIComponent(`مرحباً، بخصوص تقديركم ${referenceId}.`)}`;

  const task = async (): Promise<QuoteOutcome> => {
    const telegramResult = await sendTelegramAlert("📊 طلب معاينة وتقدير أولي", {
      "المرجع": referenceId,
      "الاسم": data.fullName,
      "الهاتف / واتساب": data.phone,
      "المدينة": data.city,
      "العنوان أو المعلم": data.address ?? "غير محدد",
      "الوقت المفضل": data.preferredWindow ?? "أي وقت مناسب",
      "المشروع": project.label,
      "المساحة": `${data.area} م²`,
      [project.unitLabel]: data.units,
      "مستوى التجهيز": tier.label,
      "النطاق شامل TVA": `${estimate.min} - ${estimate.max} دج`,
      "المتوقع والثقة": `${estimate.expected} دج · ${estimate.confidence} (${estimate.confidenceScore}%)`,
      "مدة التنفيذ": `${estimate.durationRangeDays.min}-${estimate.durationRangeDays.max} يوم`,
      "جدول الكميات": boqSummary,
      "الافتراضات": estimate.assumptions.join("؛ "),
      "محركات السعر": estimate.priceDrivers.join("؛ "),
      "جودة العميل (داخلي)": `اكتمال 60%، الكمية ${data.units}`,
      "تحذيرات داخلية": estimate.internalWarnings.join("؛ ") || "لا توجد",
      "رابط واتساب العميل": customerWhatsappUrl,
      ...(data.aiDiagnosis ? { "التشخيص الذكي": data.aiDiagnosis } : {}),
    }, undefined, customerWhatsappUrl);

    const webhookStatus = await deliver(process.env.QUOTE_WEBHOOK_URL, {
      type: "quote",
      text,
      content: text,
      fullName: data.fullName,
      phone: data.phone,
      city: data.city,
      address: data.address ?? null,
      preferredWindow: data.preferredWindow ?? null,
      projectType: data.projectType,
      area: data.area,
      units: data.units,
      tier: data.tier,
      referenceId,
      estimate,
      currency: CURRENCY,
      receivedAt: new Date().toISOString(),
    });
    if (webhookStatus !== "sent" && process.env.QUOTE_WEBHOOK_URL) {
      console.warn("[QUOTE] Auxiliary webhook delivery failed.");
    }

    if (!telegramResult.ok) {
      console.error("[QUOTE] Telegram delivery failed; lead was not acknowledged.");
      return {
        status: 502,
        body: { ok: false, error: "تعذّر تسليم طلب المعاينة إلى فريق Voltix. حاول مجدداً أو اتصل بنا مباشرة." },
      };
    }
    return {
      status: 200,
      body: {
        ok: true,
        message: "تم استلام طلبك. سنتواصل معك قريباً لترتيب المعاينة والدراسة الفنية.",
        estimate: { ...estimate, base: estimate.expected },
        referenceId,
      },
    };
  };

  const promise = task();
  const requestId = data.requestId;
  if (requestId) {
    idempotencyCache.set(requestId, { createdAt: Date.now(), promise });
    promise.then((outcome) => {
      if (!outcome.body.ok && idempotencyCache.get(requestId)?.promise === promise) {
        idempotencyCache.delete(requestId);
      }
    }).catch(() => {
      if (idempotencyCache.get(requestId)?.promise === promise) idempotencyCache.delete(requestId);
    });
  }
  const outcome = await promise;
  return NextResponse.json(outcome.body, { status: outcome.status, headers: HEADERS });
}
