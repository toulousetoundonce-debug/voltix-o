export const GPS_TARGET_ACCURACY_METERS = 20;
export const GPS_FRESH_FIX_AGE_MS = 5_000;
export const GPS_CACHE_MAX_AGE_MS = 15_000;
export const GPS_CAPTURE_MAX_WAIT_MS = 12_000;
export const GPS_DRAFT_MAX_AGE_MS = 2 * 60_000;

export function isFreshAccurateGpsFix(
  accuracy: number,
  timestamp: number,
  now = Date.now(),
): boolean {
  return (
    accuracy <= GPS_TARGET_ACCURACY_METERS &&
    timestamp <= now &&
    now - timestamp <= GPS_FRESH_FIX_AGE_MS
  );
}
