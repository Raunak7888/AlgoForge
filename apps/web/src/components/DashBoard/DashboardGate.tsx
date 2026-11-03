"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { readUserCookie, writeUserCookie } from "@/lib/auth-cookie";
import { signInWithGoogle } from "@/lib/auth";
import { isMobileDevice } from "@/lib/device";
import { GoogleLoginModal } from "@/components/auth/GoogleLoginModal"; // adjust to your real path
import { DesktopOnlyScreen } from "./DesktopOnlyScreen";

type Status = "checking" | "mobile" | "login" | "ready";

export function DashboardGate({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<Status>("checking");

    useEffect(() => {
        // Lock 2 first (device), then lock 1 (auth)
        if (isMobileDevice()) setStatus("mobile");
        else setStatus(readUserCookie() ? "ready" : "login");
    }, []);

    const handleLogin = useCallback(async () => {
        const user = await signInWithGoogle();
        writeUserCookie(user);
        setStatus("ready");
    }, []);

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