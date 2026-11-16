import type { AnalysisLanguage } from "@algoforge/contracts";

export const DRAFT_KEY = "algoforge:draft:v1";
const MAX_CHARS = 200_000;

export interface LocalDraft {
  language: AnalysisLanguage;
  codes: Record<AnalysisLanguage, string>;
  /** Epoch ms of the last edit. */
  updatedAt: number;
}

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;
type Remover = Pick<Storage, "removeItem">;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined; // blocked storage (private mode, policy)
  }
}

/** Stored text is data, not trusted: anything malformed is "no draft". */
export function parseDraft(raw: string | null): LocalDraft | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { language?: unknown; codes?: { javascript?: unknown; python?: unknown }; updatedAt?: unknown };
    const { javascript, python } = v.codes ?? {};
    if (v.language !== "javascript" && v.language !== "python") return null;
    if (typeof javascript !== "string" || typeof python !== "string") return null;
    if (javascript.length > MAX_CHARS || python.length > MAX_CHARS) return null;
    if (typeof v.updatedAt !== "number" || !Number.isFinite(v.updatedAt) || v.updatedAt <= 0) return null;
    return { language: v.language, codes: { javascript, python }, updatedAt: v.updatedAt };
  } catch {
    return null;
  }
}

export function loadDraft(storage: Reader | undefined = browserStorage()): LocalDraft | null {
  try {
    return parseDraft(storage?.getItem(DRAFT_KEY) ?? null);
  } catch {
    return null;
  }
}

/** Best effort: a full or blocked storage never breaks the editor. */
export function saveDraft(draft: LocalDraft, storage: Writer | undefined = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: Remover | undefined = browserStorage()): void {
  try {
    storage?.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
