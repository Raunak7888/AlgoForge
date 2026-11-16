import { z } from "zod";
import { AnalysisLanguageSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema } from "./common";
import { LIMITS } from "./limits";

const CodeSchema = z.string().max(LIMITS.code.maxChars);

/** The editor content of the signed-in person. updatedAt is the time of the last edit, set by the client. */
export const WorkspaceDraftSchema = z.object({
  language: AnalysisLanguageSchema,
  codes: z.object({ javascript: CodeSchema, python: CodeSchema }),
  updatedAt: IsoDateTimeSchema,
});
export const WorkspaceDraftResponseSchema = z.object({ draft: WorkspaceDraftSchema.nullable() });
export const SaveWorkspaceDraftRequestSchema = WorkspaceDraftSchema;
/** applied=false means a newer draft was already stored; `draft` is the one that is kept. */
export const SaveWorkspaceDraftResponseSchema = z.object({ draft: WorkspaceDraftSchema, applied: z.boolean() });

export type WorkspaceDraft = z.infer<typeof WorkspaceDraftSchema>;
export type WorkspaceDraftResponse = z.infer<typeof WorkspaceDraftResponseSchema>;
export type SaveWorkspaceDraftRequest = z.infer<typeof SaveWorkspaceDraftRequestSchema>;
export type SaveWorkspaceDraftResponse = z.infer<typeof SaveWorkspaceDraftResponseSchema>;
