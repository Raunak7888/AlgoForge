import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CSRF_HEADER_NAME } from "@algoforge/contracts";
import { createApiClient, parseRetryAfter } from "./client";
import { readCookie } from "./csrf";
import { resolveApiBaseUrl } from "./config";
import { ApiError, NetworkError, ResponseValidationError, errorMessage } from "./errors";
import { retryDelayMs, shouldRetry } from "../query/queryClient";

const Item = z.object({ id: z.string() });
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
function client(handler: Handler, extra: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  };
  return { api: createApiClient({ baseUrl: "http://api.test", fetchImpl, getCsrfToken: () => "csrf-1", sleep: async () => undefined, ...extra }), calls };
}

describe("config and csrf helpers", () => {
  it("normalizes the base url", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("");
    expect(resolveApiBaseUrl("  http://localhost:4000/// ")).toBe("http://localhost:4000");
  });
  it("reads a cookie by name", () => {
    expect(readCookie("a=1; af_csrf=tok%20en; b=2", "af_csrf")).toBe("tok en");
    expect(readCookie("a=1", "af_csrf")).toBeNull();
  });
  it("parses Retry-After seconds and dates", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(new Date(1_000_000 + 7_000).toUTCString(), 1_000_000)).toBeGreaterThanOrEqual(6);
  });
});

describe("requests", () => {
  it("sends credentials, builds the query and validates the response", async () => {
    const { api, calls } = client(() => json(200, { id: "a" }));
    const out = await api.get("/api/x", Item, { query: { limit: 5, cursor: undefined, q: "" } });
    expect(out).toEqual({ id: "a" });
    expect(calls[0]?.url).toBe("http://api.test/api/x?limit=5");
    expect(calls[0]?.init.credentials).toBe("include");
  });

  it("adds the CSRF header to mutations only", async () => {
    const { api, calls } = client(() => json(200, { id: "a" }));
    await api.get("/api/x", Item);
    await api.post("/api/x", Item, { a: 1 });
    const headerOf = (i: number) => (calls[i]?.init.headers as Record<string, string>)[CSRF_HEADER_NAME];
    expect(headerOf(0)).toBeUndefined();
    expect(headerOf(1)).toBe("csrf-1");
  });

  it("throws ResponseValidationError when the body breaks the contract", async () => {
    const { api } = client(() => json(200, { nope: true }));
    await expect(api.get("/api/x", Item)).rejects.toBeInstanceOf(ResponseValidationError);
  });

  it("maps the typed error envelope, request id and details", async () => {
    const { api } = client(() => json(400, { error: { code: "BAD_REQUEST", message: "Bad.", details: [{ path: "code", message: "Too long." }] } }, { "X-Request-Id": "rid-12345678" }));
    const error = await api.get("/api/x", Item).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "BAD_REQUEST", requestId: "rid-12345678", details: [{ path: "code", message: "Too long." }] });
  });

  it("falls back to a status-based error for a non-envelope body", async () => {
    const { api } = client(() => new Response("<html>", { status: 502 }));
    expect(await api.get("/api/x", Item).catch((e: unknown) => e)).toMatchObject({ status: 502, code: "BAD_GATEWAY" });
  });

  it("wraps a failed fetch as NetworkError", async () => {
    const api = createApiClient({ baseUrl: "http://api.test", fetchImpl: () => Promise.reject(new TypeError("fail")), getCsrfToken: () => null });
    await expect(api.get("/api/x", Item)).rejects.toBeInstanceOf(NetworkError);
  });

  it("returns nothing for 204 responses", async () => {
    const { api } = client(() => new Response(null, { status: 204 }));
    await expect(api.delete("/api/x/1")).resolves.toBeUndefined();
  });
});

