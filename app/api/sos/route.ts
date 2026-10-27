import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sosSchema, type SosInput } from "@/lib/schemas";
import { isSameOrigin, readJsonBody, deliver } from "@/lib/security";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import {
  editTelegramEmergencyCard,
  sendTelegramEmergencyCard,
  sendTelegramEmergencyPhoto,
  sendTelegramPhotoFailureReply,
} from "@/lib/telegram";
import { analyzeWithDeepSeek, type DeepSeekReport } from "@/lib/ai/deepseek";
import { DEEPSEEK_CHAT_MODEL, isDeepSeekEnabled } from "@/lib/ai/config";
import { isSupabaseFaultImageUrl } from "@/lib/supabase-storage";
import { emergencyStrings } from "@/lib/emergency-strings";
import {
  applyEmergencyTriage,
  createEmergencyReport,
  type EmergencyReport,
} from "@/lib/emergency-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const MAX_IMAGE_BASE64_LENGTH = 4 * Math.ceil((4 * 1024 * 1024) / 3);
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const idempotencyCache = new Map<
  string,
  { createdAt: number; promise: Promise<DispatchOutcome>; settled: boolean }
>();

interface DispatchOutcome {
  status: number;
  body: {
    ok: boolean;
    error?: string;
    message?: string;
    referenceId?: string;
    safetyAdvice?: string[];
    duplicate?: boolean;
  };
}
function fail(status: number, error: string): DispatchOutcome {
  return { status, body: { ok: false, error } };
}

function cleanupIdempotencyCache() {
  const expiredBefore = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [requestId, entry] of idempotencyCache) {
    if (entry.settled && entry.createdAt < expiredBefore) idempotencyCache.delete(requestId);
  }
  while (idempotencyCache.size > 2_000) {
    const oldestSettled = [...idempotencyCache].find(([, entry]) => entry.settled)?.[0];
    if (!oldestSettled) break;
    idempotencyCache.delete(oldestSettled);
  }
}

function startTriage(data: SosInput): Promise<DeepSeekReport | null> {
  if (!isDeepSeekEnabled() || (!data.description && !data.aiDiagnosis)) {
    return Promise.resolve(null);
  }
  return analyzeWithDeepSeek(
    {
      description: [data.description, data.aiDiagnosis].filter(Boolean).join("\n"),
      emergencyType: data.emergencyType,
      fieldReport: true,
    },
    { timeoutMs: 8_000, model: DEEPSEEK_CHAT_MODEL },
  )
    .then((report) => report)
    .catch(() => {
      console.warn("[SOS] Optional dispatch triage unavailable; sending local safety report.");
      return null;
    });
}

function webhookPayload(data: SosInput, report: EmergencyReport) {
  return {
    type: "sos",
    referenceId: report.referenceId,
    text: `🚨 ${report.referenceId} - ${report.emergencyType}\n${report.customer.phone}\n${report.customerWords}`,
    content: `🚨 ${report.referenceId} - ${report.emergencyType}\n${report.customer.phone}\n${report.customerWords}`,
    fullName: data.fullName ?? null,
    phone: data.phone,
    emergencyType: data.emergencyType ?? null,
    emergencyLabel: report.emergencyType,
    description: data.description ?? null,
    aiDiagnosis: data.aiDiagnosis ?? null,
    voiceTranscript: data.voiceTranscript ?? null,
    imageAttachmentIncluded: report.hasPhoto,
    imageUrl: data.imageUrl ?? null,
    location: data.location ?? null,
    mapsUrl: report.location.mapsUrl,
    receivedAt: report.createdAt,
  };
}

