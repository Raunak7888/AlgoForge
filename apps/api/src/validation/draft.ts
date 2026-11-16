import { SaveWorkspaceDraftRequestSchema, type SaveWorkspaceDraftRequest } from "@algoforge/contracts";
import { badRequestFromZod } from "./common";

export function parseSaveDraft(value: unknown): SaveWorkspaceDraftRequest {
  const r = SaveWorkspaceDraftRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid draft.");
  return r.data;
}
