import { describe, expect, it } from "vitest";
import { CAPABILITY_LIMITS } from "@algoforge/contracts";
import { buildCapabilities } from "./capabilities";

describe("buildCapabilities", () => {
  it("turns AI features on when a provider is configured", () => {
    const caps = buildCapabilities({ aiConfigured: true });
    expect(caps.analysis).toBe(true);
    expect(caps.assistant).toBe(true);
    expect(caps.sharing).toBe(true);
  });
  it("turns them off when it is not", () => {
    const caps = buildCapabilities({ aiConfigured: false });
    expect(caps.analysis).toBe(false);
    expect(caps.assistant).toBe(false);
    expect(caps.sharing).toBe(false);
  });
  it("never reports saved work before it exists", () => {
    expect(buildCapabilities({ aiConfigured: true }).savedWork).toBe(false);
  });
  it("reports the shared limits", () => {
    expect(buildCapabilities({ aiConfigured: true }).limits).toEqual(CAPABILITY_LIMITS);
  });
});
