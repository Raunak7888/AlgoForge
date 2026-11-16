import { describe, expect, it } from "vitest";
import { DRAFT_KEY, clearDraft, loadDraft, parseDraft, saveDraft, type LocalDraft } from "./draft-storage";

function fake() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const draft: LocalDraft = { language: "python", codes: { javascript: "a", python: "b" }, updatedAt: 1_700_000_000_000 };

describe("draft storage", () => {
  it("round-trips a draft", () => {
    const s = fake();
    expect(saveDraft(draft, s)).toBe(true);
    expect(loadDraft(s)).toEqual(draft);
  });
  it("treats malformed or foreign data as no draft", () => {
    for (const raw of ["", "nope", "{}", JSON.stringify({ ...draft, language: "ruby" }), JSON.stringify({ ...draft, updatedAt: "x" }), JSON.stringify({ ...draft, codes: { javascript: 1, python: "b" } })]) {
      expect(parseDraft(raw)).toBeNull();
    }
  });
  it("clears the draft", () => {
    const s = fake();
    saveDraft(draft, s);
    clearDraft(s);
    expect(s.getItem(DRAFT_KEY)).toBeNull();
  });
  it("survives storage that throws", () => {
    const bad = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(loadDraft(bad)).toBeNull();
    expect(saveDraft(draft, bad)).toBe(false);
  });
});
