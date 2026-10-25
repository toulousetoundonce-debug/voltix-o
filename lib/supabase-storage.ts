const DEFAULT_BUCKET = "fault-images";
const MAX_IMAGE_BYTES = 150 * 1024;

export interface SupabaseImageConfig {
  url: URL;
  anonKey: string;
  bucket: string;
}

export function getSupabaseImageConfig(): SupabaseImageConfig | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
      return null;
    }
    return {
      url,
      anonKey,
      bucket: process.env.NEXT_PUBLIC_SUPABASE_BUCKET?.trim() || DEFAULT_BUCKET,
    };
  } catch {
    return null;
  }
}

export function isSupabaseFaultImageUrl(value: string): boolean {
  const config = getSupabaseImageConfig();
  if (!config) return false;

  try {
    const imageUrl = new URL(value);
    const bucket = config.bucket.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
      imageUrl.protocol === "https:" &&
      imageUrl.origin === config.url.origin &&
      imageUrl.search === "" &&
      imageUrl.hash === "" &&
      new RegExp(`^/storage/v1/object/public/${bucket}/faults/[0-9a-f-]{36}\\.webp$`, "i").test(
        imageUrl.pathname,
      )
    );
  } catch {
    return false;
  }
}

export async function uploadFaultImage(image: Blob): Promise<string | null> {
  const config = getSupabaseImageConfig();
  if (!config) return null;
  if (image.type !== "image/webp" || image.size > MAX_IMAGE_BYTES) {
    throw new Error("يجب أن تكون الصورة WebP وألا يتجاوز حجمها 150 كيلوبايت.");
  }

  const path = `faults/${crypto.randomUUID()}.webp`;
  const endpoint = new URL(
    `/storage/v1/object/${encodeURIComponent(config.bucket)}/${path}`,
    config.url,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.anonKey}`,
        apikey: config.anonKey,
        "Content-Type": "image/webp",
        "x-upsert": "false",
      },
      body: image,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("تعذّر رفع الصورة إلى التخزين الآمن. تحقق من إعدادات Supabase ثم أعد المحاولة.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("تعذّر رفع")) throw error;
    throw new Error(
      controller.signal.aborted
        ? "انتهت مهلة رفع الصورة إلى Supabase."
        : "تعذّر الاتصال بتخزين Supabase. تحقق من الإنترنت ثم أعد المحاولة.",
    );
  } finally {
    clearTimeout(timeout);
  }
  return new URL(
    `/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${path}`,
    config.url,
  ).toString();
}
