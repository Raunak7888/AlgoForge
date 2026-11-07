import dotenv from "dotenv";

dotenv.config();

const AI_PROVIDERS = ["gemini", "openrouter"] as const;
type AIProvider = (typeof AI_PROVIDERS)[number];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Environment variable ${name} must be a positive integer (got "${rawValue}").`,
    );
  }
  return parsed;
}

function parseStringEnum<T extends string>(
  name: string,
  allowedValues: readonly T[],
  fallback: T,
): T {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;
  if (!allowedValues.includes(rawValue as T))
    throw new Error(
      `Environment variable ${name} must be one of: ${allowedValues.join(", ")}.`,
    );
  return rawValue as T;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue.trim() === "") return fallback;
  const value = rawValue.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`Environment variable ${name} must be true or false (got "${rawValue}").`);
}

function parseList(name: string): string[] {
  const rawValue = process.env[name];
  if (!rawValue) return [];
  return rawValue
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const port = parseInteger("PORT", 4000);
const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
const apiBaseUrl = process.env.API_BASE_URL ?? `http://localhost:${port}`;
const aiProvider = parseStringEnum("AI_PROVIDER", AI_PROVIDERS, "gemini");

// Provider-specific validation: only the selected provider's settings are required.
const openRouterApiKeys = parseList("OPENROUTER_API_KEYS");
const openRouterFreeModels = parseList("OPENROUTER_FREE_MODELS");
if (aiProvider === "openrouter") {
  if (openRouterApiKeys.length === 0)
    throw new Error("OPENROUTER_API_KEYS must be set when AI_PROVIDER=openrouter.");
  if (openRouterFreeModels.length === 0)
    throw new Error("OPENROUTER_FREE_MODELS must be set when AI_PROVIDER=openrouter.");
}
const geminiApiKey =
  aiProvider === "gemini" ? requireEnv("GEMINI_API_KEY") : (process.env.GEMINI_API_KEY ?? "");
// No hard-coded model: it must be chosen explicitly when Gemini is the provider.
const aiModel = aiProvider === "gemini" ? requireEnv("AI_MODEL") : (process.env.AI_MODEL ?? "");

export const env = {
  nodeEnv,
  isProduction,
  port,
  apiBaseUrl,
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:3000",
  cookieDomain: process.env.COOKIE_DOMAIN,
  googleClientId: requireEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
  accessTokenTtlMinutes: parseInteger("ACCESS_TOKEN_TTL_MINUTES", 15),
  refreshTokenTtlDays: parseInteger("REFRESH_TOKEN_TTL_DAYS", 30),
  authIssuer: process.env.AUTH_ISSUER ?? "algoforge-api",
  authAudience: process.env.AUTH_AUDIENCE ?? "algoforge-web",
  geminiApiKey,
  ai: {
    provider: aiProvider as AIProvider,
    model: aiModel,
    timeoutMs: parseInteger("AI_TIMEOUT_MS", 15000),
    maxRetries: parseInteger("AI_MAX_RETRIES", 1),
    /** Analysis returns a large JSON document, so it gets a longer, separate timeout (abortable). */
    analysisTimeoutMs: parseInteger("AI_ANALYSIS_TIMEOUT_MS", 45000),
    analysisMaxOutputTokens: parseInteger("AI_ANALYSIS_MAX_OUTPUT_TOKENS", 4096),
    textMaxOutputTokens: parseInteger("AI_TEXT_MAX_OUTPUT_TOKENS", 1024),
    /** The assistant writes explanations and code, so it gets more time and room than the generic text helper. */
    assistantTimeoutMs: parseInteger("AI_ASSISTANT_TIMEOUT_MS", 30000),
    assistantMaxOutputTokens: parseInteger("AI_ASSISTANT_MAX_OUTPUT_TOKENS", 2048),
  },
  openRouter: {
    baseUrl:
      process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKeys: openRouterApiKeys,
    freeModels: openRouterFreeModels,
    appName: process.env.OPENROUTER_APP_NAME ?? "AlgoForge",
    siteUrl: process.env.OPENROUTER_SITE_URL ?? process.env.WEB_APP_URL,
  },
  quotas: {
    /** Billable (uncached) analyses per user. Cache hits never use quota. */
    analysisPerMinute: parseInteger("AI_ANALYSIS_PER_MINUTE", 3),
    analysisPerDay: parseInteger("AI_ANALYSIS_PER_DAY", 30),
    /** Assistant messages (AiUsage feature "session"). */
    assistantPerMinute: parseInteger("AI_ASSISTANT_PER_MINUTE", 10),
    assistantPerDay: parseInteger("AI_ASSISTANT_PER_DAY", 100),
  },
  session: {
    /** A session's lastUsedAt is written at most this often. */
    lastUsedThrottleMinutes: parseInteger("SESSION_LAST_USED_THROTTLE_MINUTES", 5),
    cleanupEnabled: parseBoolean("SESSION_CLEANUP_ENABLED", true),
    cleanupIntervalMinutes: parseInteger("SESSION_CLEANUP_INTERVAL_MINUTES", 60),
    /** Revoked sessions are kept this long (refresh-token reuse detection), expired ones are removed at once. */
    revokedRetentionDays: parseInteger("SESSION_REVOKED_RETENTION_DAYS", 7),
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    ttlSeconds: parseInteger("REDIS_CACHE_TTL_SECONDS", 3600),
    aiRateLimitPerHour: parseInteger("AI_RATE_LIMIT_PER_HOUR", 5),
    defaultRateLimitPerMinute: parseInteger("DEFAULT_RATE_LIMIT_PER_MINUTE", 10),
    /** Catalog and search are cheap, cached reads: a dashboard plus a catalog page must not hit the analysis limit (A-13). */
    catalogRateLimitPerMinute: parseInteger("CATALOG_RATE_LIMIT_PER_MINUTE", 120),
    visualizationRateLimitPerMinute: parseInteger("VISUALIZATION_RATE_LIMIT_PER_MINUTE", 60),
  },
};

export const authCookies = {
  accessToken: "af_access",
  refreshToken: "af_refresh",
  csrfToken: "af_csrf",
  oauthState: "af_oauth_state",
  returnTo: "af_return_to",
} as const;

export const googleOAuthConfig = {
  redirectUri: `${apiBaseUrl}/api/auth/google/callback`,
  scopes: ["openid", "email", "profile"],
};
