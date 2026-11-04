import { describe, expect, it } from "vitest";
import type { CapabilitiesResponse } from "@algoforge/contracts";
import { resolveFeatureState, type FeatureInputs } from "./featureState";

const caps = (over: Partial<CapabilitiesResponse> = {}): CapabilitiesResponse => ({
  analysis: true,
  assistant: true,
  sharing: true,
  savedWork: false,
  limits: { codeMaxChars: 20000, scriptMaxChars: 200000, messageMaxChars: 2000 },
  ...over,
});

const base: FeatureInputs = {
  authStatus: "authed",
  capabilities: caps(),
  capabilitiesLoading: false,
  mockEnabled: false,
  uiReady: true,
};

describe("resolveFeatureState", () => {
  it("is loading while auth or capabilities are unknown", () => {
    expect(resolveFeatureState("analysis", { ...base, authStatus: "loading" })).toBe("loading");
    expect(resolveFeatureState("analysis", { ...base, capabilitiesLoading: true, capabilities: undefined })).toBe("loading");
  });
  it("is unavailable in production when the server does not offer it", () => {
    expect(resolveFeatureState("savedWork", base)).toBe("unavailable");
    expect(resolveFeatureState("analysis", { ...base, capabilities: caps({ analysis: false }) })).toBe("unavailable");
  });
  it("is unavailable in production when the capabilities request failed", () => {
    expect(resolveFeatureState("analysis", { ...base, capabilities: undefined })).toBe("unavailable");
  });
  it("asks guests to sign in when the server offers the feature", () => {
    expect(resolveFeatureState("analysis", { ...base, authStatus: "guest" })).toBe("needs-account");
  });
  it("does not ask guests to sign in for something the server does not offer", () => {
    expect(resolveFeatureState("savedWork", { ...base, authStatus: "guest" })).toBe("unavailable");
  });
  it("is unavailable when the interface is not built yet", () => {
    expect(resolveFeatureState("analysis", { ...base, uiReady: false })).toBe("unavailable");
  });
  it("is ready for a signed-in person when everything exists", () => {
    expect(resolveFeatureState("analysis", base)).toBe("ready");
  });
  it("shows sample content only in development", () => {
    expect(resolveFeatureState("analysis", { ...base, uiReady: false, mockEnabled: true })).toBe("preview");
    expect(resolveFeatureState("savedWork", { ...base, mockEnabled: true })).toBe("preview");
    expect(resolveFeatureState("analysis", { ...base, capabilities: undefined, mockEnabled: true })).toBe("preview");
    expect(resolveFeatureState("analysis", { ...base, uiReady: false, mockEnabled: false })).toBe("unavailable");
  });
  it("still asks guests to sign in during development", () => {
    expect(resolveFeatureState("analysis", { ...base, authStatus: "guest", mockEnabled: true })).toBe("needs-account");
  });
});
