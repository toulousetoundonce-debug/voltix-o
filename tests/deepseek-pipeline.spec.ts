import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeWithDeepSeek } from "@/lib/ai/deepseek";
import { isDeepSeekEnabled } from "@/lib/ai/config";
import { POST as visionPost } from "@/app/api/vision-check/route";
import { POST as voicePost } from "@/app/api/voice-sos/route";
import { POST as sosPost } from "@/app/api/sos/route";
import { sendTelegramAnalysisReport } from "@/lib/telegram";

const report = {
  summary: "لوحة كهربائية تحتاج إلى فحص فني.",
  findings: ["لا يمكن تأكيد سبب العطل من الصورة وحدها."],
  recommended_actions: ["أبعد الأشخاص عن اللوحة ودع فنيًا مؤهلًا يفحصها."],
  required_tools: ["معدات قياس معزولة"],
  confidence: "medium",
};

const makeResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const makeRequest = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("optional server-side triage pipeline", () => {
  beforeEach(() => {
    vi.stubEnv("FEATURE_DEEPSEEK_PIPELINE", "1");
    vi.stubEnv("RATE_LIMIT_VOICE_PER_MINUTE", "100");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-deepseek-key");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-telegram-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "test-chat");
    vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "test-alert-chat");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("IMAGE_ANALYSIS_ENDPOINT", "https://images.example.test/analyze");
    vi.stubEnv("AUDIO_ANALYSIS_ENDPOINT", "https://audio.example.test/analyze");
    vi.stubEnv("SOS_WEBHOOK_URL", "https://example.com/test-hook");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("only enables when explicitly flagged and a server key is present", () => {
    expect(isDeepSeekEnabled()).toBe(true);
    vi.stubEnv("FEATURE_DEEPSEEK_PIPELINE", "0");
    expect(isDeepSeekEnabled()).toBe(false);
    vi.stubEnv("FEATURE_DEEPSEEK_PIPELINE", "1");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(isDeepSeekEnabled()).toBe(false);
  });

  it("validates and sanitizes structured model output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body));
        expect(payload.messages[1].content).not.toContain("أحمد");
        expect(payload.messages[1].content).not.toContain("0551234567");
        expect(payload.messages[1].content).toContain("[اسم محذوف]");
        expect(payload.messages[1].content).toContain("[رقم محذوف]");
        return makeResponse({ choices: [{ message: { content: JSON.stringify({
          ...report,
          summary: "ملخص <b>أولي</b> DeepSeek-Flash https://example.com 0551234567",
        }) } }] });
      }),
    );
    const result = await analyzeWithDeepSeek({ description: "اسمي أحمد ورقمي 0551234567 وعطل في اللوحة" });
    expect(result.summary).not.toMatch(/https?:|<b>|0551234567|deepseek/i);
    expect(result.findings).toHaveLength(1);
  });

  it("sends a compressed image as an inline data URL to Groq Vision and returns the analysis", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
      expect(init?.method).toBe("POST");
      const payload = JSON.parse(String(init?.body));
      expect(payload.model).toBe("qwen/qwen3.8-27b");
      expect(payload.messages[1].content[0].text).toContain("control_panel_fault");
      expect(payload.messages[1].content[1].image_url.url).toBe("data:image/png;base64,AAAA");
      return makeResponse({
        choices: [{ message: { content: JSON.stringify({
          diagnosis: "يظهر تلف محتمل في القاطع.",
          riskLevel: "خطر مرتفع",
          recommendation: "ابتعد عن اللوحة واتصل بفني مؤهل.",
        }) } }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await visionPost(
      makeRequest("http://localhost:3000/api/vision-check", {
        imageBase64: "data:image/png;base64,AAAA",
        emergencyType: "control_panel_fault",
        description: "فحص لوحة توزيع",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.diagnosis).toBe("يظهر تلف محتمل في القاطع.");
    expect(body.result.riskLevel).toBe("خطر مرتفع");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("analyzes SOS text without forwarding identity or location fields to the model", async () => {
    let modelRequest = "";
    let telegramMessage = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const target = String(url);
        if (target.includes("chat/completions")) {
          modelRequest = String(init?.body);
          return makeResponse({ choices: [{ message: { content: JSON.stringify(report) } }] });
        }
        if (target.includes("api.telegram.org")) {
          telegramMessage = JSON.parse(String(init?.body)).text;
          return makeResponse({ ok: true, result: {} });
        }
        if (target.includes("example.com/test-hook")) return makeResponse({ ok: true });
        throw new Error("Unexpected network target in test.");
      }),
    );
    const response = await sosPost(
      makeRequest("http://localhost:3000/api/sos", {
        fullName: "مستخدم اختبار",
        phone: "0551234567",
        description: "لوحة تصدر صوتاً غير معتاد",
        emergencyType: "control_panel_fault",
        location: { lat: 36.7, lng: 3.1, accuracy: 12 },
        website: "",
      }),
    );
    expect(response.status).toBe(200);
    const payload = JSON.parse(modelRequest);
    expect(modelRequest).not.toContain("مستخدم اختبار");
    expect(modelRequest).not.toContain("0551234567");
    expect(modelRequest).not.toContain("36.7");
    expect(JSON.stringify(payload.messages[1].content)).toContain("لوحة تصدر صوتاً");
    expect(telegramMessage).toContain(report.summary);
    expect(telegramMessage).toContain("الإجراءات الموصى بها");
  });

  it("falls back to manual review when image analysis fails without exposing the error", async () => {
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => makeResponse({ error: "unavailable" }, 503)));
    const response = await visionPost(
      makeRequest("http://localhost:3000/api/vision-check", {
        imageBase64: "data:image/png;base64,AAAA",
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("manual-review");
    expect(JSON.stringify(body)).not.toMatch(/deepseek|gemini|provider|model|unavailable/i);
    expect(logSpy).toHaveBeenCalledWith("[GROQ VISION] Provider rejected image request.", { status: 503 });
    expect(logSpy).toHaveBeenCalledWith("[VISION CHECK] Image analysis request failed.", { code: "http" });
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain("test-deepseek-key");
    logSpy.mockRestore();
  });

  it("returns the safe manual-review response when the image service rejects a request", async () => {
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => new Response("private provider rejection detail", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await visionPost(
      new Request("http://localhost:3000/api/vision-check", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-for": "203.0.113.78",
          "content-type": "application/json",
        },
        body: JSON.stringify({ imageBase64: "data:image/png;base64,AAAA" }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("manual-review");
    expect(JSON.stringify(body)).not.toContain("private provider rejection detail");
    expect(logSpy).toHaveBeenCalledWith("[GROQ VISION] Provider rejected image request.", { status: 400 });
    expect(logSpy).toHaveBeenCalledWith("[VISION CHECK] Image analysis request failed.", { code: "http" });
    expect(JSON.stringify(logSpy.mock.calls)).not.toMatch(/edgeone|deepseek|gemini|\bai\b/i);
    expect(fetchMock).toHaveBeenCalledOnce();
    logSpy.mockRestore();
  });

  it("transcribes audio with Groq and sends the structured report to Telegram", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("/audio/transcriptions")) {
        const form = init?.body as FormData;
        expect(form.get("model")).toBe("whisper-large-v3-turbo");
        expect((form.get("file") as File).name).toBe("voice-report.webm");
        return makeResponse({ text: "أسمع طقطقة قرب لوحة الكهرباء." });
      }
      if (target.includes("api.deepseek.com")) {
        return makeResponse({ choices: [{ message: { content: JSON.stringify(report) } }] });
      }
      if (target.includes("api.telegram.org")) {
        const telegramPayload = JSON.parse(String(init?.body));
        expect(telegramPayload.reply_markup.inline_keyboard[0][0].url).toBe(
          "https://wa.me/213551234567?text=" + encodeURIComponent("مرحباً، نتواصل معك بخصوص بلاغ العطل المرسل إلى Voltix Dynamics."),
        );
        return makeResponse({ ok: true, result: {} });
      }
      throw new Error("Unexpected network target in test.");
    });
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.set("audio", new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" }));
    form.set("emergencyType", "control_panel_fault");
    form.set("description", "صوت غير معتاد قرب اللوحة");
    form.set("phone", "0551234567");
    const response = await voicePost(
      new Request("http://localhost:3000/api/voice-sos", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
        body: form,
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.transcript).toBe("أسمع طقطقة قرب لوحة الكهرباء.");
    expect(body.analysis.summary).toBe(report.summary);
    expect(body.usedFallback).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses Groq triage when optional DeepSeek is disabled", async () => {
    vi.stubEnv("FEATURE_DEEPSEEK_PIPELINE", "0");
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("/audio/transcriptions")) return makeResponse({ text: "القاطع يفصل عند تشغيل المضخة." });
      if (target === "https://api.groq.com/openai/v1/chat/completions") {
        const payload = JSON.parse(String(init?.body));
        expect(payload.model).toBe("qwen/qwen3.8-27b");
        expect(payload.messages[1].content).toContain("القاطع يفصل");
        return makeResponse({ choices: [{ message: { content: JSON.stringify(report) } }] });
      }
      if (target.includes("api.telegram.org")) return makeResponse({ ok: true, result: {} });
      throw new Error("Unexpected network target in test.");
    });
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.set("audio", new File([new Uint8Array([1])], "voice.webm", { type: "audio/webm" }));
    const response = await voicePost(
      new Request("http://localhost:3000/api/voice-sos", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
        body: form,
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.usedFallback).toBe(false);
    expect(body.analysis.summary).toBe(report.summary);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("transcribes voice before triage and returns no provider metadata", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("/audio/transcriptions")) return makeResponse({ text: "يوجد دخان قرب اللوحة." });
      if (target.includes("chat/completions")) {
        const payload = JSON.parse(String(init?.body));
        expect(JSON.stringify(payload)).toContain("يوجد دخان قرب اللوحة.");
        return makeResponse({ choices: [{ message: { content: JSON.stringify(report) } }] });
      }
      if (target.includes("api.telegram.org")) return makeResponse({ ok: true, result: {} });
      throw new Error("Unexpected network target in test.");
    });
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.set("audio", new File([new Uint8Array([1, 2, 3])], "voice.webm", { type: "audio/webm" }));
    const request = new Request("http://localhost:3000/api/voice-sos", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
      body: form,
    });

    const response = await voicePost(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transcript).toBe("يوجد دخان قرب اللوحة.");
    expect(body.usedFallback).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/deepseek|gemini|provider|model/i);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("api.telegram.org"))).toHaveLength(1);
  });

  it("uses safe local voice guidance when structured analysis fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url);
        if (target.includes("/audio/transcriptions")) return makeResponse({ text: "يوجد دخان قرب اللوحة." });
        if (target.includes("chat/completions")) return makeResponse({ error: "unavailable" }, 503);
        if (target.includes("api.telegram.org")) return makeResponse({ ok: true, result: {} });
        throw new Error("Unexpected network target in test.");
      }),
    );
    const form = new FormData();
    form.set("audio", new File([new Uint8Array([1])], "voice.webm", { type: "audio/webm" }));
    const response = await voicePost(
      new Request("http://localhost:3000/api/voice-sos", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
        body: form,
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.usedFallback).toBe(true);
    expect(body.analysis.urgency).toBe("high");
  });

  it("returns a safe Arabic response when Groq transcription fails", async () => {
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => makeResponse({ error: "private upstream detail" }, 500)));
    const form = new FormData();
    form.set("audio", new File([new Uint8Array([1])], "voice.webm", { type: "audio/webm" }));
    const response = await voicePost(
      new Request("http://localhost:3000/api/voice-sos", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
        body: form,
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.error).toContain("تعذّر تفريغ التسجيل الصوتي");
    expect(JSON.stringify(body)).not.toContain("private upstream detail");
    expect(logSpy).toHaveBeenCalledWith("[VOICE SOS] Speech transcription failed.", { code: "provider_error" });
    logSpy.mockRestore();
  });

  it("keeps the voice response successful when Telegram delivery fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url);
        if (target.includes("/audio/transcriptions")) return makeResponse({ text: "عطل في لوحة الكهرباء." });
        if (target.includes("chat/completions")) {
          return makeResponse({ choices: [{ message: { content: JSON.stringify(report) } }] });
        }
        if (target.includes("api.telegram.org")) {
          return makeResponse({ ok: false, description: "private telegram error" }, 500);
        }
        throw new Error("Unexpected network target in test.");
      }),
    );
    const form = new FormData();
    form.set("audio", new File([new Uint8Array([1])], "voice.webm", { type: "audio/webm" }));
    const response = await voicePost(
      new Request("http://localhost:3000/api/voice-sos", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
        body: form,
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("private telegram error");
  });

  it("HTML-escapes and bounds the organized Telegram report", async () => {
    let sentText = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body));
        sentText = payload.text;
        return makeResponse({ ok: true, result: {} });
      }),
    );
    const result = await sendTelegramAnalysisReport({
      kind: "text",
      receivedAt: new Date().toISOString(),
      problem: "<script>alert('x')</script>",
      summary: "<img>&",
      findings: Array(5).fill("<b>finding</b>"),
      recommendedActions: Array(8).fill("<i>action</i>"),
      requiredTools: Array(8).fill("<tool>"),
      confidence: "medium",
    });
    expect(result.ok).toBe(true);
    expect(sentText.length).toBeLessThanOrEqual(3_800);
    expect(sentText).toContain("&lt;img&gt;&amp;");
    expect(sentText).not.toContain("<script>");
  });
});
