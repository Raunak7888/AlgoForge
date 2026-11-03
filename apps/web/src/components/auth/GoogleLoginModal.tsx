// PARKED since Phase 3: not mounted anywhere. Before remounting, rebuild the shell on
// @base-ui/react/dialog like DashBoard/ShareModal.tsx (focus trap, Escape, focus return, aria-modal).
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/hooks/useIsClient";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { X } from "lucide-react";
import { GlassCard } from "@/components/auth/GlassCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { ModalBackdrop } from "@/components/auth/ModalBackdrop";
import { useModalAnimations } from "@/components/auth/useModalAnimations";
import AlgoForgeLogo from "../Logo";
import Link from "next/link";

const MotionLink = motion.create(Link);
interface GoogleLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoogleLogin?: () => Promise<void>;
}

const cardVariants: Variants = {
    hidden: { opacity: 0, scale: 0.88, y: 32, rotateX: 6 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        rotateX: 0,
        transition: { type: "spring", stiffness: 220, damping: 22, mass: 0.9 },
    },
    exit: {
        opacity: 0,
        scale: 0.92,
        y: 20,
        filter: "blur(8px)",
        transition: { duration: 0.22, ease: "easeIn" },
    },
};

export function GoogleLoginModal({
    isOpen,
    onClose,
    onGoogleLogin,
}: GoogleLoginModalProps) {
    const { cardRef, logoRef, contentRef } = useModalAnimations(isOpen);
    const isClient = useIsClient();

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const handleLogin = async () => {
        await onGoogleLogin?.();
        onClose();
    };

    if (!isClient) return null; // all hooks are above this line

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <>
                    <ModalBackdrop onClose={onClose} />

                    <div
                        className="fixed inset-0 z-9999 flex items-center justify-center p-4 backdrop-blur-2xl sm:p-6"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget) onClose(); // this layer now covers the backdrop
                        }}
                    >
                        <motion.div
                            className="relative w-full max-w-97.5"
                            style={{ perspective: "1200px" }}
                            variants={cardVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                        >
                            <GlassCard
                                ref={cardRef}
                                className="px-8 py-8 sm:px-9 sm:py-9"
                            >
                                {/* ── Close button — subtle slide + fade, no spin ── */}
                                <motion.button
                                    className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-md text-white/60"
                                    onClick={onClose}
                                    initial={false}
                                    whileHover={{
                                        color: "rgba(255,255,255,0.75)",
                                        backgroundColor:
                                            "rgba(255,255,255,0.06)",
                                        borderColor: "rgba(255,255,255,0.12)",
                                    }}
                                    whileTap={{ scale: 0.92 }}
                                    style={{
                                        border: "1px solid rgba(255,255,255,0.05)",
                                        transition:
                                            "background 0.2s, color 0.2s, border-color 0.2s",
                                    }}
                                >
                                    <motion.span
                                        whileHover={{ x: 0.5, y: -0.5 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 500,
                                            damping: 18,
                                        }}
                                    >
                                        <X
                                            className="h-3.5 w-3.5"
                                            strokeWidth={2}
                                        />
                                    </motion.span>
                                </motion.button>

                                {/* ── Logo / brand ── */}
                                <div
                                    ref={logoRef}
                                    className="mb-8 flex flex-col items-center"
                                >
                                    <div className="relative mb-4">
                                        {/* Orange pulse rings */}
                                        {[0, 0.55].map((delay, i) => (
                                            <motion.div
                                                key={i}
                                                className="absolute inset-0 rounded-2xl"
                                                style={{
                                                    border: "1px solid rgba(255,77,0,0.3)",
                                                }}
                                                animate={{
                                                    scale: [1, 1.55],
                                                    opacity: [0.4, 0],
                                                }}
                                                transition={{
                                                    duration: 2,
                                                    repeat: Infinity,
                                                    delay,
                                                    ease: "easeOut",
                                                }}
                                            />
                                        ))}

                                        <div
                                            className="relative flex h-14 w-14 items-center p-2 justify-center rounded-2xl"
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, rgba(255,77,0,0.18) 0%, rgba(255,255,255,0.05) 100%)",
                                                border: "1px solid rgba(255,77,0,0.25)",
                                                boxShadow:
                                                    "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 32px rgba(255,77,0,0.12)",
                                            }}
                                        >
                                            <AlgoForgeLogo />
                                        </div>
                                    </div>

                                    <h1 className="font-display text-xl font-semibold tracking-tight text-white">
                                        Welcome back
                                    </h1>
                                    <p
                                        className="mt-1 text-center text-sm"
                                        style={{
                                            color: "rgba(255,255,255,0.38)",
                                        }}
                                    >
                                        Sign in to continue to your workspace
                                    </p>
                                </div>

                                {/* ── Content ── */}
                                <div ref={contentRef} className="space-y-4">
                                    <GoogleButton onLogin={handleLogin} />
                                </div>

                                {/* Footer */}
                                <p
                                    className="mt-5 text-center text-[11px] leading-relaxed font-body"
                                    style={{ color: "rgba(255,255,255,0.18)" }}
                                >
                                    By continuing, you agree to our{" "}
                                    <MotionLink
                                        href="/terms"
                                        className="underline-offset-2 hover:underline"
                                        style={{
                                            color: "rgba(255,255,255,0.38)",
                                        }}
                                        whileHover={{
                                            color: "rgba(255,255,255,0.6)",
                                        }}
                                    >
                                        Terms
                                    </MotionLink>{" "}
                                    and{" "}
                                    <MotionLink
                                        href="/privacy"
                                        className="underline-offset-2 hover:underline"
                                        style={{
                                            color: "rgba(255,255,255,0.38)",
                                        }}
                                        whileHover={{
                                            color: "rgba(255,255,255,0.6)",
                                        }}
                                    >
                                        Privacy Policy
                                    </MotionLink>
                                </p>
                            </GlassCard>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>,
        document.body,
    );
}
