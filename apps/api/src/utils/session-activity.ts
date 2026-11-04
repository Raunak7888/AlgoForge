/** True when the stored lastUsedAt is old enough that it is worth writing a new one. */
export function shouldTouchSession(lastUsedAt: Date, now: Date, minIntervalMs: number): boolean {
  return now.getTime() - lastUsedAt.getTime() >= minIntervalMs;
}