describe("401 refresh", () => {
  it("refreshes once and retries the request once", async () => {
    let calls401 = 0;
    const { api, calls } = client((url) => {
      if (url.endsWith("/api/auth/refresh")) return json(200, { user: {} });
      if (calls401++ === 0) return json(401, { error: { code: "UNAUTHORIZED", message: "x" } });
      return json(200, { id: "a" });
    });
    expect(await api.get("/api/x", Item)).toEqual({ id: "a" });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(["/api/x", "/api/auth/refresh", "/api/x"]);
  });

  it("shares one refresh between concurrent 401s", async () => {
    const seen = new Set<string>();
    const { api, calls } = client((url) => {
      if (url.endsWith("/api/auth/refresh")) return json(200, { user: {} });
      if (!seen.has(url)) {
        seen.add(url);
        return json(401, { error: { code: "UNAUTHORIZED", message: "x" } });
      }
      return json(200, { id: "a" });
    });
    await Promise.all([api.get("/api/a", Item), api.get("/api/b", Item), api.get("/api/c", Item)]);
    expect(calls.filter((c) => c.url.endsWith("/api/auth/refresh"))).toHaveLength(1);
  });

  it("gives up after one retry and reports the expired session", async () => {
    const onSessionExpired = vi.fn();
    const { api, calls } = client(
      (url) => (url.endsWith("/api/auth/refresh") ? json(200, { user: {} }) : json(401, { error: { code: "UNAUTHORIZED", message: "x" } })),
      { onSessionExpired },
    );
    await expect(api.get("/api/x", Item)).rejects.toMatchObject({ status: 401 });
    expect(calls.filter((c) => c.url.endsWith("/api/x"))).toHaveLength(2);
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it("does not loop when the refresh itself is rejected", async () => {
    const { api, calls } = client((url) => (url.endsWith("/api/auth/refresh") ? json(401, { error: { code: "UNAUTHORIZED", message: "x" } }) : json(401, { error: { code: "UNAUTHORIZED", message: "x" } })));
    await expect(api.get("/api/x", Item)).rejects.toMatchObject({ status: 401 });
    expect(calls.filter((c) => c.url.endsWith("/api/auth/refresh"))).toHaveLength(1);
  });

  it("never tries to refresh for a refresh or sign-in path", async () => {
    const { api, calls } = client(() => json(401, { error: { code: "UNAUTHORIZED", message: "x" } }));
    await expect(api.postEmpty("/api/auth/refresh")).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
  });
});

describe("429 handling", () => {
  const limited = (retry: string) => json(429, { error: { code: "TOO_MANY_REQUESTS", message: "slow" } }, { "Retry-After": retry });

  it("retries a GET once when the hint is short", async () => {
    let n = 0;
    const sleep = vi.fn(async () => undefined);
    const { api, calls } = client(() => (n++ === 0 ? limited("2") : json(200, { id: "a" })), { sleep });
    expect(await api.get("/api/x", Item)).toEqual({ id: "a" });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(calls).toHaveLength(2);
  });

  it("surfaces a long hint instead of waiting", async () => {
    const { api, calls } = client(() => limited("60"));
    const error = await api.get("/api/x", Item).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429, retryAfterSeconds: 60 });
    expect(errorMessage(error)).toContain("60s");
    expect(calls).toHaveLength(1);
  });

  it("never auto-retries a mutation", async () => {
    const { api, calls } = client(() => limited("1"));
    await expect(api.post("/api/x", Item, {})).rejects.toMatchObject({ status: 429 });
    expect(calls).toHaveLength(1);
  });
});

describe("query retry policy", () => {
  const api429 = new ApiError({ status: 429, code: "TOO_MANY_REQUESTS", message: "x", retryAfterSeconds: 9 });
  it("retries transient failures only, and not forever", () => {
    expect(shouldRetry(0, new NetworkError())).toBe(true);
    expect(shouldRetry(0, api429)).toBe(true);
    expect(shouldRetry(0, new ApiError({ status: 503, code: "BAD_GATEWAY", message: "x" }))).toBe(true);
    expect(shouldRetry(0, new ApiError({ status: 404, code: "NOT_FOUND", message: "x" }))).toBe(false);
    expect(shouldRetry(0, new ResponseValidationError("/x", []))).toBe(false);
    expect(shouldRetry(2, new NetworkError())).toBe(false);
  });
  it("waits for the server hint on 429", () => {
    expect(retryDelayMs(0, api429)).toBe(9000);
    expect(retryDelayMs(1, new NetworkError())).toBe(2000);
  });
});
