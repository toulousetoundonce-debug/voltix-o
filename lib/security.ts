// Server-side security helpers used by the API routes.

/** Removes dangerous characters (< > `), control/bidi-override characters and collapses whitespace. */
export function sanitize(input: string, maxLength = 200): string {
  return input
    .normalize("NFKC") // also folds full-width "＜" into "<" so it can be stripped below
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/[<>`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Rate limiting (fixed window, per key). In-memory => per server instance.
// For multi-instance / serverless deployments, swap the Map for Redis / Upstash.
// ---------------------------------------------------------------------------
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * Best-effort client IP. x-forwarded-for is only trustworthy behind a reverse proxy / CDN
 * that overwrites it (Vercel, Cloudflare, Nginx...). Configure your proxy accordingly.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Blocks cross-site browser POSTs. Requests without an Origin header (curl etc.) are still rate-limited. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

export async function readJsonBody(req: Request, maxBytes = 10_000): Promise<JsonBodyResult> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: "حجم الطلب كبير جداً." };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, status: 400, error: "تعذّر قراءة الطلب." };
  }
  if (text.length > maxBytes) {
    return { ok: false, status: 413, error: "حجم الطلب كبير جداً." };
  }
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, error: "صيغة الطلب غير صالحة." };
  }
}

// ---------------------------------------------------------------------------
// Webhook delivery
// ---------------------------------------------------------------------------
export type DeliveryStatus = "sent" | "dev_logged" | "unconfigured" | "failed";

/**
 * Sends the payload as JSON to the webhook URL (read from a server-only env var).
 * - No URL in development  -> payload is printed to the server console ("dev_logged").
 * - No URL in production   -> "unconfigured": the caller must NOT claim success, otherwise
 *                             an emergency request would be silently dropped.
 */
export async function deliver(
  url: string | undefined,
  payload: Record<string, unknown>,
): Promise<DeliveryStatus> {
  const isProd = process.env.NODE_ENV === "production";

  if (!url || url.trim() === "") {
    if (!isProd) {
      console.info("[webhook not configured - dev log]", JSON.stringify(payload, null, 2));
      return "dev_logged";
    }
    return "unconfigured";
  }

  const target = url.trim();
  if (!/^https:\/\//i.test(target) && !(!isProd && /^http:\/\/(localhost|127\.0\.0\.1)/i.test(target))) {
    return "failed";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}
