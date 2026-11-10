import type { CapabilitiesResponse } from "@algoforge/contracts";
import { env } from "../config/env";
import { buildCapabilities } from "../utils/capabilities";

function isAiConfigured(): boolean {
  return env.geminiApiKey.length > 0 && env.ai.model.length > 0;
}

export const capabilitiesService = {
  get(): CapabilitiesResponse {
    return buildCapabilities({ aiConfigured: isAiConfigured() });
  },
};
