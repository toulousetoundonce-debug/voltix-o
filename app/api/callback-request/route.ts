import { NextResponse } from "next/server";
import { callbackSchema } from "@/lib/schemas";
import { isSameOrigin, readJsonBody } from "@/lib/security";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { sendTelegramAlert } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

function fail(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ ok: false, error }, { status, headers: { ...HEADERS, ...headers } });
}

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "/api/callback-request");
  if (!limit.allowed) {
    return fail(429, "وصلت إلى الحد المؤقت لطلبات الاتصال. حاول بعد قليل.", rateLimitHeaders(limit));
  }
  if (!isSameOrigin(request)) return fail(403, "طلب غير مسموح به.");

  const body = await readJsonBody(request);
  if (!body.ok) return fail(body.status, body.error);

  const parsed = callbackSchema.safeParse(body.data);
  if (!parsed.success) {
    return fail(400, "أدخل رقم هاتف صالحاً.", {
      "Content-Type": "application/json",
    });
  }

  const result = await sendTelegramAlert("⚡ طلب اتصال فوري من مهندس", {
    الهاتف: parsed.data.phone,
    المصدر: "زر طلب مساعدة فورية في الموقع",
  });
  console.info("[CALLBACK] Telegram delivery.", result);
  if (!result.ok) {
    return fail(503, "تعذّر إرسال طلب الاتصال حالياً. تحقق من إعداد Telegram أو حاول الاتصال بنا مباشرة.");
  }

  return NextResponse.json(
    { ok: true, message: "وصل طلبك إلى فريق Voltix. سنتصل بك قريباً." },
    { headers: HEADERS },
  );
}
