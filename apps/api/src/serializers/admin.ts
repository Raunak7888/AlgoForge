import type { AdminUser, UserRole } from "@algoforge/contracts";
import { toIso } from "./dates";

export interface AdminUserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  createdAt: Date | string;
}

export function serializeAdminUser(row: AdminUserRow): AdminUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: toIso(row.createdAt) };
}