async function dispatchSos(data: SosInput): Promise<DispatchOutcome> {
  const createdAt = new Date();
  const hasPhoto = Boolean(data.imageBase64 || data.imageUrl);
  const report = createEmergencyReport({
    createdAt,
    fullName: data.fullName,
    phone: data.phone,
    description: data.description,
    voiceTranscript: data.voiceTranscript,
    aiDiagnosis: data.aiDiagnosis,
    emergencyType: data.emergencyType,
    location: data.location,
    hasPhoto,
  });
  const triagePromise = startTriage(data);

  const cardDelivery = await sendTelegramEmergencyCard(report);
  if (!cardDelivery.ok) {
    return fail(502, emergencyStrings.telegram.dispatchUnavailable);
  }
  if (!cardDelivery.messageId) {
    console.error("[SOS] Telegram accepted a dispatch card without a message id.");
  }

  const imageSource = data.imageUrl ?? data.imageBase64;
  if (imageSource && cardDelivery.messageId) {
    const photoDelivery = await sendTelegramEmergencyPhoto(imageSource, report, cardDelivery.messageId);
    if (!photoDelivery.ok) {
      const warning = await sendTelegramPhotoFailureReply(report.referenceId, cardDelivery.messageId);
      if (!warning.ok) {
        console.warn("[SOS] Photo upload failed and its Telegram reply could not be delivered.");
      }
    }
  } else if (imageSource) {
    console.warn("[SOS] Photo attachment skipped because Telegram returned no message id.");
  }

  const webhookUrl = process.env.SOS_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const webhookStatus = await deliver(webhookUrl, webhookPayload(data, report));
    if (webhookStatus !== "sent") {
      console.warn("[SOS] Auxiliary webhook delivery failed; Telegram dispatch was delivered.");
    }
  }

  const aiReport = await triagePromise;
  let finalReport = report;
  if (aiReport) {
    finalReport = applyEmergencyTriage(report, aiReport);
    if (cardDelivery.messageId) {
      const edited = await editTelegramEmergencyCard(
        finalReport,
        cardDelivery.messageId,
        cardDelivery.plainTextFallback ?? false,
      );
      if (!edited.ok) console.warn("[SOS] AI triage could not update the delivered dispatch card.");
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      message: emergencyStrings.api.sosSuccess,
      referenceId: finalReport.referenceId,
      safetyAdvice: finalReport.triage.immediateSafetyAdvice.slice(0, 3),
    },
  };
}

export async function POST(req: Request) {
  const limit = checkRateLimit(req, "/api/sos");
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: emergencyStrings.api.sosRateLimited },
      { status: 429, headers: { ...HEADERS, ...rateLimitHeaders(limit) } },
    );
  }
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { ok: false, error: emergencyStrings.api.requestRejected },
      { status: 403, headers: HEADERS },
    );
  }

  const body = await readJsonBody(req, 5_800_000);
  if (!body.ok) {
    return NextResponse.json({ ok: false, error: body.error }, { status: body.status, headers: HEADERS });
  }

  const parsed = sosSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: emergencyStrings.api.invalidSubmission,
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: HEADERS },
    );
  }
  const data = parsed.data;

  if (data.website && data.website.trim() !== "") {
    return NextResponse.json({ ok: true, message: emergencyStrings.api.sosSuccess }, { headers: HEADERS });
  }
  if (data.imageBase64 && data.imageBase64.split(",")[1].length > MAX_IMAGE_BASE64_LENGTH) {
    return NextResponse.json(
      { ok: false, error: emergencyStrings.api.imageUploadTooLarge },
      { status: 413, headers: HEADERS },
    );
  }
  if (data.imageUrl && !isSupabaseFaultImageUrl(data.imageUrl)) {
    return NextResponse.json(
      { ok: false, error: emergencyStrings.api.imageUrlInvalid },
      { status: 400, headers: HEADERS },
    );
  }

  cleanupIdempotencyCache();
  const requestId = data.requestId;
  if (requestId) {
    const existing = idempotencyCache.get(requestId);
    if (existing) {
      const outcome = await existing.promise;
      return NextResponse.json(
        { ...outcome.body, duplicate: true },
        { status: outcome.status, headers: HEADERS },
      );
    }
  }

  const promise = dispatchSos(data).catch((error: unknown) => {
    console.error("[SOS] Dispatch failed unexpectedly.", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return fail(502, emergencyStrings.telegram.dispatchUnavailable);
  });
  if (requestId) {
    const entry = { createdAt: Date.now(), promise, settled: false };
    idempotencyCache.set(requestId, entry);
    void promise.then((outcome) => {
      entry.settled = true;
      if (outcome.body.ok) entry.createdAt = Date.now();
      else if (idempotencyCache.get(requestId) === entry) idempotencyCache.delete(requestId);
    });
  }
  const outcome = await promise;
  return NextResponse.json(outcome.body, { status: outcome.status, headers: HEADERS });
}
