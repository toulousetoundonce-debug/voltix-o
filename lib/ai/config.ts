export const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL?.trim().replace(/\/+$/, "") || "https://api.deepseek.com";
export const DEEPSEEK_VISION_MODEL =
  process.env.DEEPSEEK_VISION_MODEL?.trim() || "deepseek-flash";
export const DEEPSEEK_TIMEOUT_MS = 10_000;
export const GROQ_STT_MODEL =
  process.env.GROQ_STT_MODEL?.trim() || "whisper-large-v3-turbo";

export function isDeepSeekEnabled(): boolean {
  return process.env.FEATURE_DEEPSEEK_PIPELINE === "1" && Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}
