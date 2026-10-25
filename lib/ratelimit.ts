interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;
const buckets = new Map<string, RateLimitBucket>();

const LIMITS: Record<string, { env: string; defaultLimit: number }> = {
  "/api/vision-check": { env: "RATE_LIMIT_VISION_PER_MINUTE", defaultLimit: 5 },
  "/api/voice-sos": { env: "RATE_LIMIT_VOICE_PER_MINUTE", defaultLimit: 5 },
  "/api/sos": { env: "RATE_LIMIT_SOS_PER_MINUTE", defaultLimit: 8 },
  "/api/chat": { env: "RATE_LIMIT_CHAT_PER_MINUTE", defaultLimit: 20 },
  "/api/agent/chat": { env: "RATE_LIMIT_AGENT_CHAT_PER_MINUTE", defaultLimit: 10 },
  "/api/quote": { env: "RATE_LIMIT_QUOTE_PER_MINUTE", defaultLimit: 10 },
  "/api/callback-request": { env: "RATE_LIMIT_CALLBACK_PER_MINUTE", defaultLimit: 10 },
};

function configuredLimit(path: string): number {
  const configuration = LIMITS[path];
  if (!configuration) return 10;
  const configured = Number(process.env[configuration.env]);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : configuration.defaultLimit;
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function evictOldest(): void {
  while (buckets.size > MAX_ENTRIES) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) return;
    buckets.delete(oldest);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const forwardedIp = forwarded?.split(",")[0]?.trim();
  if (forwardedIp) return forwardedIp;
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Temporary per-instance limiter. Netlify can route requests across instances,
 * so production-scale enforcement must move to shared storage such as Upstash Redis.
 */
export function checkRateLimit(
  request: Request,
  path: string,
  limit = configuredLimit(path),
): RateLimitResult {
  const now = Date.now();
  const key = `${getClientIp(request)}:${path}`;
  const current = buckets.get(key);

  if (current && current.resetAt > now) {
    buckets.delete(key);
    buckets.set(key, current);
    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }
    current.count += 1;
    return { allowed: true, remaining: Math.max(0, limit - current.count), retryAfter: 0 };
  }

  if (current) buckets.delete(key);
  evictExpired(now);
  buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  evictOldest();
  return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfter) }),
  };
}
