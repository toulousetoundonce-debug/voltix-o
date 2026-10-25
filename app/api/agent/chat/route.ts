import { NextResponse } from "next/server";
import { chatSchema } from "@/lib/schemas";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat-prompt";
import { checkRateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { isSameOrigin, readJsonBody } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };
const REQUEST_TIMEOUT_MS = 60_000;
const MODEL = process.env.DEEPSEEK_CHAT_MODEL || "deepseek-chat";
const ENDPOINT = "https://api.deepseek.com/chat/completions";

function fail(status: number, error: string, headers: Record<string, string> = {}) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { ...HEADERS, ...headers } },
  );
}

export async function POST(request: Request) {
  const limit = checkRateLimit(request, "/api/agent/chat");
  if (!limit.allowed) {
    return fail(429, "وصلت إلى حد الرسائل المؤقت. حاول بعد قليل.", rateLimitHeaders(limit));
  }
  if (!isSameOrigin(request)) {
    return fail(403, "طلب غير مسموح به.");
  }

  const body = await readJsonBody(request, 10_000);
  if (!body.ok) return fail(body.status, body.error);

  const parsed = chatSchema.safeParse(body.data);
  if (!parsed.success) {
    return fail(400, "تحقق من رسائل المحادثة.");
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey || apiKey.length < 16 || /\s/.test(apiKey)) {
    console.error("[AGENT] DEEPSEEK_API_KEY is missing or malformed; the request was not sent.");
    return fail(503, "خدمة المساعد غير مهيأة حالياً. يرجى المحاولة لاحقاً.");
  }

  const upstreamController = new AbortController();
  const timeout = setTimeout(() => upstreamController.abort(), REQUEST_TIMEOUT_MS);
  let upstream: Response;

  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, ...parsed.data.messages],
        stream: true,
      }),
      signal: upstreamController.signal,
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timeout);
    if (upstreamController.signal.aborted) {
      return fail(504, "استغرق الاتصال بالمساعد وقتاً أطول من المتوقع.");
    }
    console.error("[AGENT] DeepSeek request failed.", error);
    return fail(502, "تعذّر الاتصال بالمساعد حالياً. حاول مجدداً.");
  }

  if (!upstream.ok) {
    clearTimeout(timeout);
    console.error(`[AGENT] DeepSeek returned HTTP ${upstream.status}.`);
    if (upstream.status === 401 || upstream.status === 403) {
      return fail(503, "تعذّر التحقق من إعداد خدمة المساعد.");
    }
    if (upstream.status === 429) {
      return fail(429, "خدمة المساعد مشغولة مؤقتاً. حاول بعد قليل.", {
        ...(upstream.headers.get("retry-after")
          ? { "Retry-After": upstream.headers.get("retry-after")! }
          : {}),
      });
    }
    if (upstream.status === 404) {
      return fail(503, "نموذج المساعد المحدد غير متاح. تحقق من DEEPSEEK_CHAT_MODEL.");
    }
    return fail(502, "تعذّر الحصول على رد من المساعد حالياً. حاول مجدداً.");
  }

  if (!upstream.body) {
    clearTimeout(timeout);
    console.error("[AGENT] DeepSeek returned an empty response stream.");
    return fail(502, "وصل رد فارغ من المساعد. حاول مجدداً.");
  }

  const reader = upstream.body.getReader();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          clearTimeout(timeout);
          streamController.close();
          return;
        }
        streamController.enqueue(chunk.value);
      } catch (error) {
        clearTimeout(timeout);
        console.error("[AGENT] DeepSeek response stream failed.", error);
        const message = upstreamController.signal.aborted
          ? "انتهت مهلة الرد. حاول مجدداً."
          : "انقطع الاتصال بالمساعد. حاول مجدداً.";
        streamController.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`),
        );
        streamController.close();
      }
    },
    async cancel(reason) {
      clearTimeout(timeout);
      upstreamController.abort();
      await reader.cancel(reason);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
