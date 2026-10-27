import { Buffer } from "node:buffer";
import { z } from "zod";
import { isSupabaseFaultImageUrl } from "@/lib/supabase-storage";
import { createMapsCoordinatesHref } from "@/lib/site";
import { emergencyStrings } from "@/lib/emergency-strings";
import type { EmergencyReport } from "@/lib/emergency-report";
import {
  createEmergencyKeyboard,
  escapeTelegramHtml,
  formatEmergencyCard,
  formatEmergencyCardPlainText,
  formatEmergencyPhotoCaption,
  formatPhotoUploadFailure,
} from "@/lib/telegram-format";

interface GpsCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface TelegramDeliveryResult {
  ok: boolean;
  reason?: string;
  messageId?: number;
  plainTextFallback?: boolean;
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  parameters?: { retry_after?: number };
  result?: unknown;
}

interface TelegramChat {
  id: number | string;
  type: string;
}

const REQUEST_TIMEOUT_MS = 8_000;
const ANALYSIS_TIMEOUT_MS = 2_500;
const TELEGRAM_MESSAGE_LIMIT = 3_800;
const MAX_TELEGRAM_RETRIES = 3;
const MAX_TELEGRAM_FILE_BYTES = 50 * 1024 * 1024;
const TELEGRAM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
let discoveredChatId: string | null = null;

const telegramEnvironmentSchema = z.object({
  token: z.string().regex(/^\d{3,}:[A-Za-z0-9_-]{3,}$/u).optional(),
  fallbackToken: z.string().regex(/^\d{3,}:[A-Za-z0-9_-]{3,}$/u).optional(),
  legacyToken: z.string().regex(/^\d{3,}:[A-Za-z0-9_-]{3,}$/u).optional(),
  chatId: z.string().regex(/^(?:-?\d+|@[A-Za-z0-9_]{5,})$/u).optional(),
  alertChatId: z.string().regex(/^(?:-?\d+|@[A-Za-z0-9_]{5,})$/u).optional(),
  threadId: z
    .string()
    .regex(/^[1-9]\d{0,14}$/u)
    .transform(Number)
    .pipe(z.number().int().positive().safe())
    .optional(),
});

interface TelegramEnvironment {
  token: string;
  chatId?: string;
  alertChatId?: string;
  threadId?: number;
}

const telegramResponseSchema = z.object({
  ok: z.boolean().optional(),
  description: z.string().max(1_000).optional(),
  parameters: z.object({ retry_after: z.number().int().nonnegative().optional() }).optional(),
  result: z.unknown().optional(),
});

function getTelegramEnvironment(): TelegramEnvironment | null {
  const parsed = telegramEnvironmentSchema.safeParse({
    token: process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined,
    fallbackToken: process.env.BOT_TOKEN?.trim() || undefined,
    legacyToken: process.env.TELEGRAM_TOKEN?.trim() || undefined,
    chatId: process.env.TELEGRAM_CHAT_ID?.trim() || undefined,
    alertChatId: process.env.TELEGRAM_ALERT_CHAT_ID?.trim() || undefined,
    threadId: process.env.TELEGRAM_THREAD_ID?.trim() || undefined,
  });
  if (!parsed.success) {
    console.error("[TELEGRAM] Invalid notification environment configuration.", {
      fields: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return null;
  }
  const env = parsed.data;
  const token = env.token || env.fallbackToken || env.legacyToken;
  if (!token) return null;
  return {
    token,
    ...(env.chatId ? { chatId: env.chatId } : {}),
    ...(env.alertChatId ? { alertChatId: env.alertChatId } : {}),
    ...(env.threadId ? { threadId: env.threadId } : {}),
  };
}

export interface TelegramAnalysisReport {
  kind: "image" | "voice" | "text";
  receivedAt: string;
  problem: string;
  summary: string;
  findings: string[];
  recommendedActions: string[];
  requiredTools: string[];
  confidence?: "low" | "medium" | "high";
}

function getBotToken(): string {
  return getTelegramEnvironment()?.token ?? "";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function escapeHtmlWithinBudget(value: string, budget: number): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  let escaped = "";
  for (const character of value) {
    const entity = entities[character] ?? character;
    if (escaped.length + entity.length > budget) break;
    escaped += entity;
  }
  return escaped;
}

function detailText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, 1_500);
  }
  if (value === null || value === undefined) return "";
  return JSON.stringify(value).slice(0, 1_500);
}

