import { describe, expect, it } from "vitest";
import { AuthUserSchema, DeviceSessionSchema } from "@algoforge/contracts";
import { serializeAuthUser, serializeDeviceSession } from "./auth";

describe("serializeAuthUser", () => {
  const row = { id: "u1", email: "a@b.co", username: null, name: "Ada", image: null, role: "USER" as const };

  it("returns exactly the six contract fields", () => {
    const out = serializeAuthUser(row);
    expect(Object.keys(out).sort()).toEqual(["email", "id", "image", "name", "role", "username"]);
    expect(AuthUserSchema.safeParse(out).success).toBe(true);
  });
});

describe("serializeDeviceSession", () => {
  const row = {
    id: "s1",
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    lastUsedAt: "2026-11-04T09:00:00.000Z",
    ipAddress: null,
    userAgent: "Mozilla/5.0",
  };

  it("marks the caller's own session", () => {
    expect(serializeDeviceSession(row, "s1").current).toBe(true);
    expect(serializeDeviceSession(row, "other").current).toBe(false);
  });
  it("matches the contract", () => {
    expect(DeviceSessionSchema.safeParse(serializeDeviceSession(row, "s1")).success).toBe(true);
  });
});
