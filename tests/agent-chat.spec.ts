import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as agentChatPost } from "@/app/api/agent/chat/route";

const makeRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/agent/chat", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-for": "192.0.2.42",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe("POST /api/agent/chat", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("adds the server prompt, calls the official DeepSeek API, and forwards its stream", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "server-only-test-key-123456");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.deepseek.com/chat/completions");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer server-only-test-key-123456",
        "Content-Type": "application/json",
      });
      const payload = JSON.parse(String(init?.body));
      expect(payload.stream).toBe(true);
      expect(payload.model).toBe("deepseek-chat");
      expect(payload.messages[0]).toMatchObject({ role: "system" });
      expect(payload.messages[0].content).toContain("Voltix Dynamics");
      expect(payload.messages[1]).toEqual({ role: "user", content: "ما خدماتكم؟" });
      return new Response('data: {"choices":[{"delta":{"content":"أهلاً"}}]}\n\n', {
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await agentChatPost(
      makeRequest({ messages: [{ role: "user", content: "ما خدماتكم؟" }] }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(await response.text()).toContain('"content":"أهلاً"');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails without sending a request when the server API key is missing", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await agentChatPost(
      makeRequest({ messages: [{ role: "user", content: "اختبار" }] }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests before contacting the provider", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "server-only-test-key-123456");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await agentChatPost(
      makeRequest(
        { messages: [{ role: "user", content: "اختبار" }] },
        { origin: "https://attacker.example" },
      ),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
