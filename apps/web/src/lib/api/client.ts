import { z } from "zod";
import { CSRF_HEADER_NAME, ERROR_CODES, ErrorResponseSchema, REQUEST_ID_HEADER, RETRY_AFTER_HEADER, type ErrorCode } from "@algoforge/contracts";
import { API_BASE_URL } from "./config";
import { getCsrfToken } from "./csrf";
import { ApiError, NetworkError, ResponseValidationError } from "./errors";
import { notifySessionExpired } from "../auth/sessionEvents";

export type QueryParams = Readonly<Record<string, string | number | boolean | null | undefined>>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getCsrfToken?: () => string | null;
  /** Called when a 401 could not be fixed by refreshing the session (Phase 4 uses it to show sign-in). */
  onSessionExpired?: () => void;
  /** A GET that gets a 429 with a Retry-After at most this long is retried once automatically. */
  maxAutoRetryWaitSeconds?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";
const REFRESH_PATH = "/api/auth/refresh";
const NO_REFRESH_PREFIXES = [REFRESH_PATH, "/api/auth/google/"];
const MUTATING: ReadonlySet<Method> = new Set<Method>(["POST", "PATCH", "DELETE"]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const CODE_FOR_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE", 429: "TOO_MANY_REQUESTS", 502: "BAD_GATEWAY",
};
const isErrorCode = (value: string): value is ErrorCode => (ERROR_CODES as readonly string[]).includes(value);

/** Retry-After is either a number of seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}

function buildQuery(query: QueryParams | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function toApiError(res: Response): Promise<ApiError> {
  const requestId = res.headers.get(REQUEST_ID_HEADER);
  const retryAfterSeconds = parseRetryAfter(res.headers.get(RETRY_AFTER_HEADER));
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const parsed = ErrorResponseSchema.safeParse(payload);
  if (parsed.success) {
    const { code, message, details, quota, retryAfterSeconds: bodyRetry } = parsed.data.error;
    return new ApiError({ status: res.status, code, message, details, requestId, retryAfterSeconds: retryAfterSeconds ?? bodyRetry ?? null, quota: quota ?? null });
  }
  const code = CODE_FOR_STATUS[res.status] ?? "INTERNAL_ERROR";
  return new ApiError({ status: res.status, code: isErrorCode(code) ? code : "INTERNAL_ERROR", message: res.statusText || "Request failed.", requestId, retryAfterSeconds });
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? API_BASE_URL).replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const csrfToken = options.getCsrfToken ?? getCsrfToken;
  const sleep = options.sleep ?? defaultSleep;
  const maxAutoRetryWait = options.maxAutoRetryWaitSeconds ?? 5;

  async function transport(method: Method, path: string, body: unknown, query: QueryParams | undefined, signal: AbortSignal | undefined): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (MUTATING.has(method)) {
      const token = csrfToken(); // read per attempt: a refresh rotates the cookie
      if (token) headers[CSRF_HEADER_NAME] = token;
    }
    try {
      return await doFetch(`${baseUrl}${path}${buildQuery(query)}`, {
        method,
        headers,
        credentials: "include",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new NetworkError(undefined, { cause: error });
    }
  }

  // Single-flight: concurrent 401s share one refresh request.
  let refreshing: Promise<boolean> | null = null;
  function refreshSession(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const res = await transport("POST", REFRESH_PATH, undefined, undefined, undefined);
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function execute(method: Method, path: string, body: unknown, opts: RequestOptions): Promise<Response> {
    let res = await transport(method, path, body, opts.query, opts.signal);

    if (res.status === 401 && !NO_REFRESH_PREFIXES.some((p) => path.startsWith(p))) {
      if (await refreshSession()) res = await transport(method, path, body, opts.query, opts.signal); // exactly one retry
      if (res.status === 401) options.onSessionExpired?.();
    }

    if (res.status === 429 && method === "GET") {
      const wait = parseRetryAfter(res.headers.get(RETRY_AFTER_HEADER));
      if (wait !== null && wait <= maxAutoRetryWait) {
        await sleep(wait * 1000);
        res = await transport(method, path, body, opts.query, opts.signal);
      }
    }

    if (!res.ok) throw await toApiError(res);
    return res;
  }

  async function parseBody<S extends z.ZodType>(res: Response, path: string, schema: S): Promise<z.output<S>> {
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new ResponseValidationError(path, [{ path: "", message: "The response body was not valid JSON." }]);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ResponseValidationError(path, parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })));
    }
    return parsed.data;
  }

  return {
    get: async <S extends z.ZodType>(path: string, schema: S, opts: RequestOptions = {}): Promise<z.output<S>> =>
      parseBody(await execute("GET", path, undefined, opts), path, schema),
    post: async <S extends z.ZodType>(path: string, schema: S, body?: unknown, opts: RequestOptions = {}): Promise<z.output<S>> =>
      parseBody(await execute("POST", path, body, opts), path, schema),
    patch: async <S extends z.ZodType>(path: string, schema: S, body?: unknown, opts: RequestOptions = {}): Promise<z.output<S>> =>
      parseBody(await execute("PATCH", path, body, opts), path, schema),
    /** For endpoints that answer 204 with no body. */
    postEmpty: async (path: string, body?: unknown, opts: RequestOptions = {}): Promise<void> => {
      await execute("POST", path, body, opts);
    },
    delete: async (path: string, opts: RequestOptions = {}): Promise<void> => {
      await execute("DELETE", path, undefined, opts);
    },
    refreshSession,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app-wide client. When a 401 cannot be fixed by refreshing, the AuthProvider is told so it can show the guest state. */
export const apiClient: ApiClient = createApiClient({ onSessionExpired: notifySessionExpired });
