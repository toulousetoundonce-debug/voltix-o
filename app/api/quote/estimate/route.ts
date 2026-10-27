import { NextResponse } from "next/server";
import { computePricingEstimate } from "@/lib/pricing/engine";
import { pricingInputSchema } from "@/lib/pricing/schema";
import { isSameOrigin, readJsonBody } from "@/lib/security";
import { getEstimateReference } from "@/lib/pricing/references";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "طلب غير مسموح به." }, { status: 403 });
  }
  const body = await readJsonBody(request, 32_000);
  if (!body.ok) return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  const parsed = pricingInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "تحقق من بيانات التقدير.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const estimate = computePricingEstimate(parsed.data);
  return NextResponse.json({
    ok: true,
    referenceId: getEstimateReference(parsed.data.requestId),
    estimate: { ...estimate, base: estimate.expected },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
