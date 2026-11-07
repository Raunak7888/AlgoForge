import { LIMITS, type AnalysisLanguage, type ExplainContext } from "@algoforge/contracts";

/** Plain data the assistant context is made from. Kept free of stores so it is easy to test. */
export interface ContextSources {
  language: AnalysisLanguage;
  code: string;
  script: string | null;
  step: { position: number; total: number; call: string | null; messages: readonly string[] } | null;
  algorithmSlug: string | null;
}

/** Everything is optional and bounded; empty parts are left out so the server never sees blanks. */
export function assembleContext(s: ContextSources): ExplainContext {
  const ctx: ExplainContext = { language: s.language };
  const code = s.code.slice(0, LIMITS.code.maxChars);
  if (code.trim() !== "") ctx.code = code;
  const script = s.script?.slice(0, LIMITS.script.maxChars);
  if (script && script.trim() !== "") ctx.script = script;
  if (s.step && s.step.position > 0 && s.step.total >= s.step.position) {
    const narration = s.step.messages.join("\n").slice(0, 1_000);
    ctx.step = {
      position: s.step.position,
      total: s.step.total,
      ...(s.step.call ? { call: s.step.call.slice(0, 300) } : {}),
      ...(narration.trim() !== "" ? { narration } : {}),
    };
  }
  if (s.algorithmSlug && /^[a-z0-9-]{1,100}$/.test(s.algorithmSlug)) ctx.algorithmSlug = s.algorithmSlug;
  return ctx;
}
