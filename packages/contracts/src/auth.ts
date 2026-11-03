import { z } from "zod";

export const UserRoleSchema = z.enum(["USER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  role: UserRoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const MeResponseSchema = z.object({ user: AuthUserSchema });
export type MeResponse = z.infer<typeof MeResponseSchema>;
/** POST /auth/refresh returns the same shape as GET /auth/me. */
export const RefreshResponseSchema = MeResponseSchema;
export type RefreshResponse = MeResponse;