async function telegramRequest(
  token: string,
  method: "sendMessage" | "sendPhoto" | "sendDocument" | "editMessageText" | "getUpdates",
  body?: BodyInit,
  json = true,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<{ response: Response; data: TelegramApiResponse }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: method === "getUpdates" ? "GET" : "POST",
      ...(body ? { body } : {}),
      ...(json ? { headers: { "Content-Type": "application/json" } } : {}),
      signal: controller.signal,
      cache: "no-store",
    });
    const bodyData: unknown = await response.json().catch(() => ({}));
    const parsed = telegramResponseSchema.safeParse(bodyData);
    return { response, data: parsed.success ? parsed.data : {} };
  } finally {
    clearTimeout(timeout);
  }
}

function retryDelay(data: TelegramApiResponse, attempt: number): number {
  if (data.parameters?.retry_after !== undefined) return data.parameters.retry_after * 1_000;
  return Math.min(1_500, 300 * 2 ** attempt);
}

function isRetryableResponse(response: Response): boolean {
  return response.status === 429 || response.status >= 500;
}

async function telegramRequestWithRetry(
  token: string,
  method: "sendMessage" | "sendPhoto" | "sendDocument" | "editMessageText" | "getUpdates",
  body?: BodyInit,
  json = true,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<{ response: Response; data: TelegramApiResponse }> {
  let latest: { response: Response; data: TelegramApiResponse } | null = null;
  for (let attempt = 0; attempt < MAX_TELEGRAM_RETRIES; attempt += 1) {
    try {
      latest = await telegramRequest(token, method, body, json, timeoutMs);
      if (!isRetryableResponse(latest.response) || attempt === MAX_TELEGRAM_RETRIES - 1) {
        return latest;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay(latest!.data, attempt)));
    } catch (error) {
      if (attempt === MAX_TELEGRAM_RETRIES - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(1_500, 300 * 2 ** attempt)));
    }
  }
  if (latest) return latest;
  throw new Error("Telegram request failed before receiving a response.");
}

function findPrivateChat(updates: unknown): string | null {
  if (!Array.isArray(updates)) return null;
  const chats: TelegramChat[] = [];
  for (const update of updates) {
    if (!update || typeof update !== "object") continue;
    for (const key of ["message", "edited_message", "channel_post"]) {
      const message = update[key];
      if (!message || typeof message !== "object") continue;
      const chat = message.chat;
      if (
        chat &&
        typeof chat === "object" &&
        "id" in chat &&
        (typeof chat.id === "number" || typeof chat.id === "string") &&
        "type" in chat &&
        chat.type === "private"
      ) {
        chats.push(chat as TelegramChat);
      }
    }
  }
  const latestChat = chats.at(-1);
  return latestChat ? String(latestChat.id) : null;
}

async function discoverChatId(token: string): Promise<string | null> {
  if (discoveredChatId) return discoveredChatId;
  try {
    const { response, data } = await telegramRequestWithRetry(token, "getUpdates");
    if (!response.ok || data.ok !== true) {
      console.error("[TELEGRAM] getUpdates failed.", {
        ok: false,
        status: response.status,
      });
      return null;
    }
    discoveredChatId = findPrivateChat(data.result);
    if (!discoveredChatId) {
      console.warn("[TELEGRAM] No private chat found in updates. The bot recipient must press Start.");
    }
    return discoveredChatId;
  } catch (error) {
    console.error("[TELEGRAM] getUpdates request failed.", {
      ok: false,
      reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "network",
    });
    return null;
  }
}

