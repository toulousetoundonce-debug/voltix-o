import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { computeEstimate, PROJECTS, TIERS } from "@/lib/pricing";
import { normalizeDigits, normalizePhoneNumber, isValidPhone } from "@/lib/validation";
import { chatSchema, quoteSchema, sosSchema, callbackSchema } from "@/lib/schemas";
import { createMapsCoordinatesHref } from "@/lib/site";
import {
  GPS_TARGET_ACCURACY_METERS,
  isFreshAccurateGpsFix,
} from "@/lib/geolocation";
import { POST as chatPost } from "@/app/api/chat/route";
import { POST as quotePost } from "@/app/api/quote/route";
import { POST as sosPost } from "@/app/api/sos/route";
import { POST as callbackPost } from "@/app/api/callback-request/route";

const makeRequest = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("lib/pricing", () => {
  it("computes the current pricing formula without rounding surprises", () => {
    const estimate = computeEstimate({ projectType: "smart_home", area: 120, units: 12, tier: "advanced" });
    const project = PROJECTS.smart_home;
    const tier = TIERS.advanced;
    const effectiveArea = Math.min(120, 500) + Math.max(0, 120 - 500) * 0.75;
    const raw = (project.fixed + project.perM2 * effectiveArea + project.perUnit * 12) * tier.multiplier;
    expect(estimate.base).toBe(Math.round(raw / 5000) * 5000);
    expect(estimate.min).toBe(Math.round((raw * 0.9) / 5000) * 5000);
    expect(estimate.max).toBe(Math.round((raw * 1.2) / 5000) * 5000);
  });
});

describe("lib/validation", () => {
  it("converts Arabic-Indic and Persian digits to Latin digits", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("normalizes Algerian local and international phone numbers as currently implemented", () => {
    expect(normalizePhoneNumber("0551234567")).toBe("+213551234567");
    expect(normalizePhoneNumber("06 73 12 34 56")).toBe("+213673123456");
    expect(normalizePhoneNumber("+213 5 12 34 56 78")).toBe("+213512345678");
    expect(normalizePhoneNumber("00213-561-234-567")).toBe("+213561234567");
    expect(normalizePhoneNumber("0712345678")).toBe("+213712345678");
  });

  it("accepts and rejects phone values using the current validation rules", () => {
    const validNumbers = ["0551234567", "+213551234567", "00213-561-234-567", "06-73-12-34-56"];
    for (const value of validNumbers) {
      expect(isValidPhone(value)).toBe(true);
    }
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("+111111111111111111")).toBe(false);
  });
});

describe("lib/site map links", () => {
  it("opens Google Maps at the exact GPS coordinates with a close zoom", () => {
    expect(createMapsCoordinatesHref(36.752887, 3.042048)).toBe(
      "https://www.google.com/maps?q=36.752887,3.042048&z=20",
    );
  });
});

describe("lib/geolocation", () => {
  it("only treats recent, sufficiently accurate fixes as ready for early completion", () => {
    const now = 1_798_000_000_000;
    expect(isFreshAccurateGpsFix(GPS_TARGET_ACCURACY_METERS, now - 1_000, now)).toBe(true);
    expect(isFreshAccurateGpsFix(GPS_TARGET_ACCURACY_METERS + 1, now - 1_000, now)).toBe(false);
    expect(isFreshAccurateGpsFix(5, now - 5_001, now)).toBe(false);
    expect(isFreshAccurateGpsFix(5, now + 1, now)).toBe(false);
  });
});

describe("lib/schemas", () => {
  it("accepts valid SOS payloads with normalized Algerian numbers and optional fields", () => {
    const parsed = sosSchema.parse({
      fullName: "أحمد",
      phone: "0551234567",
      description: "",
      aiDiagnosis: "",
      voiceTranscript: "",
      imageBase64: undefined,
      emergencyType: "security_system_down",
      location: { lat: 36.7, lng: 3.1, accuracy: 18 },
      website: "",
    });

    expect(parsed.phone).toBe("+213551234567");
    expect(parsed.description).toBeUndefined();
    expect(parsed.location).toEqual({ lat: 36.7, lng: 3.1, accuracy: 18 });
    expect(sosSchema.parse({
      phone: "0551234567",
      emergencyType: "security_system_down",
    }).fullName).toBeUndefined();
  });

  it("rejects invalid final chat turns and malformed quote payloads", () => {
    expect(() => chatSchema.parse({ messages: [{ role: "assistant", content: "مرحبا" }] })).toThrow();
    expect(() => quoteSchema.parse({
      projectType: "smart_home",
      area: "bad",
      units: 1,
      tier: "advanced",
      fullName: "أحمد",
      phone: "0551234567",
      city: "الجزائر",
      website: "",
    })).toThrow();
  });

  it("accepts valid callback requests and preserves the current sanitizer behavior", () => {
    const parsed = callbackSchema.parse({ phone: "00213-561-234-567" });
    expect(parsed.phone).toBe("+213561234567");
  });
});

describe("route contracts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.includes("api.telegram.org")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ ok: true, result: { message_id: 42 } }),
        } as Response;
      }
      if (target.includes("webhook")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ ok: true }),
        } as Response;
      }
      if (target.includes("api.groq.com")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ output_text: "هذا الرد يثبت أن الاستجابة كانت ناجحة." }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ ok: true }),
      } as Response;
    }));
    process.env.QUOTE_WEBHOOK_URL = "https://example.com/webhook";
    process.env.SOS_WEBHOOK_URL = "https://example.com/sos-webhook";
    process.env.GROQ_API_KEY = "1234567890123456789012345678901234567890";
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    process.env.TELEGRAM_CHAT_ID = "123456";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.QUOTE_WEBHOOK_URL;
    delete process.env.SOS_WEBHOOK_URL;
    delete process.env.GROQ_API_KEY;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("returns the current valid chat response shape", async () => {
    const response = await chatPost(makeRequest("http://localhost:3000/api/chat", {
      messages: [{ role: "user", content: "ما هو أفضل جهد للجهاز؟" }],
    }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(typeof json.message).toBe("string");
  });

  it("returns the current valid quote response shape", async () => {
    const response = await quotePost(makeRequest("http://localhost:3000/api/quote", {
      projectType: "smart_home",
      area: 120,
      units: 10,
      tier: "advanced",
      fullName: "مستخدم اختبار",
      phone: "0551234567",
      city: "الجزائر",
      website: "",
    }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.estimate).toHaveProperty("base");
    expect(json.estimate).toHaveProperty("min");
    expect(json.estimate).toHaveProperty("max");
  });

  it("returns the current valid SOS response shape and keeps the optional image error field", async () => {
    const response = await sosPost(makeRequest("http://localhost:3000/api/sos", {
      fullName: "مستخدم اختبار",
      phone: "0751234567",
      description: "لوحة تعمل بشكل غير منتظم",
      emergencyType: "control_panel_fault",
      location: { lat: 36.7, lng: 3.1, accuracy: 12 },
      website: "",
    }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(typeof json.message).toBe("string");
  });

  it("returns the current invalid-payload error shape for malformed request bodies", async () => {
    const response = await quotePost(makeRequest("http://localhost:3000/api/quote", { no: "valid shape" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("تحقق من البيانات المدخلة.");
    expect(json.fieldErrors).toBeTruthy();
  });

  it("returns the current callback response shape", async () => {
    const response = await callbackPost(makeRequest("http://localhost:3000/api/callback-request", { phone: "0551234567" }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(typeof json.message).toBe("string");
  });
});
