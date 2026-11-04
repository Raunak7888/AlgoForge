import { CAPABILITY_LIMITS, type CapabilitiesResponse } from "@algoforge/contracts";

export interface CapabilityInputs {
  /** An AI provider with credentials and a model is configured. */
  aiConfigured: boolean;
}

/**
 * What this server can do right now. Pure, so it can be tested without any environment.
 * savedWork is on: the visualization endpoints exist (Phase 6).
 */
export function buildCapabilities(input: CapabilityInputs): CapabilitiesResponse {
  return {
    analysis: input.aiConfigured,
    assistant: input.aiConfigured,
    sharing: input.aiConfigured,
    savedWork: true,
    limits: { ...CAPABILITY_LIMITS },
  };
}
