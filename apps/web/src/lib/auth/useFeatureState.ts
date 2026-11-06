"use client";

import { MOCK_DATA_ENABLED } from "../featureFlags";
import { useCapabilities } from "../query/hooks";
import { useAuth } from "./AuthProvider";
import { resolveFeatureState, type FeatureKey, type FeatureState } from "./featureState";

/**
 * Whether a feature can be shown, needs a sign-in, or is not available.
 * Source of truth: GET /api/meta/capabilities plus who is signed in.
 * `uiReady` says whether the real interface for the feature exists in this build.
 */
export function useFeatureState(feature: FeatureKey, options: { uiReady: boolean }): FeatureState {
  const { status } = useAuth();
  const capabilities = useCapabilities();
  return resolveFeatureState(feature, {
    authStatus: status,
    capabilities: capabilities.data,
    capabilitiesLoading: capabilities.isPending,
    mockEnabled: MOCK_DATA_ENABLED,
    uiReady: options.uiReady,
  });
}
