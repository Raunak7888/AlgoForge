import { z } from "zod";
import { SafeUserSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema } from "./common";

export { SafeUserSchema };
export type { SafeUser } from "@algoforge/analysis";

export const UsernameSchema = z.string().regex(/^[a-z0-9_]{3,30}$/, "Use 3-30 lowercase letters, digits or underscores.");
export const UpdateProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  username: UsernameSchema.optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const DeviceSessionSchema = z.object({
  id: z.string(),
  createdAt: IsoDateTimeSchema,
  lastUsedAt: IsoDateTimeSchema,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  current: z.boolean(),
});
export const DeviceSessionListResponseSchema = z.object({ data: z.array(DeviceSessionSchema) });
export type DeviceSession = z.infer<typeof DeviceSessionSchema>;
