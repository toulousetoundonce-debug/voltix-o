// Shared (client + server) validation helpers. No heavy dependencies on purpose.

export const EMERGENCY_VALUES = [
  "industrial_line_down",
  "dangerous_short_circuit",
  "security_system_down",
  "control_panel_fault",
] as const;

export type EmergencyType = (typeof EMERGENCY_VALUES)[number];

export const EMERGENCY_LABELS: Record<EmergencyType, string> = {
  industrial_line_down: "انقطاع خط إنتاج صناعي",
  dangerous_short_circuit: "التماس كهربائي خطر",
  security_system_down: "توقف نظام مراقبة وأمان",
  control_panel_fault: "عطل لوحة تحكم",
};

export const SOS_DESCRIPTION_MAX_LENGTH = 1_500;
export const AI_DIAGNOSIS_MAX_LENGTH = 1_500;
export const VOICE_TRANSCRIPT_MAX_LENGTH = 1_500;

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits to Latin digits. */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const PHONE_FORMATTING_RE = /[\s\-().]/g;
const INTERNATIONAL_PHONE_RE = /^\+?[1-9]\d{7,14}$/;

/**
 * Removes common formatting and converts Algerian local numbers to E.164.
 * Arabic-Indic digits are accepted so the same value works in client and server validation.
 */
export function normalizePhoneNumber(value: string): string {
  let normalized = normalizeDigits(value.trim()).replace(PHONE_FORMATTING_RE, "");
  if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;

  const digits = normalized.replace(/\D/g, "");
  if (/^0[1-7]\d{7,8}$/.test(digits)) {
    return `+213${digits.slice(1)}`;
  }
  if (/^213[1-7]\d{7,8}$/.test(digits)) {
    return `+${digits}`;
  }
  return normalized;
}

export function isValidPhone(value: string): boolean {
  return INTERNATIONAL_PHONE_RE.test(normalizePhoneNumber(value));
}