async function recipientCandidates(token: string, preferredChatId?: string): Promise<string[]> {
  const env = getTelegramEnvironment();
  const configured = preferredChatId?.trim() || env?.alertChatId || env?.chatId;
  const discovered = configured ? null : await discoverChatId(token);
  return [...new Set([configured, discovered, discoveredChatId].filter((id): id is string => Boolean(id)))];
}

function telegramFailure(response: Response, data: TelegramApiResponse): string {
  return response.status === 429
    ? emergencyStrings.telegram.rateLimited
    : response.status >= 500
      ? emergencyStrings.telegram.serverUnavailable
      : data.description || `Telegram returned HTTP ${response.status}.`;
}

function isMissingChat(reason: string): boolean {
  return /chat not found|bot was blocked by the user|user is deactivated/i.test(reason);
}

async function sendToRecipient(
  token: string,
  method: "sendMessage" | "sendPhoto" | "sendDocument" | "editMessageText",
  buildBody: (chatId: string) => BodyInit,
  isJson: boolean,
  preferredChatId?: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
  plainTextFallback?: (chatId: string) => BodyInit,
): Promise<TelegramDeliveryResult> {
  const candidates = await recipientCandidates(token, preferredChatId);
  if (candidates.length === 0) {
    return { ok: false, reason: "لا يوجد TELEGRAM_CHAT_ID صالح. افتح البوت واضغط Start ثم أعد المحاولة." };
  }

  let lastReason = "Telegram notification was not delivered.";
  for (const candidate of candidates) {
    try {
      let { response, data } = await telegramRequestWithRetry(
        token,
        method,
        buildBody(candidate),
        isJson,
        timeoutMs,
      );
      if (response.ok && data.ok === true) {
        discoveredChatId = candidate;
        const result =
          data.result && typeof data.result === "object"
            ? data.result
            : null;
        const messageId =
          result && "message_id" in result && typeof result.message_id === "number"
            ? result.message_id
            : undefined;
        return { ok: true, ...(messageId ? { messageId } : {}) };
      }
      lastReason = telegramFailure(response, data);
      if (
        response.status === 400 &&
        plainTextFallback &&
        /parse entities|can't parse|cannot parse|unsupported start tag|unclosed tag/i.test(data.description ?? "")
      ) {
        const plainResult = await telegramRequestWithRetry(
          token,
          method,
          plainTextFallback(candidate),
          isJson,
          timeoutMs,
        );
        if (plainResult.response.ok && plainResult.data.ok === true) {
          discoveredChatId = candidate;
          const result =
            plainResult.data.result && typeof plainResult.data.result === "object"
              ? plainResult.data.result
              : null;
          const messageId =
            result && "message_id" in result && typeof result.message_id === "number"
              ? result.message_id
              : undefined;
          return {
            ok: true,
            ...(messageId ? { messageId } : {}),
            plainTextFallback: true,
          };
        }
        lastReason = telegramFailure(plainResult.response, plainResult.data);
        response = plainResult.response;
        data = plainResult.data;
      }
      if (!isMissingChat(lastReason)) break;

      discoveredChatId = null;
      const discovered = await discoverChatId(token);
      if (!discovered || discovered === candidate) {
        lastReason = `${lastReason}. افتح البوت واضغط Start ثم أعد المحاولة.`;
        break;
      }
      if (!candidates.includes(discovered)) candidates.push(discovered);
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "Unknown Telegram connection error.";
      break;
    }
  }
  return { ok: false, reason: lastReason };
}

