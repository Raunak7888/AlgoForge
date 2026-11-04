import { describe, expect, it } from "vitest";
import { readDashboardParams } from "./navEvents";

describe("readDashboardParams", () => {
    it("reads a known tab and a safe id", () => {
        expect(readDashboardParams("?tab=visualizer&viz=abc_123")).toEqual({ tab: "visualizer", viz: "abc_123" });
    });
    it("ignores unknown tabs and unsafe ids", () => {
        expect(readDashboardParams("?tab=admin&viz=../x")).toEqual({ tab: null, viz: null });
        expect(readDashboardParams("")).toEqual({ tab: null, viz: null });
    });
});
