/** The dashboard reads ?tab and ?viz. Pages that change them without a remount fire NAV_EVENT. */
export const NAV_EVENT = "algoforge:navigate";

export type DashboardTab = "analysis" | "visualizer" | "history";
const TABS: readonly string[] = ["analysis", "visualizer", "history"];

export function readDashboardParams(search?: string): { tab: DashboardTab | null; viz: string | null } {
    const text = search ?? (typeof window === "undefined" ? "" : window.location.search);
    const params = new URLSearchParams(text);
    const tab = params.get("tab");
    const viz = params.get("viz");
    return { tab: tab !== null && TABS.includes(tab) ? (tab as DashboardTab) : null, viz: viz && /^[A-Za-z0-9_-]{1,64}$/.test(viz) ? viz : null };
}

/** Removes query parameters from the address bar without navigating. */
export function dropParams(names: readonly string[]): void {
    const url = new URL(window.location.href);
    names.forEach((n) => url.searchParams.delete(n));
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