export async function sendTelegramAlert(
  title: string,
  details: Record<string, unknown>,
  gpsCoords?: GpsCoords,
  whatsappUrl?: string,
): Promise<TelegramDeliveryResult> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, reason: "لم يتم ضبط TELEGRAM_BOT_TOKEN أو BOT_TOKEN أو TELEGRAM_TOKEN." };
  }

  const lines = [`<b>${escapeHtml(title.slice(0, 200))}</b>`];
  let usedCharacters = lines[0].length;
  for (const [key, rawValue] of Object.entries(details)) {
    const value = detailText(rawValue);
    if (!value || usedCharacters >= TELEGRAM_MESSAGE_LIMIT) continue;
    const safeKey = escapeHtml(key);
    const isPhone = key === "الهاتف" || key === "رقم الهاتف";
    const overhead = isPhone ? 100 : 10;
    const available = Math.min(800, TELEGRAM_MESSAGE_LIMIT - usedCharacters - safeKey.length - overhead);
    if (available <= 0) continue;
    const safeValue = escapeHtmlWithinBudget(value, available);
    const line = isPhone ? `${safeKey}: <code>${safeValue}</code>` : `${safeKey}: ${safeValue}`;
    lines.push(line);
    usedCharacters += line.length;
  }

  if (gpsCoords && usedCharacters < TELEGRAM_MESSAGE_LIMIT) {
    const mapsUrl = createMapsCoordinatesHref(gpsCoords.lat, gpsCoords.lng);
    lines.push(`<a href="${mapsUrl}">${emergencyStrings.telegram.locationOpenGoogleMaps}</a>`);
    if (gpsCoords.accuracy !== undefined) {
      lines.push(
        `${escapeHtml(emergencyStrings.form.locationLinkAccuracy)}: ±${Math.round(gpsCoords.accuracy)} ${escapeHtml(emergencyStrings.form.meters)}`,
      );
    }
  }

  const result = await sendToRecipient(
    token,
    "sendMessage",
    (chatId) =>
      JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(whatsappUrl && /^https:\/\/wa\.me\/\d{8,15}(?:\?[^\s]*)?$/.test(whatsappUrl)
          ? {
              reply_markup: {
                inline_keyboard: [[{ text: emergencyStrings.telegram.whatsappContactButton, url: whatsappUrl }]],
              },
            }
          : {}),
      }),
    true,
  );
  console.info("[TELEGRAM] Message delivery result.", result);
  return result;
}

export async function sendTelegramPhotoUrl(
  imageUrl: string,
  caption: string,
  preferredChatId?: string,
): Promise<TelegramDeliveryResult> {
  const env = getTelegramEnvironment();
  if (!env) return { ok: false, reason: "لم يتم ضبط TELEGRAM_BOT_TOKEN." };
  if (!isSupabaseFaultImageUrl(imageUrl)) return { ok: false, reason: "رابط صورة البلاغ غير صالح." };
  let image: TelegramPhotoBytes;
  try {
    image = await loadEmergencyPhoto(imageUrl);
  } catch {
    return { ok: false, reason: emergencyStrings.telegram.photoFetchFailed };
  }
  const method = shouldSendAsPhoto(image) ? "sendPhoto" : "sendDocument";
  const result = await sendToRecipient(
    env.token,
    method,
    (chatId) => {
      const form = new FormData();
      form.set("chat_id", chatId);
      form.set("caption", caption.slice(0, 900));
      if (env.threadId) form.set("message_thread_id", String(env.threadId));
      const field = method === "sendPhoto" ? "photo" : "document";
      form.set(field, new Blob([image.bytes], { type: image.mimeType }), `voltix-image.${image.extension}`);
      return form;
    },
    false,
    preferredChatId || env.alertChatId || env.chatId,
  );
  console.info("[TELEGRAM] Public image delivery result.", result);
  return result;
}

