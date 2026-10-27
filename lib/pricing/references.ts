import { randomInt } from "node:crypto";

const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const references = new Map<string, { value: string; createdAt: number }>();
const ttl = 30 * 60_000;

export function getEstimateReference(requestId?: string, now = new Date()): string {
  const timestamp = Date.now();
  for (const [key, entry] of references) {
    if (timestamp - entry.createdAt > ttl) references.delete(key);
  }
  if (requestId) {
    const existing = references.get(requestId);
    if (existing) return existing.value;
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Algiers",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const suffix = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
  const reference = `EST-${get("year")}${get("month")}${get("day")}-${suffix}`;
  if (requestId) references.set(requestId, { value: reference, createdAt: timestamp });
  return reference;
}
