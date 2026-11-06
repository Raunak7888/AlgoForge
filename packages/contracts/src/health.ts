import { z } from "zod";
import { IsoDateTimeSchema } from "./common";

export const HealthResponseSchema = z.object({ status: z.literal("ok"), timestamp: IsoDateTimeSchema });
export const ReadyResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  checks: z.object({ database: z.enum(["ok", "fail"]), redis: z.enum(["ok", "fail"]) }),
  timestamp: IsoDateTimeSchema,
});
