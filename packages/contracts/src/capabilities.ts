import { z } from "zod";

/** Contract for Phase 4 (GET /api/meta/capabilities). */
export const CapabilitiesResponseSchema = z.object({
  analysis: z.boolean(),
  assistant: z.boolean(),
  sharing: z.boolean(),
  savedWork: z.boolean(),
  limits: z.object({ codeMaxChars: z.number().int(), scriptMaxChars: z.number().int(), messageMaxChars: z.number().int() }),
});
export type CapabilitiesResponse = z.infer<typeof CapabilitiesResponseSchema>;
