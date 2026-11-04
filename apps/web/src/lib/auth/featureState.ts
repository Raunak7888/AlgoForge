import type { CapabilitiesResponse } from "@algoforge/contracts";

/** The capabilities that gate UI features (a subset of the keys of GET /api/meta/capabilities). */
export type FeatureKey = "analysis" | "assistant" | "sharing" | "savedWork";

/**
 *  loading        still finding out who the visitor is or what the server can do
 *  needs-account  the server can do it, but only for a signed-in person
 *  preview        development only: fixed sample content stands in for the real thing
 *  unavailable    not available (server off or unreachable, or the interface is not built yet)
 *  ready          show the real feature
 */
export type FeatureState = "loading" | "needs-account" | "preview" | "unavailable" | "ready";

export interface FeatureInputs {
  authStatus: "loading" | "guest" | "authed";
  capabilities: CapabilitiesResponse | undefined;
  capabilitiesLoading: boolean;
  /** Development-only switch for sample content. */
  mockEnabled: boolean;
  /** Whether the real interface for this feature exists in this build. */
  uiReady: boolean;
}

export function resolveFeatureState(feature: FeatureKey, input: FeatureInputs): FeatureState {
  if (input.capabilitiesLoading || input.authStatus === "loading") return "loading";

  // Includes "the capabilities request failed": an unreachable server offers nothing.
  const serverOffers = input.capabilities ? input.capabilities[feature] : false;
  if (!serverOffers) return input.mockEnabled ? "preview" : "unavailable";

  if (input.authStatus === "guest") return "needs-account";
  if (!input.uiReady) return input.mockEnabled ? "preview" : "unavailable";
  return "ready";
}