export async function sendTelegramPhoto(
  imageDataUrl: string,
  caption: string,
  preferredChatId?: string,
): Promise<TelegramDeliveryResult> {
  const token = getBotToken();
  if (!token) {
    return { ok: false, reason: "لم يتم ضبط TELEGRAM_BOT_TOKEN أو BOT_TOKEN أو TELEGRAM_TOKEN." };
  }

  const match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return { ok: false, reason: "صيغة الصورة المرفقة غير صالحة." };
  const image = Buffer.from(match[2], "base64");
  const extension = match[1] === "jpeg" ? "jpg" : match[1];

  const result = await sendToRecipient(
    token,
    "sendPhoto",
    (chatId) => {
      const form = new FormData();
      form.set("chat_id", chatId);
      form.set("caption", caption.slice(0, 900));
      form.set("photo", new Blob([image], { type: `image/${match[1]}` }), `voltix-panel.${extension}`);
      return form;
    },
    false,
    preferredChatId,
  );
  console.info("[TELEGRAM] Photo delivery result.", result);
  return result;
}

interface TelegramPhotoBytes {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

function parseImageDimensions(bytes: Uint8Array, mimeType: TelegramPhotoBytes["mimeType"]): {
  width: number;
  height: number;
} | null {
  if (mimeType === "image/png" && bytes.length >= 24) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/webp" && bytes.length >= 30) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8X") {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height };
    }
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }
  if (mimeType === "image/jpeg" && bytes.length > 4) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2 || offset + 2 + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function shouldSendAsPhoto(photo: TelegramPhotoBytes): boolean {
  if (photo.bytes.byteLength > TELEGRAM_PHOTO_MAX_BYTES) return false;
  const dimensions = parseImageDimensions(photo.bytes, photo.mimeType);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) return false;
  return (
    dimensions.width + dimensions.height <= 10_000 &&
    Math.max(dimensions.width / dimensions.height, dimensions.height / dimensions.width) <= 20
  );
}

async function loadEmergencyPhoto(source: string): Promise<TelegramPhotoBytes> {
  let bytes: Uint8Array;
  let contentType: string;
  if (source.startsWith("data:image/")) {
    const match = source.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/u);
    if (!match) throw new Error("invalid_photo");
    bytes = Buffer.from(match[2], "base64");
    contentType = match[1];
  } else {
    if (!isSupabaseFaultImageUrl(source)) throw new Error("invalid_photo_url");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(source, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("photo_fetch_failed");
      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (declaredLength > MAX_TELEGRAM_FILE_BYTES) throw new Error("photo_too_large");
      const image = await response.arrayBuffer();
      if (image.byteLength > MAX_TELEGRAM_FILE_BYTES) throw new Error("photo_too_large");
      bytes = new Uint8Array(image);
      contentType = response.headers.get("content-type")?.split(";")[0].toLowerCase() ?? "";
    } finally {
      clearTimeout(timeout);
    }
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_TELEGRAM_FILE_BYTES) {
    throw new Error("photo_too_large");
  }
  if (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "image/webp") {
    throw new Error("invalid_photo_type");
  }
  const mimeType: TelegramPhotoBytes["mimeType"] =
    contentType === "image/jpeg"
      ? "image/jpeg"
      : contentType === "image/png"
        ? "image/png"
        : "image/webp";
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/png" ? "png" : "webp";
  return { bytes, mimeType, extension };
}

function messageThreadField(env: TelegramEnvironment): Record<string, number> {
  return env.threadId ? { message_thread_id: env.threadId } : {};
}

export async function sendTelegramEmergencyCard(
  report: EmergencyReport,
): Promise<TelegramDeliveryResult> {
  const env = getTelegramEnvironment();
  if (!env) return { ok: false, reason: emergencyStrings.telegram.telegramNotConfigured };
  const keyboard = createEmergencyKeyboard(report);
  const html = formatEmergencyCard(report);
  const plain = formatEmergencyCardPlainText(report);
  const recipient = env.alertChatId || env.chatId;
  const build = (chatId: string, text: string, parseMode: boolean): string =>
    JSON.stringify({
      chat_id: chatId,
      ...messageThreadField(env),
      text,
      ...(parseMode ? { parse_mode: "HTML" } : {}),
      disable_notification: report.severity === "low",
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard,
    });
  return sendToRecipient(
    env.token,
    "sendMessage",
    (chatId) => build(chatId, html, true),
    true,
    recipient,
    REQUEST_TIMEOUT_MS,
    (chatId) => build(chatId, plain, false),
  );
}

