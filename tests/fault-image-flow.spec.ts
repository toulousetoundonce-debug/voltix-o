import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeFaultImageWithGroq } from "@/lib/ai/groq-vision";
import { isSupabaseFaultImageUrl, uploadFaultImage } from "@/lib/supabase-storage";
import { sendTelegramAlert, sendTelegramPhotoUrl } from "@/lib/telegram";

const imageUrl =
  "https://project.supabase.co/storage/v1/object/public/fault-images/faults/123e4567-e89b-12d3-a456-426614174000.webp";

describe("fault image flow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_BUCKET;
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_VISION_MODEL;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("accepts only public fault images from the configured Supabase bucket", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    expect(isSupabaseFaultImageUrl(imageUrl)).toBe(true);
    expect(isSupabaseFaultImageUrl("https://attacker.example/fault.webp")).toBe(false);
    expect(isSupabaseFaultImageUrl(`${imageUrl}?redirect=https://attacker.example`)).toBe(false);
  });

  it("compresses no data itself but enforces WebP and the 150 KiB upload boundary", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const url = await uploadFaultImage(new Blob(["webp-bytes"], { type: "image/webp" }));
    expect(url).toMatch(/^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/fault-images\/faults\/.+\.webp$/);
    await expect(
      uploadFaultImage(new Blob([new Uint8Array(150 * 1024 + 1)], { type: "image/webp" })),
    ).rejects.toThrow("150 كيلوبايت");
    await expect(uploadFaultImage(new Blob(["jpeg"], { type: "image/jpeg" }))).rejects.toThrow("WebP");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends an inline base64 image to Groq Vision without requiring Supabase", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
      const payload = JSON.parse(String(init?.body)) as {
        model: string;
        messages: Array<{ content: Array<{ image_url?: { url?: string } }> }>;
      };
      expect(payload.model).toBe("qwen/qwen3.8-27b");
      expect(payload.messages[1].content[1].image_url?.url).toBe("data:image/webp;base64,AAAA");
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                diagnosis: "احتمال ارتخاء في التوصيلة الظاهرة.",
                riskLevel: "متوسط",
                recommendation: "أوقف الاستخدام واترك الفحص لفني مؤهل.",
              }),
            },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzeFaultImageWithGroq({ image: "data:image/webp;base64,AAAA" })).resolves.toEqual({
      diagnosis: "احتمال ارتخاء في التوصيلة الظاهرة.",
      riskLevel: "متوسط",
      recommendation: "أوقف الاستخدام واترك الفحص لفني مؤهل.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds the WhatsApp inline action and delivers the public photo via Telegram", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    process.env.TELEGRAM_BOT_TOKEN = "123:test";
    process.env.TELEGRAM_CHAT_ID = "456";
    const sentBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body === "string") sentBodies.push(JSON.parse(init.body) as Record<string, unknown>);
      return Response.json({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTelegramAlert("بلاغ", { الهاتف: "+213551234567" }, undefined, "https://wa.me/213551234567"),
    ).resolves.toEqual({ ok: true });
    await expect(sendTelegramPhotoUrl(imageUrl, "صورة العطل")).resolves.toEqual({ ok: true });
    expect(sentBodies[0].reply_markup).toEqual({
      inline_keyboard: [[{ text: "مراسلة العميل عبر واتساب", url: "https://wa.me/213551234567" }]],
    });
    expect(sentBodies[1]).toMatchObject({ photo: imageUrl });
  });
});
