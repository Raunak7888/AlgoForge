export const SCRIPT_KEY = "algoforge:script:v1";

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

function browserStorage(): Storage | undefined {
    try {
        return typeof window === "undefined" ? undefined : window.localStorage;
    } catch {
        return undefined; // blocked storage (private mode, policy)
    }
}

export function loadScript(storage: Reader | undefined = browserStorage()): string | null {
    try {
        return storage?.getItem(SCRIPT_KEY) ?? null;
    } catch {
        return null;
    }
}

/** Best effort: a full or blocked storage never breaks the panel. */
export function saveScript(text: string, storage: Writer | null = browserStorage() ?? null): boolean {
    try {
        if (!storage) return false;
        storage.setItem(SCRIPT_KEY, text);
        return true;
    } catch {
        return false;
    }
}