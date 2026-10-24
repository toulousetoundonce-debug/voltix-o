import { Buffer } from "node:buffer";

interface GpsCoords {
  lat: number;
  lng: number;
}

export interface TelegramDeliveryResult {
  ok: boolean;
  reason?: string;
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: unknown;
}

interface TelegramChat {
  id: number | string;
  type: string;
}

const REQUEST_TIMEOUT_MS = 8_000;
const ANALYSIS_TIMEOUT_MS = 2_500;
const TELEGRAM_MESSAGE_LIMIT = 3_800;
let discoveredChatId: string | null = null;

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
  return (
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.BOT_TOKEN ||
    process.env.TELEGRAM_TOKEN ||
    ""
  ).trim();
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
  method: "sendMessage" | "sendPhoto" | "getUpdates",
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
    const data: TelegramApiResponse = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
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
    const { response, data } = await telegramRequest(token, "getUpdates");
    if (!response.ok || data.ok !== true) {
      console.error("[TELEGRAM] getUpdates failed.", {
        ok: false,
        status: response.status,
        reason: data.description ?? "Telegram returned an unexpected response.",
      });
      return null;
    }
    discoveredChatId = findPrivateChat(data.result);
    if (!discoveredChatId) {
      console.warn("[TELEGRAM] No private chat found in updates. The bot recipient must press Start.");
    }
    return discoveredChatId;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Telegram connection error.";
    console.error("[TELEGRAM] getUpdates request failed.", { ok: false, reason });
    return null;
  }
}

async function recipientCandidates(token: string, preferredChatId?: string): Promise<string[]> {
  const configured = preferredChatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim();
  const discovered = configured ? null : await discoverChatId(token);
  return [...new Set([configured, discovered, discoveredChatId].filter((id): id is string => Boolean(id)))];
}

function telegramFailure(response: Response, data: TelegramApiResponse): string {
  return data.description || `Telegram returned HTTP ${response.status}.`;
}

function isMissingChat(reason: string): boolean {
  return /chat not found|bot was blocked by the user|user is deactivated/i.test(reason);
}

async function sendToRecipient(
  token: string,
  method: "sendMessage" | "sendPhoto",
  buildBody: (chatId: string) => BodyInit,
  isJson: boolean,
  preferredChatId?: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<TelegramDeliveryResult> {
  const candidates = await recipientCandidates(token, preferredChatId);
  if (candidates.length === 0) {
    return { ok: false, reason: "لا يوجد TELEGRAM_CHAT_ID صالح. افتح البوت واضغط Start ثم أعد المحاولة." };
  }

  let lastReason = "Telegram notification was not delivered.";
  for (const candidate of candidates) {
    try {
      const { response, data } = await telegramRequest(token, method, buildBody(candidate), isJson, timeoutMs);
      if (response.ok && data.ok === true) {
        discoveredChatId = candidate;
        return { ok: true };
      }
      lastReason = telegramFailure(response, data);
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
    const line = isPhone
      ? `${safeKey}: <a href="tel:${escapeHtml(value.replace(/[^\d+]/g, ""))}">${safeValue}</a>`
      : `${safeKey}: ${safeValue}`;
    lines.push(line);
    usedCharacters += line.length;
  }

  if (gpsCoords && usedCharacters < TELEGRAM_MESSAGE_LIMIT) {
    const mapsUrl = `https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`;
    lines.push(`<a href="${mapsUrl}">فتح الموقع على خرائط Google</a>`);
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
      }),
    true,
  );
  console.info("[TELEGRAM] Message delivery result.", result);
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

export async function sendTelegramAnalysisReport(
  report: TelegramAnalysisReport,
  imageDataUrl?: string,
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
      }),
    true,
    recipient,
    ANALYSIS_TIMEOUT_MS,
  );
  return result.ok ? result : { ok: false, reason: photoOk ? result.reason : "Telegram report delivery failed." };
}
