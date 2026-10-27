import { emergencyStrings } from "@/lib/emergency-strings";
import type { EmergencyReport } from "@/lib/emergency-report";

export interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
}

function cleanText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, " ")
    .replace(/https?:\/\/[^\s<>]+|www\.[^\s<>]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dz|fr|co|app|dev)(?:\/[^\s<>]*)?/giu, emergencyStrings.telegram.linkRedacted)
    .replace(/@/gu, "@\u200B")
    .replace(/\s+/gu, " ")
    .trim();
}

export function escapeTelegramHtml(value: string, maxEscapedLength = 1_000): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  let output = "";
  for (const character of cleanText(value)) {
    const escaped = entities[character] ?? character;
    if (output.length + escaped.length > maxEscapedLength) break;
    output += escaped;
  }
  return output;
}

function plainHtml(value: string): string {
  return value
    .replace(/<[^>]*>/gu, "")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function severityHeader(severity: EmergencyReport["severity"], referenceId: string): string {
  const icons = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢" } as const;
  const label = emergencyStrings.telegram.severityHeaders[severity];
  const icon = icons[severity];
  return `${icon} <b>${label}</b> · <code>${escapeTelegramHtml(referenceId, 40)}</code>`;
}

function fieldLine(icon: string, label: string, value: string, budget = 300): string {
  return `${icon} <b>${label}:</b> ${escapeTelegramHtml(value, budget)}`;
}

function numberedLines(values: string[], maximum: number): string[] {
  return values.slice(0, maximum).map((value, index) => `${index + 1}. ${escapeTelegramHtml(value, 100)}`);
}

export function formatEmergencyCard(report: EmergencyReport): string {
  const header = severityHeader(report.severity, report.referenceId);
  const locationValue =
    report.location.lat !== null && report.location.lng !== null
      ? `<code>${escapeTelegramHtml(`${report.location.lat}, ${report.location.lng}`, 80)}</code> · ${escapeTelegramHtml(report.location.address, 80)} · ${
          report.location.accuracy === null
            ? emergencyStrings.telegram.locationAccuracyUnknown
            : `${emergencyStrings.telegram.estimatedAccuracy} ±${Math.round(report.location.accuracy)} ${emergencyStrings.telegram.metersShort}`
        }`
      : `<b>${escapeTelegramHtml(report.location.address, 120)}</b>`;
  const actionLines = numberedLines(report.triage.technicianAction, 3);
  const questionLines = report.triage.questionsForCall
    .slice(0, 4)
    .map((question) => `• ${escapeTelegramHtml(question, 80)}`);
  const adviceLines = report.triage.immediateSafetyAdvice
    .slice(0, 3)
    .map((advice) => `• ${escapeTelegramHtml(advice, 140)}`);
  const card = [
    header,
    fieldLine("⚡️", emergencyStrings.telegram.labels.type, report.emergencyType, 240),
    fieldLine("🕒", emergencyStrings.telegram.labels.time, report.displayTime, 100),
    "",
    `🗣 <b>${emergencyStrings.telegram.labels.customerWords}</b> (${emergencyStrings.telegram.languageLabels[report.detectedLanguage]})`,
    `«${escapeTelegramHtml(report.customerWords || emergencyStrings.telegram.customerWordsMissing, 360)}»`,
    "",
    `🧠 <b>${emergencyStrings.telegram.analysisHeader}</b> ${
      report.triage.analysisAvailable
        ? `(${emergencyStrings.telegram.analysisNeedsConfirmation})`
        : `(${emergencyStrings.telegram.analysisUnavailable})`
    }`,
    `• <b>${emergencyStrings.telegram.labels.problem}:</b> ${escapeTelegramHtml(report.triage.problemSummary, 160)}`,
    `• <b>${emergencyStrings.telegram.labels.probableCause}:</b> ${escapeTelegramHtml(report.triage.probableCause, 160)}`,
    ...(report.hasPhoto
      ? [`• <b>${emergencyStrings.telegram.labels.image}:</b> ${escapeTelegramHtml(report.imageFindings ?? emergencyStrings.telegram.photoNeedsReview, 140)}`]
      : []),
    "",
    `🛠 <b>${emergencyStrings.telegram.intervention}</b>`,
    ...(actionLines.length ? actionLines : [`1. ${emergencyStrings.telegram.fieldInspectionRequired}`]),
    `🧰 <b>${emergencyStrings.telegram.labels.toolsToBring}:</b> ${escapeTelegramHtml(report.triage.toolsToBring.join("، ") || emergencyStrings.telegram.toolsToBeDetermined, 120)}`,
    `☎️ <b>${emergencyStrings.telegram.labels.questionsForCall}:</b>`,
    ...(questionLines.length
      ? questionLines
      : [`• ${emergencyStrings.telegram.immediateDangerQuestion}`, `• ${emergencyStrings.telegram.safeAccessQuestion}`]),
    "",
    `⚠️ <b>${emergencyStrings.telegram.labels.safetyAdviceSent}:</b>`,
    ...(adviceLines.length ? adviceLines : [`• ${emergencyStrings.safetyMessage}`]),
    "",
    `📍 <b>${emergencyStrings.telegram.labels.location}:</b> ${locationValue}`,
    `👤 <b>${emergencyStrings.telegram.labels.customer}:</b> ${escapeTelegramHtml(report.customer.name, 80)}`,
    `📞 <b>${emergencyStrings.telegram.labels.phone}:</b> <code>${escapeTelegramHtml(report.customer.phone, 40)}</code>`,
    `🆔 <b>${emergencyStrings.telegram.labels.reportReference}:</b> <code>${escapeTelegramHtml(report.referenceId, 40)}</code>`,
  ].filter((line) => line !== undefined);
  const html = card.join("\n");
  if (html.length <= 4_096) return html;

  const compact = [
    header,
    fieldLine("⚡️", emergencyStrings.telegram.labels.type, report.emergencyType, 120),
    fieldLine("🕒", emergencyStrings.telegram.labels.time, report.displayTime, 80),
    `🗣 <b>${emergencyStrings.telegram.labels.customerWords}</b> (${emergencyStrings.telegram.languageLabels[report.detectedLanguage]})`,
    `«${escapeTelegramHtml(report.customerWords || emergencyStrings.telegram.customerWordsMissing, 120)}»`,
    `🧠 <b>${emergencyStrings.telegram.analysisHeader}</b> (${
      report.triage.analysisAvailable
        ? emergencyStrings.telegram.analysisNeedsConfirmation
        : emergencyStrings.telegram.analysisUnavailable
    })`,
    `• <b>${emergencyStrings.telegram.labels.problem}:</b> ${escapeTelegramHtml(report.triage.problemSummary, 100)}`,
    `• <b>${emergencyStrings.telegram.labels.probableCause}:</b> ${escapeTelegramHtml(report.triage.probableCause, 100)}`,
    ...(report.hasPhoto
      ? [`• <b>${emergencyStrings.telegram.labels.image}:</b> ${escapeTelegramHtml(report.imageFindings ?? emergencyStrings.telegram.photoNeedsReview, 100)}`]
      : []),
    `🛠 <b>${emergencyStrings.telegram.intervention}</b>`,
    ...numberedLines(report.triage.technicianAction, 2),
    `🧰 <b>${emergencyStrings.telegram.labels.toolsToBring}:</b> ${escapeTelegramHtml(report.triage.toolsToBring.join("، "), 80)}`,
    `☎️ <b>${emergencyStrings.telegram.labels.questionsForCall}:</b>`,
    ...report.triage.questionsForCall.slice(0, 2).map((question) => `• ${escapeTelegramHtml(question, 70)}`),
    `⚠️ <b>${emergencyStrings.telegram.labels.safetyAdviceSent}:</b>`,
    ...report.triage.immediateSafetyAdvice
      .slice(0, 3)
      .map((advice) => `• ${escapeTelegramHtml(advice, 100)}`),
    `📍 <b>${emergencyStrings.telegram.labels.location}:</b> ${locationValue}`,
    `👤 <b>${emergencyStrings.telegram.labels.customer}:</b> ${escapeTelegramHtml(report.customer.name, 60)}`,
    `📞 <b>${emergencyStrings.telegram.labels.phone}:</b> <code>${escapeTelegramHtml(report.customer.phone, 40)}</code>`,
    `🆔 <b>${emergencyStrings.telegram.labels.reportReference}:</b> <code>${escapeTelegramHtml(report.referenceId, 40)}</code>`,
  ].join("\n");
  return compact;
}

export function formatEmergencyCardPlainText(report: EmergencyReport): string {
  return plainHtml(formatEmergencyCard(report));
}

export function createEmergencyKeyboard(report: EmergencyReport): TelegramInlineKeyboard {
  const buttons = [
    { text: emergencyStrings.telegram.whatsappButton, url: report.customer.whatsappUrl },
    ...(report.location.mapsUrl
      ? [{ text: emergencyStrings.telegram.mapsButton, url: report.location.mapsUrl }]
      : []),
    ...(report.location.wazeUrl
      ? [{ text: emergencyStrings.telegram.wazeButton, url: report.location.wazeUrl }]
      : []),
  ].filter((button) => /^https:\/\//u.test(button.url));
  return { inline_keyboard: [buttons] };
}

export function formatEmergencyPhotoCaption(report: EmergencyReport): string {
  const findings = report.imageFindings ?? emergencyStrings.telegram.photoNeedsReview;
  const caption = `📷 <b>${emergencyStrings.telegram.labels.photoCaption}</b> · <code>${escapeTelegramHtml(report.referenceId, 40)}</code>\n🧠 <b>${emergencyStrings.telegram.labels.imageFindings}:</b> ${escapeTelegramHtml(findings, 700)}`;
  return caption.slice(0, 1_024);
}

export function formatPhotoUploadFailure(referenceId: string): string {
  return `${emergencyStrings.telegram.photoUploadFailed} · <code>${escapeTelegramHtml(referenceId, 40)}</code>`;
}

export function formatEmergencyTextFallback(report: EmergencyReport): string {
  return plainHtml(formatEmergencyCard(report));
}
