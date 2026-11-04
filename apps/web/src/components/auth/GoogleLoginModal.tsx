"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import Link from "next/link";
import type { AuthErrorCode } from "@algoforge/contracts";
import AlgoForgeLogo from "@/components/Logo";
import { GlassCard } from "@/components/auth/GlassCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth/loginUrl";

interface GoogleLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Starts the real sign-in: a full-page navigation to /api/auth/google/start. */
    onGoogleLogin: () => Promise<void>;
    /** Why the previous attempt ended without a session (from ?authError). */
    error?: AuthErrorCode | null;
    /** Why signing in helps on the page the person was on. */
    message?: string | null;
}

const DEFAULT_MESSAGE = "Sign in to unlock analysis, the AI assistant, history and sharing. The editor and the visualizer work without an account.";

/**
 * Built on the Base UI Dialog, so it traps focus, closes on Escape and returns focus to where it was opened.
 * The first focusable control is the Google button, because the close button comes last in the DOM.
 */
export function GoogleLoginModal({ isOpen, onClose, onGoogleLogin, error = null, message = null }: GoogleLoginModalProps) {
    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <div className="pointer-events-none fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6">
                    <Dialog.Popup className="pointer-events-auto relative w-full max-w-97.5 outline-none transition-[opacity,transform] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
                        <GlassCard className="px-8 py-8 sm:px-9 sm:py-9">
                            <div className="mb-7 flex flex-col items-center text-center">
                                <div
                                    className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl p-2"
                                    style={{
                                        background: "linear-gradient(135deg, rgba(255,77,0,0.18) 0%, rgba(255,255,255,0.05) 100%)",
                                        border: "1px solid rgba(255,77,0,0.25)",
                                    }}
                                >
                                    <AlgoForgeLogo />
                                </div>
                                <Dialog.Title className="text-xl font-semibold tracking-tight text-white">Sign in to AlgoForge</Dialog.Title>
                                <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-white/50">{message ?? DEFAULT_MESSAGE}</Dialog.Description>
                            </div>

                            {error && (
                                <p role="alert" className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-center text-xs leading-relaxed text-red-200">
                                    {AUTH_ERROR_MESSAGES[error]}
                                </p>
                            )}

                            <div className="space-y-4">
                                <GoogleButton onLogin={onGoogleLogin} />
                            </div>

                            <p className="mt-5 text-center text-[11px] leading-relaxed text-white/35">
                                By continuing, you agree to our{" "}
                                <Link href="/terms" className="text-white/55 underline-offset-2 hover:underline">
                                    Terms
                                </Link>{" "}
                                and{" "}
                                <Link href="/privacy" className="text-white/55 underline-offset-2 hover:underline">
                                    Privacy Policy
                                </Link>
                            </p>

                            <Dialog.Close
                                aria-label="Close"
                                className="absolute right-4 top-4 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/5 text-white/60 transition hover:border-white/15 hover:bg-white/6 hover:text-white/80"
                            >
                                <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                            </Dialog.Close>
                        </GlassCard>
                    </Dialog.Popup>
                </div>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
