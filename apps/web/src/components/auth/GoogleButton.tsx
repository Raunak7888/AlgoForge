"use client";

import { useState, useRef } from "react";
import { motion, useSpring } from "framer-motion";
import { Loader2 } from "lucide-react";

interface GoogleButtonProps {
    onLogin: () => Promise<void>;
}

const GoogleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
);

export function GoogleButton({ onLogin }: GoogleButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Magnetic effect
    const x = useSpring(0, { stiffness: 300, damping: 20 });
    const y = useSpring(0, { stiffness: 300, damping: 20 });

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        x.set((e.clientX - cx) * 0.15);
        y.set((e.clientY - cy) * 0.15);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
        setIsHovered(false);
    };

    const handleClick = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            await onLogin();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.button
            ref={buttonRef}
            style={{
                x,
                y,
                background: isHovered
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
            }}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={handleMouseLeave}
            disabled={isLoading}
            whileTap={{ scale: 0.97 }}
            className="group relative w-full overflow-hidden rounded-xl px-6 py-3.5 text-sm font-medium text-white transition-colors disabled:pointer-events-none disabled:opacity-60"
        >
            {/* Shimmer sweep on hover */}
            <motion.div
                className="pointer-events-none absolute inset-0"
                initial={{ x: "-110%" }}
                animate={{ x: isHovered ? "110%" : "-110%" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{
                    background:
                        "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
                }}
            />

            {/* Pulse ring on click */}
            {isLoading && (
                <span className="absolute inset-0 animate-pulse-ring rounded-xl border border-white/20" />
            )}

            <span className="relative flex items-center justify-center gap-3">
                {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white/70" />
                ) : (
                    <motion.span
                        animate={{ rotate: isHovered ? [0, -8, 8, 0] : 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <GoogleIcon />
                    </motion.span>
                )}
                <span className="font-body tracking-wide">
                    {isLoading ? "Authenticating..." : "Continue with Google"}
                </span>
            </span>
        </motion.button>
    );
}