export async function editTelegramEmergencyCard(
  report: EmergencyReport,
  messageId: number,
  plainTextFallback: boolean,
): Promise<TelegramDeliveryResult> {
  const env = getTelegramEnvironment();
  if (!env) return { ok: false, reason: emergencyStrings.telegram.telegramNotConfigured };
  const html = formatEmergencyCard(report);
  const plain = formatEmergencyCardPlainText(report);
  const keyboard = createEmergencyKeyboard(report);
  const recipient = env.alertChatId || env.chatId;
  const build = (chatId: string, text: string, parseMode: boolean): string =>
    JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      ...(parseMode ? { parse_mode: "HTML" } : {}),
      link_preview_options: { is_disabled: true },
      reply_markup: keyboard,
    });
  return sendToRecipient(
    env.token,
    "editMessageText",
    (chatId) => build(chatId, plainTextFallback ? plain : html, !plainTextFallback),
    true,
    recipient,
    REQUEST_TIMEOUT_MS,
    plainTextFallback ? undefined : (chatId) => build(chatId, plain, false),
  );
}

export async function sendTelegramEmergencyPhoto(
  source: string,
  report: EmergencyReport,
  replyToMessageId: number,
): Promise<TelegramDeliveryResult> {
  const env = getTelegramEnvironment();
  if (!env) return { ok: false, reason: emergencyStrings.telegram.telegramNotConfigured };
  let image: TelegramPhotoBytes;
  try {
    image = await loadEmergencyPhoto(source);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error && error.name === "AbortError"
        ? emergencyStrings.telegram.photoFetchTimeout
        : emergencyStrings.telegram.photoFetchFailed,
    };
  }
  const method = shouldSendAsPhoto(image) ? "sendPhoto" : "sendDocument";
  const caption = formatEmergencyPhotoCaption(report);
  const plainCaption = caption.replace(/<[^>]*>/gu, "");
  const build = (chatId: string, value: string, parseMode: boolean): FormData => {
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("caption", value);
    if (parseMode) form.set("parse_mode", "HTML");
    form.set("reply_parameters", JSON.stringify({
      message_id: replyToMessageId,
      allow_sending_without_reply: true,
    }));
    form.set("disable_notification", String(report.severity === "low"));
    if (method === "sendPhoto") {
      form.set("photo", new Blob([image.bytes], { type: image.mimeType }), `voltix-${report.referenceId}.${image.extension}`);
    } else {
      form.set("document", new Blob([image.bytes], { type: image.mimeType }), `voltix-${report.referenceId}.${image.extension}`);
    }
    return form;
  };
  return sendToRecipient(
    env.token,
    method,
    (chatId) => build(chatId, caption, true),
    false,
    env.alertChatId || env.chatId,
    REQUEST_TIMEOUT_MS,
    (chatId) => build(chatId, plainCaption, false),
  );
}

export async function sendTelegramPhotoFailureReply(
  referenceId: string,
  replyToMessageId: number,
): Promise<TelegramDeliveryResult> {
  const env = getTelegramEnvironment();
  if (!env) return { ok: false, reason: emergencyStrings.telegram.telegramNotConfigured };
  const html = formatPhotoUploadFailure(referenceId);
  const body = (chatId: string, text: string, parseMode: boolean): string =>
    JSON.stringify({
      chat_id: chatId,
      ...messageThreadField(env),
      text,
      ...(parseMode ? { parse_mode: "HTML" } : {}),
      disable_notification: false,
      link_preview_options: { is_disabled: true },
      reply_parameters: {
        message_id: replyToMessageId,
        allow_sending_without_reply: true,
      },
    });
  return sendToRecipient(
    env.token,
    "sendMessage",
    (chatId) => body(chatId, html, true),
    true,
    env.alertChatId || env.chatId,
    REQUEST_TIMEOUT_MS,
    (chatId) => body(chatId, html.replace(/<[^>]*>/gu, ""), false),
  );
}

