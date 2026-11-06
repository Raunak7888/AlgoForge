import gsap from "gsap";
import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function query(): MediaQueryList | null {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
}

export const prefersReducedMotion = (): boolean => query()?.matches ?? false;

function subscribe(onChange: () => void) {
    const mq = query();
    if (!mq) return () => {};
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
}

/** false on the server, so the first client render matches the server HTML. */
export const usePrefersReducedMotion = () => useSyncExternalStore(subscribe, prefersReducedMotion, () => false);

/**
 * GSAP entrance fallback. When the user prefers reduced motion, show the targets in their final
 * state (clears the inline opacity/transform that hid them) and return true so the caller skips the animation.
 */
export function settleIfReduced(targets: Parameters<typeof gsap.set>[0]): boolean {
    if (!prefersReducedMotion()) return false;
    gsap.set(targets, { clearProps: "opacity,transform,visibility" });
    return true;
}
