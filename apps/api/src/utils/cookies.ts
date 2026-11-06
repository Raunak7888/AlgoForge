import { Request, Response } from "express";
import { authCookies, env } from "../config/env";

type AuthCookieValues = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

const OAUTH_COOKIE_PATH = "/api/auth/google";
const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

function buildCookieOptions(
  maxAgeMs: number,
  httpOnly: boolean,
  path = "/",
) {
  return {
    httpOnly,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path,
    maxAge: maxAgeMs,
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
  };
}

export function getCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;

  const cookies = header.split(";").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = cookie.slice(0, separatorIndex);
    if (key !== name) continue;

    try {
      return decodeURIComponent(cookie.slice(separatorIndex + 1));
    } catch {
      return null;
    }
  }

  return null;
}

export function setAuthCookies(res: Response, values: AuthCookieValues): void {
  res.cookie(
    authCookies.accessToken,
    values.accessToken,
    buildCookieOptions(env.accessTokenTtlMinutes * 60 * 1000, true),
  );
  res.cookie(
    authCookies.refreshToken,
    values.refreshToken,
    buildCookieOptions(
      env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      true,
      "/api/auth",
    ),
  );
  res.cookie(
    authCookies.csrfToken,
    values.csrfToken,
    buildCookieOptions(env.refreshTokenTtlDays * 24 * 60 * 60 * 1000, false),
  );
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(authCookies.accessToken, buildCookieOptions(0, true));
  res.clearCookie(
    authCookies.refreshToken,
    buildCookieOptions(0, true, "/api/auth"),
  );
  res.clearCookie(authCookies.csrfToken, buildCookieOptions(0, false));
}

export function setOAuthStateCookie(res: Response, state: string): void {
  res.cookie(
    authCookies.oauthState,
    state,
    buildCookieOptions(OAUTH_COOKIE_MAX_AGE_MS, true, OAUTH_COOKIE_PATH),
  );
}

export function clearOAuthStateCookie(res: Response): void {
  res.clearCookie(
    authCookies.oauthState,
    buildCookieOptions(0, true, OAUTH_COOKIE_PATH),
  );
}

/** The (already sanitized) path to return to after the OAuth round trip. */
export function setReturnToCookie(res: Response, returnTo: string): void {
  res.cookie(
    authCookies.returnTo,
    returnTo,
    buildCookieOptions(OAUTH_COOKIE_MAX_AGE_MS, true, OAUTH_COOKIE_PATH),
  );
}

export function clearReturnToCookie(res: Response): void {
  res.clearCookie(
    authCookies.returnTo,
    buildCookieOptions(0, true, OAUTH_COOKIE_PATH),
  );
}