export async function sendTelegramAnalysisReport(
  report: TelegramAnalysisReport,
  imageDataUrl?: string,
  whatsappUrl?: string,
): Promise<TelegramDeliveryResult> {
  const token = getBotToken();
  if (!token) return { ok: false, reason: "Telegram is not configured." };

  const recipient = process.env.TELEGRAM_ALERT_CHAT_ID?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();
  const photoCaption = [
    `🧰 <b>تقرير فرز ${report.kind === "image" ? "صورة" : report.kind === "voice" ? "صوت" : "نصي"}</b>`,
    `<b>الملخص:</b> ${escapeHtmlWithinBudget(report.summary, 850)}`,
  ].join("\n");
  let photoOk = true;

  if (imageDataUrl) {
    const match = imageDataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (match) {
      const image = Buffer.from(match[2], "base64");
      const extension = match[1] === "jpeg" ? "jpg" : match[1];
      const photoResult = await sendToRecipient(
        token,
        "sendPhoto",
        (chatId) => {
          const form = new FormData();
          form.set("chat_id", chatId);
          form.set("caption", photoCaption.slice(0, 900));
          form.set("parse_mode", "HTML");
          form.set("photo", new Blob([image], { type: `image/${match[1]}` }), `voltix-report.${extension}`);
          return form;
        },
        false,
        recipient,
        ANALYSIS_TIMEOUT_MS,
      );
      photoOk = photoResult.ok;
    } else {
      photoOk = false;
    }
  }

  const lines = [
    `<b>تقرير فرز ${report.kind === "image" ? "صورة" : report.kind === "voice" ? "صوت" : "نصي"}</b>`,
  ];
  let usedCharacters = lines[0].length;
  const append = (label: string, value: string) => {
    const prefix = `${label}: `;
    const available = TELEGRAM_MESSAGE_LIMIT - usedCharacters - prefix.length - 1;
    if (available <= 0) return;
    const line = `${prefix}${escapeHtmlWithinBudget(value, available)}`;
    lines.push(line);
    usedCharacters += line.length + 1;
  };
  append("<b>وقت الاستلام</b>", report.receivedAt);
  append("<b>وصف البلاغ</b>", report.problem);
  append("<b>الملخص</b>", report.summary);
  append("<b>الملاحظات</b>", report.findings.length ? report.findings.join("؛ ") : "لا توجد ملاحظات مؤكدة.");
  append(
    "<b>الإجراءات المقترحة</b>",
    report.recommendedActions.length ? report.recommendedActions.join("؛ ") : "يلزم فحص فني مباشر.",
  );
  append("<b>المعدات</b>", report.requiredTools.length ? report.requiredTools.join("؛ ") : "لم تحدد.");
  append("<b>الثقة</b>", report.confidence ?? "غير محددة");
  const result = await sendToRecipient(
    token,
    "sendMessage",
    (chatId) =>
      JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(whatsappUrl && /^https:\/\/wa\.me\/\d{8,15}(?:\?[^\s]*)?$/.test(whatsappUrl)
          ? {
              reply_markup: {
                inline_keyboard: [[{ text: emergencyStrings.telegram.whatsappContactButton, url: whatsappUrl }]],
              },
            }
          : {}),
      }),
    true,
    recipient,
    ANALYSIS_TIMEOUT_MS,
  );
  return result.ok ? result : { ok: false, reason: photoOk ? result.reason : "Telegram report delivery failed." };
}
