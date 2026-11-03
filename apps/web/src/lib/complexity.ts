export type GrowthFn = (n: number) => number;
/** Upper bound of the chart's y axis; fast-growing classes are clipped here. */
export const CHART_CAP = 100;

const stirling = (x: number) => Math.max(1, Math.sqrt(2 * Math.PI * x) * Math.pow(x / Math.E, x));

const GROWTH = {
    "1": { label: "O(1)", fn: () => 1 },
    logn: { label: "O(log n)", fn: (n: number) => Math.log2(n + 1) },
    sqrtn: { label: "O(√n)", fn: (n: number) => Math.sqrt(n) },
    n: { label: "O(n)", fn: (n: number) => n / 10 },
    nlogn: { label: "O(n log n)", fn: (n: number) => (n * Math.log2(n + 1)) / 10 },
    n2: { label: "O(n²)", fn: (n: number) => (n * n) / 100 },
    n3: { label: "O(n³)", fn: (n: number) => n ** 3 / 10_000 },
    "2n": { label: "O(2^n)", fn: (n: number) => Math.min(CHART_CAP, 2 ** (n / 10)) },
    "n!": { label: "O(n!)", fn: (n: number) => Math.min(CHART_CAP, stirling(n / 10)) },
} satisfies Record<string, { label: string; fn: GrowthFn }>;

export type GrowthId = keyof typeof GROWTH;

const V = "[a-z]";
const RULES: [RegExp, GrowthId][] = [
    [/^1$/, "1"],
    [new RegExp(`^log${V}$`), "logn"],
    [new RegExp(`^sqrt${V}$|^${V}\\^0\\.5$`), "sqrtn"],
    [new RegExp(`^${V}$|^${V}\\+${V}$|^${V}\\+\\d+$`), "n"], // n, k, V+E, n+m, n+1
    [new RegExp(`^${V}\\*?log${V}$|^log${V}\\*${V}$`), "nlogn"],
    [new RegExp(`^${V}\\^2$|^${V}\\*${V}$`), "n2"],
    [new RegExp(`^${V}\\^3$|^${V}\\*${V}\\*${V}$`), "n3"],
    [/^2\^[a-z]$/, "2n"],
    [new RegExp(`^${V}!$`), "n!"],
];

/** "O(n^2)", "O(n²)", "o( N * N )", "O(V + E)" ... -> a known growth class, or null. */
export function growthIdOf(raw: string): GrowthId | null {
    const s = raw
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/²/g, "^2")
        .replace(/³/g, "^3")
        .replace(/√/g, "sqrt")
        .replace(/[·×]/g, "*")
        .replace(/\*\*/g, "^")
        .replace(/log(?:2|10)|lg|ln/g, "log");
    const wrapped = /^(?:o|θ|ω)?\((.*)\)$/.exec(s);
    const body = (wrapped ? wrapped[1] : s).replace(/(log|sqrt)\(([^()]*)\)/g, "$1$2");
    return RULES.find(([re]) => re.test(body))?.[1] ?? null;
}

export const growthFor = (raw: string): GrowthFn | null => {
    const id = growthIdOf(raw);
    return id ? GROWTH[id].fn : null;
};
export const canonicalLabel = (raw: string): string | null => {
    const id = growthIdOf(raw);
    return id ? GROWTH[id].label : null;
};
