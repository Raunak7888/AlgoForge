import { z } from "zod";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { UserRoleSchema } from "./auth";
import { LIMITS } from "./limits";

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  role: UserRoleSchema,
  createdAt: IsoDateTimeSchema,
});
export const AdminUserListResponseSchema = paginatedResponse(AdminUserSchema);
export const AdminUserListQuerySchema = pageQuerySchema(LIMITS.pagination.adminUsers);

export const AdminRoleChangeRequestSchema = z.object({ userId: z.string().min(1) });
export const AdminRoleChangeResponseSchema = z.object({
  changed: z.boolean(),
  user: z.object({ id: z.string(), email: z.string().nullable(), role: UserRoleSchema }),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;
export type AdminRoleChangeResponse = z.infer<typeof AdminRoleChangeResponseSchema>;