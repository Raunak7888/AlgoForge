"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { isMobileDevice } from "@/lib/device";
import { DesktopOnlyScreen } from "./DesktopOnlyScreen";

const noopSubscribe = () => () => {};

/**
 * The dashboard needs a desktop-sized screen. It does NOT need an account (decision D1):
 * guests get the editor and the visualizer, and features that need an account show an inline sign-in prompt.
 * Who is signed in is decided by the server (see AuthProvider), never by a cookie the browser can write itself.
 */
export function DashboardGate({ children }: { children: ReactNode }) {
    // false on the server and during hydration, true on the client afterwards.
    const mounted = useSyncExternalStore(
        noopSubscribe,
        () => true,
        () => false,
    );

    if (!mounted) return <div className="min-h-dvh bg-black" />;
    if (isMobileDevice()) return <DesktopOnlyScreen />;
    return <>{children}</>;
}
