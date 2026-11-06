import type { QueryClient } from "@tanstack/react-query";
import { endpoints } from "../api/endpoints";
import { queryKeys } from "../query/keys";
import { failureFrom } from "./failure";
import { useWorkspace } from "./store";

/**
 * Runs one analysis for the code and language in the workspace. It lives outside React on purpose:
 * switching dashboard tabs mid-run unmounts the panel, but the run keeps going and the result is
 * waiting in the store when the person comes back.
 */
export async function runAnalysis(queryClient: QueryClient): Promise<void> {
  const state = useWorkspace.getState();
  if (state.run.status === "running") return;
  const language = state.language;
  const code = state.codes[language];
  if (code.trim() === "") return;

  state.startRun();
  try {
    const record = await endpoints.createAnalysis({ code, language });
    useWorkspace.getState().finishRun({ id: record.id, language: record.language, result: record.result, title: record.title });
    void queryClient.invalidateQueries({ queryKey: ["analysis", "history"] });
  } catch (error) {
    useWorkspace.getState().failRun(failureFrom(error));
  } finally {
    void queryClient.invalidateQueries({ queryKey: queryKeys.analysisQuota() });
  }
}
