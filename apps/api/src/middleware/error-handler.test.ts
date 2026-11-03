import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@algoforge/db";

vi.mock("@algoforge/db", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, init: { code: string }) {
      super(message);
      this.code = init.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

import { errorHandler } from "./error-handler";
import { notFoundHandler } from "./not-found";
import { AppError } from "../utils/app-error";

function run(err: unknown) {
  const codes: number[] = [];
  const json = vi.fn();
  const res = {
    headersSent: false,
    status: (code: number) => {
      codes.push(code);
      return { json };
    },
  } as unknown as Response;
  const req = { method: "POST", originalUrl: "/api/x?y=1", requestId: "rid-12345678" } as unknown as Request;
  errorHandler(err, req, res, vi.fn() as unknown as NextFunction);
  return { status: codes[0], body: json.mock.calls[0]?.[0] as unknown };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("A-01 / A-02: one error envelope, correct status mapping", () => {
  it("passes AppError through", () => {
    const r = run(AppError.badRequest("nope"));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: { code: "BAD_REQUEST", message: "nope" } });
  });

  it("maps malformed JSON to 400", () => {
    const err = Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed", status: 400 });
    const r = run(err);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: { code: "BAD_REQUEST", message: "Malformed JSON body." } });
  });

  it("maps an oversized body to 413", () => {
    const err = Object.assign(new Error("too big"), { type: "entity.too.large", status: 413 });
    expect(run(err).status).toBe(413);
  });

  it("maps Prisma P2002 to 409 and P2025 to 404", () => {
    expect(run(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" })).status).toBe(409);
    expect(run(new Prisma.PrismaClientKnownRequestError("gone", { code: "P2025", clientVersion: "test" })).status).toBe(404);
  });

  it("returns 500 without leaking details, and always logs the error", () => {
    const r = run(new Error("secret internal detail"));
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain("secret internal detail");
    expect(console.error).toHaveBeenCalledTimes(1);
    const logged = String(vi.mocked(console.error).mock.calls[0]?.[0]);
    expect(logged).toContain("request failed");
    expect(logged).toContain("rid-12345678");
  });

  it("uses the same envelope for unknown routes", () => {
    const json = vi.fn();
    const codes: number[] = [];
    const res = {
      status: (code: number) => {
        codes.push(code);
        return { json };
      },
    } as unknown as Response;
    notFoundHandler({} as unknown as Request, res);
    expect(codes[0]).toBe(404);
    expect(json).toHaveBeenCalledWith({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });
});
