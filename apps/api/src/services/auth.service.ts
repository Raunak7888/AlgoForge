import { OAuth2Client } from "google-auth-library";
import { prisma, Role } from "@algoforge/db";
import { env, googleOAuthConfig } from "../config/env";
import { sessionRepository } from "../repositories/session.repository";
import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/app-error";
import { hashToken, randomToken, safeTokenEquals } from "../utils/crypto";
import { logger, serializeError } from "../utils/logger";
import { shouldTouchSession } from "../utils/session-activity";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../utils/token";

type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

type AuthenticatedUser = {
  id:       string;
  email:    string | null;
  username: string | null;
  name:     string | null;
  image:    string | null;
  role:     Role;
};

type SessionCookies = {
  accessToken:  string;
  refreshToken: string;
  csrfToken:    string;
};

type AuthResult = SessionCookies & { user: AuthenticatedUser };

const AUTH_USER_SELECT = {
  id:       true,
  email:    true,
  username: true,
  name:     true,
  image:    true,
  role:     true,
} as const;

const googleClient = new OAuth2Client(
  env.googleClientId,
  env.googleClientSecret,
  googleOAuthConfig.redirectUri,
);

class AuthService {
  buildGoogleAuthorizationUrl(): { url: string; state: string } {
    const state = randomToken(32);
    const url = googleClient.generateAuthUrl({
      access_type:            "offline",
      scope:                  googleOAuthConfig.scopes,
      include_granted_scopes: true,
      state,
      prompt:                 "select_account",
    });
    return { url, state };
  }

  async authenticateGoogleCallback(
    code: string,
    metadata: RequestMetadata,
  ): Promise<AuthResult> {
    const { tokens } = await googleClient.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) throw AppError.unauthorized("Google did not return an ID token.");

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw AppError.unauthorized("Google account data is invalid.");

    const user = await this.findOrCreateOAuthUser({
      provider:          "google",
      providerAccountId: payload.sub,
      email:             payload.email_verified ? (payload.email ?? null) : null,
      name:              payload.name ?? null,
      image:             payload.picture ?? null,
    });

