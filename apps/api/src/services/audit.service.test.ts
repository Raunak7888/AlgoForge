import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/audit-log.repository", () => ({
  auditLogRepository: { create: vi.fn(), findPage: vi.fn() },
}));

import { auditLogRepository } from "../repositories/audit-log.repository";
import { AUDIT_ACTIONS, auditService, sanitizeMeta } from "./audit.service";

const create = vi.mocked(auditLogRepository.create);

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ id: "a1" });
});

describe("sanitizeMeta", () => {
  it("keeps plain JSON", () => {
    expect(sanitizeMeta({ a: 1, b: "x", c: [true, null] })).toEqual({ a: 1, b: "x", c: [true, null] });
  });
  it("redacts secret-looking keys at any depth", () => {
    expect(sanitizeMeta({ token: "t", nested: { Password: "p", apiKey: "k", ok: 1 } })).toEqual({
      token: "[redacted]",
      nested: { Password: "[redacted]", apiKey: "[redacted]", ok: 1 },
    });
  });
  it("bounds string length, depth and list size", () => {
    expect((sanitizeMeta("x".repeat(2000)) as string).length).toBeLessThan(600);
    expect(sanitizeMeta({ a: { b: { c: { d: { e: 1 } } } } })).toEqual({ a: { b: { c: { d: "[truncated]" } } } });
    expect((sanitizeMeta(Array.from({ length: 500 }, (_, i) => i)) as unknown[]).length).toBe(50);
  });
  it("turns non-JSON values into JSON", () => {
    expect(sanitizeMeta({ d: new Date("2026-01-01T00:00:00Z"), n: NaN, u: undefined, f: () => 1 })).toEqual({
      d: "2026-01-01T00:00:00.000Z",
      n: null,
      u: null,
      f: null,
    });
  });
  it("cannot be used to poison the prototype", () => {
    const out = sanitizeMeta(JSON.parse('{"__proto__":{"x":1},"y":2}')) as Record<string, unknown>;
    expect(out.y).toBe(2);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe("auditService.record", () => {
  it("writes the entry with sanitized metadata", async () => {
    const ok = await auditService.record({ actorId: "u1", action: AUDIT_ACTIONS.ALGORITHM_CREATE, target: { type: "algorithm", id: "g1" }, meta: { secret: "s", slug: "x" } });
    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledWith({
      actorId: "u1",
      action: "algorithm.create",
      targetType: "algorithm",
      targetId: "g1",
      meta: { secret: "[redacted]", slug: "x" },
    });
  });
  it("never throws when the write fails: it reports false", async () => {
    create.mockRejectedValue(new Error("db down"));
    await expect(auditService.record({ actorId: "u1", action: "x" })).resolves.toBe(false);
  });
  it("takes the actor and request id from the request", async () => {
    const req = { auth: { user: { id: "admin1" } }, requestId: "req-1" } as unknown as Parameters<typeof auditService.recordFromRequest>[0];
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.USER_UPGRADE, { type: "user", id: "u9" }, { newRole: "ADMIN" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin1", targetType: "user", targetId: "u9", meta: { newRole: "ADMIN", requestId: "req-1" } }));
  });
  it("limits the action name length", async () => {
    await auditService.record({ actorId: null, action: "a".repeat(300) });
    expect(create.mock.calls[0][0].action.length).toBe(100);
  });
});
