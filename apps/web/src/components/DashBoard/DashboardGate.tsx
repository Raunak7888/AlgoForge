"use client";

import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { readUserCookie, writeUserCookie } from "@/lib/auth-cookie";
import { signInWithGoogle } from "@/lib/auth";
import { isMobileDevice } from "@/lib/device";
import { GoogleLoginModal } from "@/components/auth/GoogleLoginModal"; // adjust to your real path
import { DesktopOnlyScreen } from "./DesktopOnlyScreen";

type Status = "checking" | "mobile" | "login" | "ready";

const noopSubscribe = () => () => {};

export function DashboardGate({ children }: { children: ReactNode }) {
    const [loggedIn, setLoggedIn] = useState(false);
    // false on the server and during hydration, true on the client afterwards.
    const mounted = useSyncExternalStore(
        noopSubscribe,
        () => true,
        () => false,
    );

    const handleLogin = useCallback(async () => {
        const user = await signInWithGoogle();
        writeUserCookie(user);
        setLoggedIn(true);
    }, []);

    // Lock 2 first (device), then lock 1 (auth)
    const status: Status = !mounted
        ? "checking"
        : isMobileDevice()
          ? "mobile"
          : loggedIn || readUserCookie()
            ? "ready"
            : "login";

    if (status === "checking") return <div className="min-h-dvh bg-black" />;
    if (status === "mobile") return <DesktopOnlyScreen />;

    if (status === "login") {
        return (
            <div className="min-h-dvh bg-black">
                <GoogleLoginModal isOpen onGoogleLogin={handleLogin} onClose={() => {}}/>
            </div>
        );
    }

    return <>{children}</>;
}
