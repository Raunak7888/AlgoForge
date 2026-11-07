const KEY = "algoforge:assistant:algorithm";

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

function session(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Called when a catalog algorithm is opened in the visualizer. */
export function rememberAlgorithm(slug: string, script: string, storage: Writer | undefined = session()): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ slug, script }));
  } catch {
    /* best effort */
  }
}

/** The slug is only trusted while the script on screen is still the catalog's script. */
export function recallAlgorithm(currentScript: string | null, storage: Reader | undefined = session()): string | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw || currentScript === null) return null;
    const v = JSON.parse(raw) as { slug?: unknown; script?: unknown };
    return typeof v.slug === "string" && v.script === currentScript ? v.slug : null;
  } catch {
    return null;
  }
}