    const result = await this.createSessionForUser(user, metadata);
    await this.recordLogin(user.id);
    return result;
  }

  async authenticateAccessToken(accessToken: string) {
    const payload = verifyAccessToken(accessToken);

    const session = await sessionRepository.findActiveById(
      payload.sessionId,
      payload.sub,
    );

    if (!session) throw AppError.unauthorized("Session is invalid.");

    this.touchSession(session.id, session.lastUsedAt);

    return {
      user:    session.user,
      session: { id: session.id, expiresAt: session.expiresAt },
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
    metadata: RequestMetadata,
  ): Promise<AuthResult> {
    const payload       = verifyRefreshToken(refreshToken);
    const presentedHash = hashToken(refreshToken);

    const session = await sessionRepository.findByIdWithUser(payload.sessionId);

    if (!session || session.userId !== payload.sub) {
      throw AppError.unauthorized("Refresh session is invalid.");
    }

    if (!safeTokenEquals(presentedHash, session.tokenHash)) {
      throw AppError.unauthorized("Refresh token is invalid.");
    }

    if (session.revokedAt) {
      await this.revokeAllUserSessions(session.userId);
      throw AppError.unauthorized("Refresh token reuse detected.");
    }

    if (session.expiresAt <= new Date()) {
      await sessionRepository.revokeById(session.id);
      throw AppError.unauthorized("Refresh token expired.");
    }

    const nextSessionId    = randomToken(24);
    const nextRefreshToken = signRefreshToken({ sub: session.user.id, sessionId: nextSessionId });

    const rotated = await sessionRepository.rotate(
      session.id,
      session.userId,
      presentedHash,
      {
        id:         nextSessionId,
        tokenHash:  hashToken(nextRefreshToken),
        expiresAt:  this.buildRefreshExpiry(),
        lastUsedAt: new Date(),
        ipAddress:  metadata.ipAddress,
        userAgent:  metadata.userAgent,
      },
    );

    if (!rotated) {
      // Distinguish a concurrent legitimate refresh from actual token theft.
      // If a successor session (rotatedFromId = session.id) already exists,
      // this was a race between two simultaneous refresh attempts: fail this
      // request gracefully without nuking all sessions.
      const successor = await sessionRepository.findRotatedFrom(session.id);
      if (successor) {
        throw AppError.unauthorized("Session already refreshed. Please retry.");
      }

      // No successor found: this looks like genuine token reuse after theft.
      await this.revokeAllUserSessions(session.userId);
      throw AppError.unauthorized("Refresh token reuse detected.");
    }

    const accessToken = signAccessToken({
      sub:       session.user.id,
      sessionId: nextSessionId,
      role:      session.user.role,
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      csrfToken:    randomToken(24),
      user:         session.user,
    };
  }

  async revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await sessionRepository.revokeById(payload.sessionId, payload.sub);
    } catch {
      return;
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await sessionRepository.revokeAllForUser(userId);
  }

  /** The devices currently signed in to this account. */
  async listDeviceSessions(userId: string) {
    return sessionRepository.listActiveForUser(userId, new Date());
  }

  /** Signs out one device. Returns false when the session does not belong to the user (or does not exist). */
  async revokeDeviceSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await sessionRepository.revokeById(sessionId, userId);
    return result.count > 0;
  }

  /** Records that the session is in use, at most once per throttle window. Never blocks or fails the request. */
  private touchSession(sessionId: string, lastUsedAt: Date): void {
    const now = new Date();
    const minIntervalMs = env.session.lastUsedThrottleMinutes * 60_000;
    if (!shouldTouchSession(lastUsedAt, now, minIntervalMs)) return;
    void sessionRepository.touchLastUsed(sessionId, now, minIntervalMs).catch((error: unknown) => {
      logger.warn("failed to update session activity", { sessionId, ...serializeError(error) });
    });
  }

  private async recordLogin(userId: string): Promise<void> {
    try {
      await userRepository.touchLastLogin(userId, new Date());
    } catch (error) {
      logger.warn("failed to record last login", { userId, ...serializeError(error) });
    }
  }

  private async createSessionForUser(
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<AuthResult> {
    const sessionId    = randomToken(24);
    const refreshToken = signRefreshToken({ sub: user.id, sessionId });

    await sessionRepository.create({
      id:         sessionId,
      userId:     user.id,
      tokenHash:  hashToken(refreshToken),
      expiresAt:  this.buildRefreshExpiry(),
      lastUsedAt: new Date(),
      ipAddress:  metadata.ipAddress,
      userAgent:  metadata.userAgent,
    });

    const accessToken = signAccessToken({
      sub:       user.id,
      sessionId,
      role:      user.role,
    });

    return { accessToken, refreshToken, csrfToken: randomToken(24), user };
  }

  private buildRefreshExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + env.refreshTokenTtlDays);
    return d;
  }

  /**
   * Signing in refreshes the avatar from Google but never overwrites a name the person already has,
   * so a name edited in the app is not lost at the next login.
   */
  private async findOrCreateOAuthUser(input: {
    provider:          string;
    providerAccountId: string;
    email:             string | null;
    name:              string | null;
    image:             string | null;
  }): Promise<AuthenticatedUser> {
    return prisma.$transaction(async (tx) => {
      const existingAccount = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider:          input.provider,
            providerAccountId: input.providerAccountId,
          },
        },
        include: { user: { select: AUTH_USER_SELECT } },
      });

      if (existingAccount) {
        return tx.user.update({
          where: { id: existingAccount.userId },
          data: {
            email: input.email ?? existingAccount.user.email,
            name:  existingAccount.user.name ?? input.name,
            image: input.image,
          },
          select: AUTH_USER_SELECT,
        });
      }

      const existingUser =
        input.email !== null
          ? await tx.user.findUnique({
              where: { email: input.email },
              select: AUTH_USER_SELECT,
            })
          : null;

      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: input.email,
            role:  Role.USER,
            name:  input.name,
            image: input.image,
          },
          select: AUTH_USER_SELECT,
        }));

      await tx.account.create({
        data: {
          provider:          input.provider,
          providerAccountId: input.providerAccountId,
          userId:            user.id,
        },
      });

      if (existingUser) {
        return tx.user.update({
          where: { id: existingUser.id },
          data:  { name: existingUser.name ?? input.name, image: input.image },
          select: AUTH_USER_SELECT,
        });
      }

      return user;
    });
  }
}

export const authService = new AuthService();
