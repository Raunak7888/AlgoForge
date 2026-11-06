export const SPLIT = { min: 25, max: 70, default: 35, key: "algoforge:dashboard:split" } as const;

export const clampPct = (v: number, min: number = SPLIT.min, max: number = SPLIT.max) => Math.min(max, Math.max(min, v));

export function pctFromPointer(clientX: number, rect: { left: number; width: number }, min: number = SPLIT.min, max: number = SPLIT.max): number {
    return clampPct(((clientX - rect.left) / rect.width) * 100, min, max);
}

/** Keyboard behaviour of the separator: arrows step, Shift = big step, Home/End jump. Null = key not handled. */
export function nextPctForKey(key: string, shift: boolean, value: number, min: number = SPLIT.min, max: number = SPLIT.max): number | null {
    const step = shift ? 10 : 2;
    switch (key) {
        case "ArrowLeft":
            return clampPct(value - step, min, max);
        case "ArrowRight":
            return clampPct(value + step, min, max);
        case "Home":
            return min;
        case "End":
            return max;
        default:
            return null;
    }
}

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

function browserStorage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null; // blocked storage
    }
}

export function loadSplit(storage: Reader | null = browserStorage(), key: string = SPLIT.key, min: number = SPLIT.min, max: number = SPLIT.max): number | null {
    try {
        const raw = storage?.getItem(key);
        if (raw == null) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? clampPct(n, min, max) : null;
    } catch {
        return null;
    }
}

export function saveSplit(value: number, storage: Writer | null = browserStorage(), key: string = SPLIT.key): boolean {
    try {
        if (!storage) return false;
        storage.setItem(key, String(Math.round(value * 10) / 10));
        return true;
    } catch {
        return false;
    }
}
