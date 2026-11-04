import type { Request } from "express";
import type { Prisma } from "@algoforge/db";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { logger, serializeError } from "../utils/logger";
import { paginate } from "../utils/pagination";

/** Every admin mutation uses one of these names, so the log stays searchable. */
export const AUDIT_ACTIONS = {
  USER_UPGRADE: "admin.user.upgrade",
  USER_DOWNGRADE: "admin.user.downgrade",
  ALGORITHM_CREATE: "algorithm.create",
  ALGORITHM_UPDATE: "algorithm.update",
  ALGORITHM_DELETE: "algorithm.delete",
  CATEGORY_CREATE: "category.create",
  CATEGORY_UPDATE: "category.update",
  CATEGORY_DELETE: "category.delete",
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditTarget {
  type: string;
  id?: string | null;
}
export interface AuditEntry {
  actorId: string | null;
  action: string;
  target?: AuditTarget;
  meta?: Record<string, unknown>;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const MAX_DEPTH = 4;
const MAX_STRING = 500;
const MAX_ITEMS = 50;
const SENSITIVE_KEY = /secret|token|password|passwd|authorization|cookie|api[-_]?key|credential/i;

/** Makes arbitrary metadata safe to store: bounded size and depth, JSON-only values, secrets redacted by key name. */
export function sanitizeMeta(value: unknown, depth = 0): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "function" || typeof value === "symbol") return null;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => sanitizeMeta(v, depth + 1));
  if (typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS)) {
      if (k === "__proto__") continue;
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : sanitizeMeta(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

class AuditService {
  /**
   * Writes one audit row. NEVER throws: a failed audit write must not turn a mutation that already
   * succeeded into an error response. Failures are logged at error level. Returns whether the row was written.
   */
  async record(entry: AuditEntry): Promise<boolean> {
    try {
      await auditLogRepository.create({
        actorId: entry.actorId,
        action: entry.action.slice(0, 100),
        targetType: entry.target?.type ?? null,
        targetId: entry.target?.id ?? null,
        meta: sanitizeMeta(entry.meta ?? {}) as unknown as Prisma.InputJsonValue,
      });
      return true;
    } catch (error) {
      logger.error("audit log write failed", { action: entry.action, actorId: entry.actorId, ...serializeError(error) });
      return false;
    }
  }

  /** Convenience for controllers: the actor and request id come from the request. */
  recordFromRequest(req: Request, action: string, target?: AuditTarget, meta: Record<string, unknown> = {}): Promise<boolean> {
    return this.record({
      actorId: req.auth?.user.id ?? null,
      action,
      target,
      meta: { ...meta, requestId: req.requestId ?? null },
    });
  }

  async list(query: { limit: number; cursor?: string; actorId?: string; targetType?: string; targetId?: string }) {
    const rows = await auditLogRepository.findPage({ ...query, take: query.limit + 1 });
    return paginate(rows, query.limit, (row) => row.id);
  }
}

export const auditService = new AuditService();
