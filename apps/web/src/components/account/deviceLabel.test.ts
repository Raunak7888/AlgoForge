import { describe, expect, it } from "vitest";
import { describeDevice } from "./deviceLabel";

describe("describeDevice", () => {
    it("handles a missing user agent", () => {
        expect(describeDevice(null)).toBe("Unknown device");
        expect(describeDevice("")).toBe("Unknown device");
    });
    it("names common desktop browsers", () => {
        expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")).toBe("Chrome on Windows");
        expect(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Edg/124.0")).toBe("Edge on Windows");
        expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15")).toBe("Safari on macOS");
        expect(describeDevice("Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0")).toBe("Firefox on Linux");
    });
    it("tells phones apart from desktops", () => {
        expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iOS");
        expect(describeDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36")).toBe("Chrome on Android");
    });
    it("falls back gracefully", () => {
        expect(describeDevice("curl/8.0")).toBe("Unknown device");
    });
});
