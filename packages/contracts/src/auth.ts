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

/** Query parameter names shared by the API redirects and the web app. */
export const RETURN_TO_PARAM = "returnTo";
export const AUTH_ERROR_PARAM = "authError";

/** Reasons the OAuth round trip can end without a session. They are appended to the return path as ?authError=<code>. */
export const AUTH_ERROR_CODES = ["oauth_failed", "oauth_denied"] as const;
export const AuthErrorCodeSchema = z.enum(AUTH_ERROR_CODES);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;

export const AuthStartQuerySchema = z.object({
  returnTo: z.string().optional().describe("Internal path to return to after sign-in. Anything unsafe is replaced by /dashboard."),
});
