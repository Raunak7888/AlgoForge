import { app } from "./app";
import { env } from "./config/env";
import { connectRedis, closeRedis } from "./config/redis";
import { startSessionCleanup } from "./services/session-cleanup.service";

async function bootstrap(): Promise<void> {
  // Attempt Redis connection; non-fatal: rate limiting and caching degrade gracefully
  try {
    await connectRedis();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Redis] Startup connection failed: ${message}. Continuing without Redis.`);
  }

  const server = app.listen(env.port, () => {
    if (!env.isProduction) {
      console.log(`[API] Running at ${env.apiBaseUrl}`);
      console.log(`[API] Health: ${env.apiBaseUrl}/health`);
    }
  });

  // Removes expired and long-revoked sessions on a timer.
  const stopSessionCleanup = startSessionCleanup();

  async function shutdown(signal: string): Promise<void> {
    if (!env.isProduction) {
      console.log(`[API] ${signal}: shutting down.`);
    }
    stopSessionCleanup();
    server.close(async () => {
      await closeRedis();
      process.exit(0);
    });

    // Force exit if graceful shutdown stalls
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.on("SIGINT",  () => { void shutdown("SIGINT"); });
  process.on("uncaughtException", (err) => {
    console.error("[API] Uncaught exception:", err);
    void shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[API] Unhandled rejection:", reason);
  });
}

bootstrap().catch((err) => {
  console.error("[API] Failed to start:", err);
  process.exit(1);
});
