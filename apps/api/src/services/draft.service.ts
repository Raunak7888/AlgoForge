import {
  AnalysisLanguageSchema,
  WorkspaceDraftSchema,
  type SaveWorkspaceDraftRequest,
  type SaveWorkspaceDraftResponse,
  type WorkspaceDraft,
} from "@algoforge/contracts";
import { draftRepository } from "../repositories/draft.repository";

/** A client clock far in the future would otherwise lock every later save out. */
const MAX_FUTURE_MS = 5 * 60_000;

type Row = NonNullable<Awaited<ReturnType<typeof draftRepository.findByUser>>>;

/** Stored JSON is data, not trusted: anything unreadable counts as "no draft". */
function toDraft(row: Row): WorkspaceDraft | null {
  const language = AnalysisLanguageSchema.safeParse(row.language);
  const parsed = WorkspaceDraftSchema.safeParse({ language: language.success ? language.data : null, codes: row.codes, updatedAt: row.clientUpdatedAt.toISOString() });
  return parsed.success ? parsed.data : null;
}

class DraftService {
  async get(userId: string): Promise<WorkspaceDraft | null> {
    const row = await draftRepository.findByUser(userId);
    return row ? toDraft(row) : null;
  }

  async save(userId: string, input: SaveWorkspaceDraftRequest): Promise<SaveWorkspaceDraftResponse> {
    const at = Math.min(Date.parse(input.updatedAt), Date.now() + MAX_FUTURE_MS);
    const row = await draftRepository.saveIfNewer(userId, { language: input.language, codes: input.codes, clientUpdatedAt: new Date(at) });
    const draft = toDraft(row) ?? { ...input, updatedAt: new Date(at).toISOString() };
    return { draft, applied: row.clientUpdatedAt.getTime() === at };
  }
}

export const draftService = new DraftService();
