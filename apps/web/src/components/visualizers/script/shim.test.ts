import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { compileScript as fromPackage, COMPILER_LIMITS } from "@algoforge/visualizer-core";
import { compileScript as fromWeb, LIMITS as webLimits } from "./compile";

const script = JSON.stringify([
    { step: 1, id: "A", ds: "array", op: "initialize", values: [2, 1] },
    { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
]);

describe("one compiler for browser and server", () => {
    it("the web import path is the package compiler", () => {
        expect(fromWeb).toBe(fromPackage);
    });
    it("the script size limit is the shared contracts limit", () => {
        expect(webLimits.chars).toBe(LIMITS.script.maxChars);
        expect(COMPILER_LIMITS.chars).toBe(LIMITS.script.maxChars);
    });
    it("compiles to the same frames", () => {
        expect(fromWeb(script).frames.length).toBe(2);
        expect(JSON.stringify(fromWeb(script).diagnostics)).toBe(JSON.stringify(fromPackage(script).diagnostics));
    });
});
