import { Request, Response } from "express";
import { authCookies, env } from "../config/env";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";
import {
  clearAuthCookies,
  clearOAuthStateCookie,
  getCookie,
  setAuthCookies,
  setOAuthStateCookie,
} from "../utils/cookies";
import { logger, serializeError } from "../utils/logger";
import { ensureString } from "../validation/common";

class AuthController {
  startGoogleAuth = asyncHandler(async (_req: Request, res: Response) => {
    const { url, state } = authService.buildGoogleAuthorizationUrl();
    setOAuthStateCookie(res, state);
    res.redirect(url);
  });

  handleGoogleCallback = asyncHandler(async (req: Request, res: Response) => {
    try {
      const state         = ensureString(req.query.state, "OAuth state is missing.");
      const code          = ensureString(req.query.code, "Authorization code is missing.");
      const expectedState = getCookie(req, authCookies.oauthState);

      clearOAuthStateCookie(res);

      if (!expectedState || expectedState !== state) {
        throw AppError.unauthorized("Invalid OAuth state.");
      }

      const authResult = await authService.authenticateGoogleCallback(code, {
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });

      setAuthCookies(res, authResult);
      res.redirect(`${env.webAppUrl}/`);
    } catch (error) {
      clearOAuthStateCookie(res);
      clearAuthCookies(res);
      logger.warn("oauth callback failed", {
        requestId: req.requestId,
        ...serializeError(error),
      });
      res.redirect(`${env.webAppUrl}/?authError=oauth_failed`);
    }
  });

  getMe = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUserById(req.auth!.user.id);

    if (!user) {
      throw AppError.notFound("User not found.");
    }

    res.json({ user });
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
    res.json({ user: authResult.user });
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
}

export const authController = new AuthController();
