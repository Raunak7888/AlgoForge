"use client";

import type { ReactNode } from "react";
import { useFeatureState, type FeatureKey } from "@/lib/auth";
import { SignInPrompt } from "./SignInPrompt";

export interface FeatureCopy {
    signInTitle: string;
    signInBody: string;
    unavailableTitle: string;
    unavailableBody: string;
}

interface FeatureGateProps {
    feature: FeatureKey;
    copy: FeatureCopy;
    /** Development-only sample content. Never shown in production. */
    preview: ReactNode;
    /** The real interface. While it is missing, the feature is treated as not built yet. */
    ready?: ReactNode;
}

/**
 * One rule for every feature: capabilities from the server decide whether it exists,
 * the signed-in state decides whether it needs an account, and samples appear only in development.
 */
export function FeatureGate({ feature, copy, preview, ready }: FeatureGateProps) {
    const state = useFeatureState(feature, { uiReady: ready !== undefined });

    switch (state) {
        case "loading":
            return (
                <div role="status" aria-busy className="flex h-full items-center justify-center bg-primary-background text-xs text-zinc-500">
                    Loading…
                </div>
            );
        case "needs-account":
            return <SignInPrompt title={copy.signInTitle} description={copy.signInBody} />;
        case "preview":
            return <>{preview}</>;
        case "ready":
            return <>{ready}</>;
        default:
            return (
                <div role="status" className="flex h-full items-center justify-center bg-primary-background p-8 text-center">
                    <div className="flex max-w-sm flex-col gap-2">
                        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{copy.unavailableTitle}</h2>
                        <p className="text-sm leading-relaxed text-zinc-400">{copy.unavailableBody}</p>
                    </div>
                </div>
            );
    }
}
