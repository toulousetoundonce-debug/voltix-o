import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";
import { POST as visionPost } from "@/app/api/vision-check/route";

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { headers });
}

describe("per-IP per-route rate limiting", () => {
  it("allows requests under the configured limit and reports remaining capacity", () => {
    const result = checkRateLimit(request("/api/test", { "x-forwarded-for": "192.0.2.1" }), "/test-under", 3);
    expect(result).toEqual({ allowed: true, remaining: 2, retryAfter: 0 });
    expect(rateLimitHeaders(result)).toEqual({ "X-RateLimit-Remaining": "2" });
  });

  it("allows the request at the limit and rejects the next request with retry headers", () => {
    const req = request("/api/test", { "x-forwarded-for": "192.0.2.2" });
    expect(checkRateLimit(req, "/test-boundary", 2).allowed).toBe(true);
    const atLimit = checkRateLimit(req, "/test-boundary", 2);
    expect(atLimit).toEqual({ allowed: true, remaining: 0, retryAfter: 0 });
    const overLimit = checkRateLimit(req, "/test-boundary", 2);
    expect(overLimit.allowed).toBe(false);
    expect(overLimit.remaining).toBe(0);
    expect(overLimit.retryAfter).toBeGreaterThan(0);
    expect(rateLimitHeaders(overLimit)).toEqual({
      "X-RateLimit-Remaining": "0",
      "Retry-After": String(overLimit.retryAfter),
    });
  });

  it("uses x-real-ip when x-forwarded-for is missing and unknown when both are absent", () => {
    expect(getClientIp(request("/api/test", { "x-real-ip": "192.0.2.3" }))).toBe("192.0.2.3");
    expect(getClientIp(request("/api/test"))).toBe("unknown");
    const missingIp = request("/api/test");
    expect(checkRateLimit(missingIp, "/test-unknown-ip", 1).allowed).toBe(true);
    expect(checkRateLimit(missingIp, "/test-unknown-ip", 1).allowed).toBe(false);
  });

  it("keeps limits separate by route for the same IP", () => {
    const req = request("/api/test", { "x-forwarded-for": "192.0.2.4" });
    expect(checkRateLimit(req, "/test-route-a", 1).allowed).toBe(true);
    expect(checkRateLimit(req, "/test-route-b", 1).allowed).toBe(true);
    expect(checkRateLimit(req, "/test-route-a", 1).allowed).toBe(false);
  });

  it("returns 429 with rate headers after five malformed vision requests", async () => {
    vi.stubEnv("RATE_LIMIT_VISION_PER_MINUTE", "5");
    const headers = {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-for": "192.0.2.5",
      "content-type": "application/json",
    };
    try {
      for (let index = 0; index < 5; index += 1) {
        const response = await visionPost(
          new Request("http://localhost:3000/api/vision-check", {
            method: "POST",
            headers,
            body: "{}",
          }),
        );
        expect(response.status).toBe(400);
      }
      const limited = await visionPost(
        new Request("http://localhost:3000/api/vision-check", {
          method: "POST",
          headers,
          body: "{}",
        }),
      );
      expect(limited.status).toBe(429);
      expect(limited.headers.get("Retry-After")).toMatch(/^\d+$/);
      expect(limited.headers.get("X-RateLimit-Remaining")).toBe("0");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
