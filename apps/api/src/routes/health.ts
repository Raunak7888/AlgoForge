import { Router } from "express";
import { prisma } from "@algoforge/db";
import { getRedisClient } from "../config/redis";

const router = Router();
const CHECK_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function check(fn: () => Promise<unknown>): Promise<"ok" | "fail"> {
  try {
    await withTimeout(fn(), CHECK_TIMEOUT_MS);
    return "ok";
  } catch {
    return "fail";
  }
}

// Liveness: the process is up.
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness: dependencies are reachable.
router.get("/ready", async (_req, res) => {
  const [database, redis] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    check(async () => {
      const reply = await getRedisClient().ping();
      if (reply !== "PONG") throw new Error("unexpected ping reply");
    }),
  ]);
  const ready = database === "ok" && redis === "ok";
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    checks: { database, redis },
    timestamp: new Date().toISOString(),
  });
});

export default router;
