import type { ExplainContext } from "@algoforge/contracts";
import { visualizer } from "@/components/visualizers/engine/instance";
import { currentMessages, progressOf } from "@/components/visualizers/engine/selectors";
import { loadScript } from "@/components/visualizers/script/storage";
import { describeStep } from "@/components/visualizers/ui/describe";
import { useWorkspace } from "@/lib/workspace/store";
import { recallAlgorithm } from "./algorithmContext";
import { assembleContext, type ContextSources } from "./context-core";

/** Reads the live workspace: editor code and language, the script on the canvas, the step on screen and its narration. */
export function readSources(): ContextSources {
  const ws = useWorkspace.getState();
  const { compiled, transport } = visualizer.getState();
  const script = loadScript();
  const { position, total } = progressOf(transport);
  const info = describeStep(compiled, transport);
  return {
    language: ws.language,
    code: ws.codes[ws.language],
    script,
    step: position > 0 && total >= position ? { position, total, call: info.call, messages: currentMessages(compiled, transport, true) } : null,
    algorithmSlug: recallAlgorithm(script),
  };
}

export const readAssistantContext = (): ExplainContext => assembleContext(readSources());
