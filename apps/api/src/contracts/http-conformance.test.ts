import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ErrorResponseSchema,
  JSON_BODY_LIMIT_BYTES,
  REQUEST_ID_HEADER,
  paginatedResponse,
  buildOpenApiDocument,
} from "@algoforge/contracts";
import { z } from "zod";

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

import { errorHandler } from "../middleware/error-handler";
import { notFoundHandler } from "../middleware/not-found";
import { requestId } from "../middleware/request-id";
import openapiRouter from "../routes/openapi";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";

let server: http.Server;
let base = "";

beforeAll(async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: JSON_BODY_LIMIT_BYTES }));
  app.use(openapiRouter);
  app.post("/echo", (_req, res) => res.json({ ok: true }));
  app.get("/missing", () => {
    throw AppError.notFound("Thing not found.");
  });
  app.get("/invalid", () => {
    throw AppError.badRequest("Bad input.", [{ path: "code", message: "Too long." }]);
  });
  app.get("/crash", () => {
    throw new Error("internal secret detail");
  });
  app.get("/list", (_req, res) => {
    const { items, meta } = paginate([{ id: "a" }, { id: "b" }, { id: "c" }], 2, (r) => r.id);
    res.json({ data: items, meta });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.restoreAllMocks();
});

async function errorBody(res: Response) {
  const parsed = ErrorResponseSchema.safeParse(await res.json());
  expect(parsed.success).toBe(true);
  return parsed.success ? parsed.data : null;
}

describe("one error envelope on every failure", () => {
  it("covers 404 (route), 404 (resource), 400 with details, 400 malformed JSON, 413 and 500", async () => {
    const route = await fetch(`${base}/nope`);
    expect(route.status).toBe(404);
    expect((await errorBody(route))?.error.code).toBe("NOT_FOUND");

    const missing = await fetch(`${base}/missing`);
    expect(missing.status).toBe(404);
    expect((await errorBody(missing))?.error.message).toBe("Thing not found.");

    const invalid = await fetch(`${base}/invalid`);
    expect(invalid.status).toBe(400);
    expect((await errorBody(invalid))?.error.details).toEqual([{ path: "code", message: "Too long." }]);

    const malformed = await fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
    expect(malformed.status).toBe(400);
    expect((await errorBody(malformed))?.error.message).toBe("Malformed JSON body.");

    const big = await fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blob: "a".repeat(JSON_BODY_LIMIT_BYTES + 10) }) });
    expect(big.status).toBe(413);
    expect((await errorBody(big))?.error.code).toBe("PAYLOAD_TOO_LARGE");

    const crash = await fetch(`${base}/crash`);
    expect(crash.status).toBe(500);
    const crashBody = await errorBody(crash);
    expect(crashBody?.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(crashBody)).not.toContain("internal secret detail");
  });

  it("accepts a body at the largest code size the contract allows", async () => {
    const res = await fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "a".repeat(20_000) }) });
    expect(res.status).toBe(200);
  });
});

describe("X-Request-Id", () => {
  it("is present on success and error responses", async () => {
    for (const path of ["/list", "/missing", "/nope"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.headers.get(REQUEST_ID_HEADER)).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    }
  });
  it("echoes a safe incoming id and replaces an unsafe one", async () => {
    const safe = await fetch(`${base}/list`, { headers: { [REQUEST_ID_HEADER]: "client-id-12345" } });
    expect(safe.headers.get(REQUEST_ID_HEADER)).toBe("client-id-12345");
    const unsafe = await fetch(`${base}/list`, { headers: { [REQUEST_ID_HEADER]: "bad id with spaces" } });
    expect(unsafe.headers.get(REQUEST_ID_HEADER)).not.toBe("bad id with spaces");
  });
});

describe("pagination envelope", () => {
  it("validates against paginatedResponse", async () => {
    const body = paginatedResponse(z.object({ id: z.string() })).parse(await (await fetch(`${base}/list`)).json());
    expect(body).toEqual({ data: [{ id: "a" }, { id: "b" }], meta: { hasMore: true, nextCursor: "b" } });
  });
});

describe("OpenAPI endpoint", () => {
  it("serves the document generated from the contracts", async () => {
    const res = await fetch(`${base}/openapi.json`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).sort()).toEqual(Object.keys(buildOpenApiDocument().paths).sort());
  });
});
