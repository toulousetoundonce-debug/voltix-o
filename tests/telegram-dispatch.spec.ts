import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as sosPost } from "@/app/api/sos/route";
import { createEmergencyReport } from "@/lib/emergency-report";
import {
  sendTelegramEmergencyCard,
  sendTelegramEmergencyPhoto,
} from "@/lib/telegram";

const report = createEmergencyReport({
  createdAt: new Date("2026-10-26T19:41:00.000Z"),
  phone: "0551234567",
  description: "القاطع يصدر صوتاً بسيطاً.",
  emergencyType: "control_panel_fault",
  hasPhoto: false,
});

const telegramResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function configureTelegram() {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test_token");
  vi.stubEnv("TELEGRAM_CHAT_ID", "456");
  vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "");
  vi.stubEnv("TELEGRAM_THREAD_ID", "12");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Telegram dispatch delivery", () => {
  it("retries 429 using retry_after and includes safe card delivery options", async () => {
    configureTelegram();
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      if (bodies.length === 1) {
        return telegramResponse({ ok: false, parameters: { retry_after: 0 } }, 429);
      }
      return telegramResponse({ ok: true, result: { message_id: 81 } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTelegramEmergencyCard(report);
    expect(result).toMatchObject({ ok: true, messageId: 81 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodies[1]).toMatchObject({
      parse_mode: "HTML",
      message_thread_id: 12,
      disable_notification: true,
      link_preview_options: { is_disabled: true },
    });
  });

  it("retries Telegram 5xx responses up to three attempts", async () => {
    configureTelegram();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(telegramResponse({ ok: false }, 503))
      .mockResolvedValueOnce(telegramResponse({ ok: false }, 502))
      .mockResolvedValueOnce(telegramResponse({ ok: true, result: { message_id: 82 } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegramEmergencyCard(report)).resolves.toMatchObject({ ok: true, messageId: 82 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a Telegram HTML parse error once with plain text", async () => {
    configureTelegram();
    const bodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      return bodies.length === 1
        ? telegramResponse({ ok: false, description: "Bad Request: can't parse entities" }, 400)
        : telegramResponse({ ok: true, result: { message_id: 83 } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendTelegramEmergencyCard(report)).resolves.toMatchObject({
      ok: true,
      messageId: 83,
      plainTextFallback: true,
    });
    expect(bodies[0].parse_mode).toBe("HTML");
    expect(bodies[1].parse_mode).toBeUndefined();
    expect(bodies[1].reply_markup).toEqual(bodies[0].reply_markup);
  });

  it("uses sendDocument for an image with dimensions outside Telegram photo limits", async () => {
    configureTelegram();
    let requestMethod = "";
    const captured: { form?: FormData } = {};
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requestMethod = new URL(String(url)).pathname.split("/").at(-1) ?? "";
      if (init?.body instanceof FormData) captured.form = init.body;
      return telegramResponse({ ok: true, result: { message_id: 84 } });
    }));
    const png = new Uint8Array(24);
    png[18] = 0x27;
    png[19] = 0x10;
    png[23] = 1;
    const source = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;

    await expect(sendTelegramEmergencyPhoto(source, report, 81)).resolves.toMatchObject({ ok: true });
    expect(requestMethod).toBe("sendDocument");
    expect(captured.form?.get("document")).toBeInstanceOf(Blob);
    expect(captured.form?.get("reply_parameters")).toBe(
      JSON.stringify({ message_id: 81, allow_sending_without_reply: true }),
    );
  });

  it("keeps the report delivered if photo upload fails and deduplicates requestId retries", async () => {
    configureTelegram();
    vi.stubEnv("FEATURE_DEEPSEEK_PIPELINE", "0");
    vi.stubEnv("RATE_LIMIT_SOS_PER_MINUTE", "100");
    vi.stubEnv("SOS_WEBHOOK_URL", "");
    const calls: Array<{ method: string; body: FormData | Record<string, unknown> }> = [];
    let photoAttempts = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const method = new URL(String(url)).pathname.split("/").at(-1) ?? "";
      if (method === "sendPhoto") {
        photoAttempts += 1;
        calls.push({ method, body: init?.body as FormData });
        return telegramResponse({ ok: false, description: "temporary" }, 503);
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ method, body });
      return telegramResponse({ ok: true, result: { message_id: method === "sendMessage" ? 91 : 92 } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const png = new Uint8Array(24);
    png[19] = 1;
    png[23] = 1;
    const requestId = "ce8151e7-8f58-455d-9dd2-cfdb14411722";
    const body = {
      phone: "0551234567",
      description: "لوحة تصدر صوتاً غير معتاد.",
      emergencyType: "control_panel_fault",
      imageBase64: `data:image/png;base64,${Buffer.from(png).toString("base64")}`,
      requestId,
    };
    const makeRequest = () =>
      new Request("http://localhost:3000/api/sos", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
        body: JSON.stringify(body),
      });

    const firstResponse = await sosPost(makeRequest());
    const first = await firstResponse.json();
    expect(firstResponse.status).toBe(200);
    expect(first.ok).toBe(true);
    expect(first.referenceId).toMatch(/^VX-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(first.safetyAdvice).toHaveLength(1);
    expect(photoAttempts).toBe(3);
    expect(calls.some((call) => call.method === "sendMessage" && JSON.stringify(call.body).includes("تعذر رفع الصورة"))).toBe(true);

    const countAfterFirstDelivery = fetchMock.mock.calls.length;
    const duplicateResponse = await sosPost(makeRequest());
    const duplicate = await duplicateResponse.json();
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.referenceId).toBe(first.referenceId);
    expect(fetchMock).toHaveBeenCalledTimes(countAfterFirstDelivery);
  });

  it("returns a failure when the dispatch card cannot be delivered", async () => {
    configureTelegram();
    vi.stubEnv("FEATURE_DEEPSEEK_PIPELINE", "0");
    vi.stubEnv("RATE_LIMIT_SOS_PER_MINUTE", "100");
    vi.stubGlobal("fetch", vi.fn(async () => telegramResponse({ ok: false }, 503)));

    const response = await sosPost(
      new Request("http://localhost:3000/api/sos", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "x-forwarded-host": "localhost:3000" },
        body: JSON.stringify({
          phone: "0551234567",
          description: "لوحة كهربائية لا تعمل.",
          emergencyType: "control_panel_fault",
          requestId: "1a4e6ff2-15e4-4ed4-9b44-d9a74e62cc3a",
        }),
      }),
    );
    expect(response.status).toBe(502);
    expect((await response.json()).ok).toBe(false);
  });
});
