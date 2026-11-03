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
  // NOTE: hard-coded default kept on purpose; removed in Phase 2 (S-04).
  adminUpgradeSecret:
    process.env.ADMIN_UPGRADE_SECRET ?? "1d201bf1-eb81-42ec-bd13-3e627b0fc4e9",
  ai: {
    provider: aiProvider as AIProvider,
    model: aiModel,
    timeoutMs: parseInteger("AI_TIMEOUT_MS", 15000),
    maxRetries: parseInteger("AI_MAX_RETRIES", 1),
  },
  openRouter: {
    baseUrl:
      process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    apiKeys: openRouterApiKeys,
    freeModels: openRouterFreeModels,
    appName: process.env.OPENROUTER_APP_NAME ?? "AlgoForge",
    siteUrl: process.env.OPENROUTER_SITE_URL ?? process.env.WEB_APP_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    ttlSeconds: parseInteger("REDIS_CACHE_TTL_SECONDS", 3600),
    aiRateLimitPerHour: parseInteger("AI_RATE_LIMIT_PER_HOUR", 5),
    defaultRateLimitPerMinute: parseInteger("DEFAULT_RATE_LIMIT_PER_MINUTE", 10),
  },
};

export const authCookies = {
  accessToken: "af_access",
  refreshToken: "af_refresh",
  csrfToken: "af_csrf",
  oauthState: "af_oauth_state",
} as const;

export const googleOAuthConfig = {
  redirectUri: `${apiBaseUrl}/api/auth/google/callback`,
  scopes: ["openid", "email", "profile"],
};
