import { z } from "zod";
import { ACCESS_COOKIE_NAME, CSRF_HEADER_NAME, REQUEST_ID_HEADER, RETRY_AFTER_HEADER } from "./common";
import { SCHEMA_REGISTRY } from "./registry";
import { routes, type RouteDef } from "./routes";

type JsonObject = Record<string, unknown>;
export type OpenApiDocument = JsonObject & { openapi: "3.1.0"; paths: Record<string, JsonObject>; components: JsonObject };

export interface OpenApiOptions {
  title?: string;
  version?: string;
  serverUrl?: string;
}

const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: "OK", 201: "Created", 204: "No Content", 302: "Found", 400: "Bad request", 401: "Not signed in", 403: "Forbidden",
  404: "Not found", 413: "Payload too large", 429: "Too many requests", 500: "Unexpected error", 503: "Not ready",
};

const refNames = new Map<z.ZodType, string>(Object.entries(SCHEMA_REGISTRY).map(([name, schema]) => [schema, name]));

function jsonSchemaOf(schema: z.ZodType, io: "input" | "output"): JsonObject {
  const raw: JsonObject = { ...z.toJSONSchema(schema, { io, unrepresentable: "any" }) };
  delete raw.$schema;
  return raw;
}

function schemaOrRef(schema: z.ZodType, io: "input" | "output"): JsonObject {
  const name = refNames.get(schema);
  return name ? { $ref: `#/components/schemas/${name}` } : jsonSchemaOf(schema, io);
}

function parametersOf(location: "path" | "query", schema: z.ZodType): JsonObject[] {
  const json = jsonSchemaOf(schema, "output");
  const props = (json.properties ?? {}) as Record<string, JsonObject>;
  const required = new Set<string>(Array.isArray(json.required) ? (json.required as string[]) : []);
  return Object.entries(props).map(([name, s]) => ({ name, in: location, required: location === "path" || required.has(name), schema: s }));
}

const requestIdHeader = { [REQUEST_ID_HEADER]: { description: "Correlation id for this request.", schema: { type: "string" } } };

function describeResponse(status: number, body: JsonObject | null): JsonObject {
  const headers: JsonObject = { ...requestIdHeader };
  if (status === 429) headers[RETRY_AFTER_HEADER] = { description: "Seconds to wait before retrying.", schema: { type: "integer" } };
  return { description: STATUS_TEXT[status] ?? String(status), headers, ...(body ? { content: { "application/json": { schema: body } } } : {}) };
}

function errorStatuses(route: RouteDef): number[] {
  const s = new Set<number>([500]);
  if (route.params || route.query || route.body) s.add(400);
  if (route.body) s.add(413);
  if (route.auth === "user" || route.auth === "admin") s.add(401);
  if (route.auth === "admin" || route.csrf) s.add(403);
  if (route.path.includes("{")) s.add(404);
  if (route.rateLimit) s.add(429);
  for (const code of Object.keys(route.responses)) s.delete(Number(code));
  return [...s].sort((a, b) => a - b);
}

function securityOf(route: RouteDef): JsonObject[] | undefined {
  if (route.auth === "optional") return [{}, { cookieAuth: [] }];
  if (route.auth === "user" || route.auth === "admin") return [route.csrf ? { cookieAuth: [], csrfHeader: [] } : { cookieAuth: [] }];
  if (route.csrf) return [{ csrfHeader: [] }];
  return undefined;
}

function operationOf(route: RouteDef): JsonObject {
  const responses: Record<string, JsonObject> = {};
  for (const [status, res] of Object.entries(route.responses)) {
    responses[status] = describeResponse(Number(status), res === "empty" ? null : schemaOrRef(res, "output"));
  }
  for (const status of errorStatuses(route)) responses[String(status)] = describeResponse(status, { $ref: "#/components/schemas/ErrorResponse" });
  const parameters = [...(route.params ? parametersOf("path", route.params) : []), ...(route.query ? parametersOf("query", route.query) : [])];
  const security = securityOf(route);
  return {
    operationId: route.id,
    summary: route.summary,
    tags: [route.tag],
    ...(route.notes ? { description: route.notes } : {}),
    ...(route.rateLimit ? { "x-rate-limit": route.rateLimit } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(route.body ? { requestBody: { required: true, content: { "application/json": { schema: schemaOrRef(route.body, "input") } } } } : {}),
    responses,
    ...(security ? { security } : {}),
  };
}

export function buildOpenApiDocument(options: OpenApiOptions = {}): OpenApiDocument {
  const paths: Record<string, JsonObject> = {};
  for (const route of routes) {
    const item = paths[route.path] ?? {};
    item[route.method] = operationOf(route);
    paths[route.path] = item;
  }
  const schemas: Record<string, JsonObject> = {};
  for (const [name, schema] of Object.entries(SCHEMA_REGISTRY)) schemas[name] = jsonSchemaOf(schema, name.endsWith("Request") ? "input" : "output");

  return {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "AlgoForge API",
      version: options.version ?? "1.0.0",
      description:
        "Generated from @algoforge/contracts. Single resources are plain objects; lists are { data } and paginated lists are { data, meta: { nextCursor, hasMore } }. Dates are ISO 8601 UTC. Errors use { error: { code, message, details? } }. Every response carries X-Request-Id.",
    },
    servers: [{ url: options.serverUrl ?? "/" }],
    tags: [...new Set(routes.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      schemas,
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: ACCESS_COOKIE_NAME },
        csrfHeader: { type: "apiKey", in: "header", name: CSRF_HEADER_NAME },
      },
    },
  };
}
