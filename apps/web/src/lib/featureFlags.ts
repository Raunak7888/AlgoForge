/** Pure so it can be tested; the app reads the constant below. */
export function resolveMockFlag(nodeEnv: string | undefined, override: string | undefined): boolean {
    return override === "1" || nodeEnv !== "production";
}

// Literal process.env accesses so Next can inline them in client code.
export const MOCK_DATA_ENABLED = resolveMockFlag(process.env.NODE_ENV, process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA);
