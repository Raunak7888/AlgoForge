"use client";

import { LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface SignInPromptProps {
    title: string;
    description: string;
    className?: string;
}

/** The inline message shown where a feature needs an account. Opens the login modal. */
export function SignInPrompt({ title, description, className = "" }: SignInPromptProps) {
    const { openLoginModal } = useAuth();
    return (
        <div role="region" aria-label={title} className={`flex h-full items-center justify-center bg-primary-background p-8 text-center ${className}`}>
            <div className="flex max-w-sm flex-col items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{title}</h2>
                <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
                <button
                    type="button"
                    onClick={() => openLoginModal({ message: description })}
                    className="mt-1 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-zinc-50 px-4 text-sm font-medium text-zinc-950 transition hover:bg-white active:scale-[0.98]"
                >
                    <LogIn size={14} aria-hidden />
                    Sign in with Google
                </button>
            </div>
        </div>
    );
}
