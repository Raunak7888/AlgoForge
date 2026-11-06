import { env } from "../config/env";
import { sessionRepository } from "../repositories/session.repository";
import { logger, serializeError } from "../utils/logger";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 30_000;

/** Deletes expired sessions and revoked sessions past the retention window. Returns how many rows were removed. */
export async function cleanupSessions(now: Date = new Date()): Promise<number> {
  const result = await sessionRepository.deleteStale(now, env.session.revokedRetentionDays * DAY_MS);
  return result.count;
}

/**
 * Runs the cleanup on a timer (unref'd, so it never keeps the process alive).
 * Safe on several instances: the delete is idempotent. Returns a function that stops the timers.
 */
export function startSessionCleanup(): () => void {
  if (!env.session.cleanupEnabled) return () => undefined;

  let running = false;
  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const deleted = await cleanupSessions();
      if (deleted > 0) logger.info("session cleanup", { deleted });
    } catch (error) {
      logger.warn("session cleanup failed", serializeError(error));
    } finally {
      running = false;
    }
  };

  const first = setTimeout(() => void run(), FIRST_RUN_DELAY_MS);
  const timer = setInterval(() => void run(), env.session.cleanupIntervalMinutes * 60_000);
  first.unref();
  timer.unref();

  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
