import type { CapabilitiesResponse } from "@algoforge/contracts";
import { env } from "../config/env";
import { buildCapabilities } from "../utils/capabilities";

function isAiConfigured(): boolean {
  if (env.ai.provider === "openrouter") {
    return env.openRouter.apiKeys.length > 0 && env.openRouter.freeModels.length > 0;
  }
  return env.geminiApiKey.length > 0 && env.ai.model.length > 0;
}

export const capabilitiesService = {
  get(): CapabilitiesResponse {
    return buildCapabilities({ aiConfigured: isAiConfigured() });
  },
};
