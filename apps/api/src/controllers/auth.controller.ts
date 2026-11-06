import { Request, Response } from "express";
import {
  RETURN_TO_PARAM,
  appendAuthError,
  sanitizeReturnTo,
  type AuthErrorCode,
  type DeviceSession,
  type MeResponse,
  type RefreshResponse,
} from "@algoforge/contracts";
import { authCookies, env } from "../config/env";
import { serializeAuthUser, serializeDeviceSession } from "../serializers/auth";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import {
  clearAuthCookies,
  clearOAuthStateCookie,
  clearReturnToCookie,
  getCookie,
  setAuthCookies,
  setOAuthStateCookie,
  setReturnToCookie,
} from "../utils/cookies";
import { logger, serializeError } from "../utils/logger";
import { ensureString } from "../validation/common";

class AuthController {
  /** GET /api/auth/google/start?returnTo=/dashboard. The return path is validated before it is stored. */
  startGoogleAuth = asyncHandler(async (req: Request, res: Response) => {
    const { url, state } = authService.buildGoogleAuthorizationUrl();
    setOAuthStateCookie(res, state);
    setReturnToCookie(res, sanitizeReturnTo(req.query[RETURN_TO_PARAM]));
    res.redirect(url);
  });

  handleGoogleCallback = asyncHandler(async (req: Request, res: Response) => {
    // Validated again on the way out: the cookie is only as trustworthy as the browser that holds it.
    const returnTo = sanitizeReturnTo(getCookie(req, authCookies.returnTo));
    const expectedState = getCookie(req, authCookies.oauthState);

    clearOAuthStateCookie(res);
    clearReturnToCookie(res);

    const redirectWithError = (code: AuthErrorCode): void => {
      res.redirect(`${env.webAppUrl}${appendAuthError(returnTo, code)}`);
    };

    // The person pressed "Cancel" on Google's consent screen.
    if (typeof req.query.error === "string") {
      logger.info("oauth callback declined", { requestId: req.requestId, reason: req.query.error });
      redirectWithError("oauth_denied");
      return;
    }

    try {
      const state    = ensureString(req.query.state, "OAuth state is missing.");
      const authCode = ensureString(req.query.code, "Authorization code is missing.");

      if (!expectedState || expectedState !== state) {
        throw AppError.unauthorized("Invalid OAuth state.");
      }

      const authResult = await authService.authenticateGoogleCallback(authCode, {
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });

      setAuthCookies(res, authResult);
      res.redirect(`${env.webAppUrl}${returnTo}`);
    } catch (error) {
      clearAuthCookies(res);
      logger.warn("oauth callback failed", {
        requestId: req.requestId,
        ...serializeError(error),
      });
      redirectWithError("oauth_failed");
    }
  });

  getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getAuthUser(req.auth!.user.id);

    if (!user) {
      throw AppError.notFound("User not found.");
    }

    const body: MeResponse = { user: serializeAuthUser(user) };
    res.json(body);
  });

  refreshSession = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = getCookie(req, authCookies.refreshToken);

    if (!refreshToken) {
      clearAuthCookies(res);
      throw AppError.unauthorized("Refresh token is missing.");
    }

    const authResult = await authService.rotateRefreshToken(refreshToken, {
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });

    setAuthCookies(res, authResult);
    const body: RefreshResponse = { user: serializeAuthUser(authResult.user) };
    res.json(body);
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = getCookie(req, authCookies.refreshToken);

    if (refreshToken) {
      await authService.revokeSessionByRefreshToken(refreshToken);
    }

    clearAuthCookies(res);
    res.status(204).send();
  });

  logoutAll = asyncHandler(async (req: Request, res: Response) => {
    await authService.revokeAllUserSessions(req.auth!.user.id);
    clearAuthCookies(res);
    res.status(204).send();
  });

  /** GET /api/auth/sessions: every device that is currently signed in, with the caller's own marked. */
  listSessions = asyncHandler(async (req: Request, res: Response) => {
    const rows = await authService.listDeviceSessions(req.auth!.user.id);
    const currentId = req.auth!.session.id;
    const data: DeviceSession[] = rows.map((row) => serializeDeviceSession(row, currentId));
    res.json({ data });
  });

  /** DELETE /api/auth/sessions/:id: signs out one device. Revoking the current one also clears this browser's cookies. */
  revokeSession = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const revoked = await authService.revokeDeviceSession(req.auth!.user.id, id);
    if (!revoked) throw AppError.notFound("Session not found.");
    if (id === req.auth!.session.id) clearAuthCookies(res);
    res.status(204).send();
  });
}

export const authController = new AuthController();
