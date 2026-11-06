import type { AuthUser, DeviceSession, UserRole } from "@algoforge/contracts";
import { toIso } from "./dates";

export interface AuthUserRow {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  image: string | null;
  role: UserRole;
}

/** The one user shape the API returns from /auth/me, /auth/refresh and PATCH /users/me. */
export function serializeAuthUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    name: row.name,
    image: row.image,
    role: row.role,
  };
}

export interface DeviceSessionRow {
  id: string;
  createdAt: Date | string;
  lastUsedAt: Date | string;
  ipAddress: string | null;
  userAgent: string | null;
}

export function serializeDeviceSession(row: DeviceSessionRow, currentSessionId: string): DeviceSession {
  return {
    id: row.id,
    createdAt: toIso(row.createdAt),
    lastUsedAt: toIso(row.lastUsedAt),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    current: row.id === currentSessionId,
  };
}
