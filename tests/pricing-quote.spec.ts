import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as quotePost } from "@/app/api/quote/route";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/quote", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function configure() {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test_token");
  vi.stubEnv("TELEGRAM_CHAT_ID", "456");
  vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "");
  vi.stubEnv("TELEGRAM_THREAD_ID", "");
  vi.stubEnv("QUOTE_WEBHOOK_URL", "");
  vi.stubEnv("RATE_LIMIT_QUOTE_PER_MINUTE", "100");
}

const validPayload = (requestId: string) => ({
  requestId,
  projectType: "smart_home",
  area: 120,
  units: 10,
  tier: "advanced",
  fullName: "مستخدم اختبار",
  phone: "0551234567",
  city: "الجزائر",
  estimate: { base: 1, min: 1, max: 1 },
  total: 1,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("pricing quote endpoint", () => {
  it("recomputes the estimate on the server and ignores client totals", async () => {
    configure();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, result: { message_id: 501 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const response = await quotePost(makeRequest(validPayload("1e00f6f7-3e42-4cc7-98d7-b5cc146c63c0")));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.estimate.expected).toBeGreaterThan(1);
    expect(result.estimate.min).toBeLessThanOrEqual(result.estimate.expected);
    expect(result.estimate.max).toBeGreaterThanOrEqual(result.estimate.expected);
    expect(result.referenceId).toMatch(/^EST-\d{6}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
  });

  it("deduplicates retries using the same requestId", async () => {
    configure();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, result: { message_id: 502 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);
    const requestId = "ef15abd6-ff5d-4c73-b9c8-57b5ebd1b14a";
    const first = await quotePost(makeRequest(validPayload(requestId)));
    const firstData = await first.json();
    const calls = fetchMock.mock.calls.length;
    const duplicate = await quotePost(makeRequest(validPayload(requestId)));
    const duplicateData = await duplicate.json();

    expect(duplicateData.duplicate).toBe(true);
    expect(duplicateData.referenceId).toBe(firstData.referenceId);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it("rejects malformed inputs before contacting Telegram", async () => {
    configure();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await quotePost(makeRequest({ projectType: "not-a-service" }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not report success when Telegram delivery fails", async () => {
    configure();
    vi.stubEnv("QUOTE_WEBHOOK_URL", "https://example.test/quote");
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return url.includes("api.telegram.org")
        ? new Response(JSON.stringify({ ok: false, description: "chat unavailable" }), { status: 400 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await quotePost(makeRequest(validPayload("55e40e22-a8db-4c27-933c-987a5a85cc06")));
    const result = await response.json();
    expect(response.status).toBe(502);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("تعذّر تسليم");
  });
});
