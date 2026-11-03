//# filename: apps/api/src/middleware/auth.ts

import { NextFunction, Request, Response } from "express";
import { Role } from "@algoforge/db";
import { authCookies } from "../config/env";
import { authService } from "../services/auth.service";
import { AppError } from "../utils/app-error";
import { getCookie } from "../utils/cookies";

export function getToken(req: Request): string | null {
  const cookieToken = getCookie(req, authCookies.accessToken);
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return null;
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const accessToken = getToken(req);
    if (!accessToken) {
      return next(AppError.unauthorized("Authentication required."));
    }
    req.auth = await authService.authenticateAccessToken(accessToken);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Attaches `req.auth` when a valid session is present, but never rejects.
 * Used by public routes whose output depends on who is asking (e.g. drafts for admins).
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const accessToken = getToken(req);
  if (accessToken) {
    try {
      req.auth = await authService.authenticateAccessToken(accessToken);
    } catch {
      // invalid or expired token: treat the caller as anonymous
    }
  }
  next();
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(AppError.unauthorized("Authentication required."));
    }
    if (!roles.includes(req.auth.user.role)) {
      return next(AppError.forbidden("Insufficient permissions."));
    }
    next();
  };
}
