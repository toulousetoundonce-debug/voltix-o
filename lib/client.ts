// Tiny fetch helper for the browser-side forms.
import type { Estimate } from "./pricing";

export interface ApiResult {
  ok: boolean;
  message?: string;
  error?: string;
  referenceId?: string;
  safetyAdvice?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
  estimate?: Estimate;
  imageAttachmentError?: string;
}

export async function postJson(url: string, body: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as ApiResult | null;
    if (data && typeof data.ok === "boolean") return data;
    return { ok: false, error: "استجابة غير متوقعة من الخادم. حاول مرة أخرى." };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم. تحقق من اتصالك بالشبكة وحاول مجدداً." };
  }
}

/** Takes the first message of each field from a Zod flatten().fieldErrors object. */
export function firstFieldErrors(
  fieldErrors: Record<string, string[] | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fieldErrors) return out;
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages && messages[0]) out[key] = messages[0];
  }
  return out;
}
