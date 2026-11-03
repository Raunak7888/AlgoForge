import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@algoforge/db";

vi.mock("@algoforge/db", () => ({ Role: { USER: "USER", ADMIN: "ADMIN" } }));
vi.mock("../config/env", () => ({
  authCookies: {
    accessToken: "af_access",
    refreshToken: "af_refresh",
    csrfToken: "af_csrf",
    oauthState: "af_oauth_state",
  },
  env: { cookieDomain: undefined, isProduction: false, accessTokenTtlMinutes: 15, refreshTokenTtlDays: 30 },
}));
vi.mock("../services/auth.service", () => ({
  authService: { authenticateAccessToken: vi.fn() },
}));

import { authService } from "../services/auth.service";
import { optionalAuth, requireAuth, requireRoles } from "./auth";

const res = {} as unknown as Response;

beforeEach(() => {
  vi.mocked(authService.authenticateAccessToken).mockReset();
});

describe("S-04: no secret-header admin access", () => {
  it("requireAuth ignores X-Admin-Secret and still demands a session", async () => {
    const req = { headers: { "x-admin-secret": "anything" }, get: () => "anything" } as unknown as Request;
    const next = vi.fn();
    await requireAuth(req, res, next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
    expect(req.auth).toBeUndefined();
  });

  it("requireRoles(ADMIN) rejects a normal user", () => {
    const req = { auth: { user: { role: "USER" } } } as unknown as Request;
    const next = vi.fn();
    requireRoles(Role.ADMIN)(req, res, next as unknown as NextFunction);
    expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403 });
  });
});

describe("optionalAuth", () => {
  it("continues anonymously when there is no token", async () => {
    const req = { headers: {} } as unknown as Request;
    const next = vi.fn();
    await optionalAuth(req, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect(req.auth).toBeUndefined();
  });

  it("continues anonymously when the token is invalid", async () => {
    vi.mocked(authService.authenticateAccessToken).mockRejectedValue(new Error("bad token"));
    const req = { headers: { cookie: "af_access=bad" } } as unknown as Request;
    const next = vi.fn();
    await optionalAuth(req, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect(req.auth).toBeUndefined();
  });
});
