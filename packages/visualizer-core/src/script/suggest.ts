/** "Did you mean ...?" helpers. */

function distance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
    }
    return prev[n];
}

/** The closest candidate, or undefined when nothing is close enough to be a typo. */
export function closest(name: string, candidates: readonly string[]): string | undefined {
    const lower = name.toLowerCase();
    const exact = candidates.find((c) => c.toLowerCase() === lower);
    if (exact) return exact;
    let best: string | undefined;
    let bestD = Infinity;
    for (const c of candidates) {
        const d = distance(lower, c.toLowerCase());
        if (d < bestD) {
            bestD = d;
            best = c;
        }
    }
    return best !== undefined && bestD <= Math.max(2, Math.floor(name.length / 3)) ? best : undefined;
}

export const didYouMean = (name: string, candidates: readonly string[]): string => {
    const c = closest(name, candidates);
    return c ? ` Did you mean "${c}"?` : "";
};
