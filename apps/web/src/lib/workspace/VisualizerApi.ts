"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import { checkRunnableCode } from "@algoforge/contracts";
import { endpoints } from "@/lib/api/endpoints";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth";
import { useWorkspace } from "@/lib/workspace/store";
import type { VisualizerStore } from "../../components/visualizers/engine";
import { visualizer } from "../../components/visualizers/engine/instance";
import { compileScript, saveScript } from "../../components/visualizers/script";

export class VisualizeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "VisualizeError";
    }
}

function describe(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 401) return "Your session has expired. Please sign in again.";
        if (error.status === 404) return "The visualization service was not found. Make sure the API is running and up to date.";
    }
    return errorMessage(error);
}

function readEditor() {
    const { language, codes } = useWorkspace.getState();
    return { code: codes[language] ?? "", language };
}

/** Asks the API to turn code into a visualizer script (JSON text). */
export async function requestScript(code: string, language: "javascript" | "python", signal?: AbortSignal): Promise<string> {
    try {
        const res = await endpoints.generateVisualization({ code, language }, signal);
        if (!res.script || res.script.trim() === "") throw new VisualizeError("The service returned an empty visualization. Please try again.");
        return res.script;
    } catch (error) {
        if (error instanceof VisualizeError) throw error;
        if ((error as Error).name === "AbortError") throw error;
        throw new VisualizeError(describe(error));
    }
}

/** Generates a visualization for the code in the editor, compiles it and loads it into the visualizer store. */
export function useVisualize(store: StoreApi<VisualizerStore> = visualizer) {
    const { status, openLoginModal } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abort = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            abort.current?.abort();
            abort.current = null;
        };
    }, []);

    const visualize = useCallback(async () => {
        if (status === "loading") return;
        if (status !== "authed") {
            openLoginModal({ message: "Sign in to turn your code into a visualization." });
            return;
        }

        const { code, language } = readEditor();
        const check = checkRunnableCode(code);
        if (!check.ok) {
            setError(check.message);
            return;
        }

        abort.current?.abort();
        const ctl = new AbortController();
        abort.current = ctl;
        setLoading(true);
        setError(null);

        try {
            const text = await requestScript(code, language, ctl.signal);
            if (ctl.signal.aborted) return;

            const compiled = compileScript(text);
            if (!compiled.ok) {
                const first = compiled.diagnostics.find((d) => d.severity === "error");
                throw new VisualizeError(first ? `The generated visualization is invalid: ${first.message}` : "The generated visualization is invalid. Try changing your code.");
            }
            if (ctl.signal.aborted) return;

            store.getState().load(compiled);
            saveScript(text);
            useWorkspace.getState().setSavedVisualization(null); // a fresh script is not a saved item yet
        } catch (e) {
            if ((e as Error).name === "AbortError") return;
            setError(e instanceof Error ? e.message : "Something went wrong while generating your visualization.");
        } finally {
            if (abort.current === ctl) {
                setLoading(false);
                abort.current = null;
            }
        }
    }, [store, status, openLoginModal]);

    return { visualize, loading, error };
}
