
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import { ApiError } from "@/lib/api/errors";
import { endpoints } from "@/lib/api/endpoints";
import { useWorkspace } from "@/lib/workspace/store";
import { VisualizerStore } from "../../components/visualizers/engine";
import { visualizer } from "../../components/visualizers/engine/instance";
import { compileScript, saveScript } from "../../components/visualizers/script";

export class VisualizeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "VisualizeError";
    }
}

/**
 * Maps API errors to meaningful user-facing messages.
 */
function getErrorMessage(error: ApiError): string {
    switch (error.status) {
        case 400:
            return "Your code couldn't be processed. Check the code and try again.";

        case 401:
            return "Your session has expired. Please sign in again.";

        case 403:
            return "You don't have permission to use the visualization service.";

        case 404:
            return "The visualization service couldn't be found. Please try again later.";

        case 408:
            return "The request took too long. Try again with a smaller code sample.";

        case 413:
            return "Your code is too large to visualize. Try reducing its size.";

        case 422:
            return "Your code couldn't be converted into a visualization. Check its structure and try again.";

        case 429:
            return "You've made too many visualization requests. Please wait a moment and try again.";

        case 500:
        case 502:
        case 503:
        case 504:
            return "The visualization service is experiencing issues. Please try again shortly.";

        default:
            if (error.status >= 500) {
                return "Something went wrong on our server. Please try again later.";
            }

            return "We couldn't complete your visualization request. Please try again.";
    }
}

/**
 * Reads the code for the active language from the workspace store.
 */
function readEditor() {
    const { language, codes } = useWorkspace.getState();

    return {
        code: codes[language] ?? "",
        language,
    };
}

/**
 * Sends code to the backend and returns the generated script as JSON text.
 */
export async function requestScript(
    code: string,
    language: string,
    signal?: AbortSignal
): Promise<string> {
    let body: unknown;

    try {
        body = await endpoints.generateVisualization({ code, language }, signal);
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            throw error;
        }

        if (error instanceof ApiError) {
            throw new VisualizeError(getErrorMessage(error));
        }

        throw new VisualizeError(
            "Unable to connect to the visualization service. Check your internet connection and try again."
        );
    }

    const script =
        typeof body === "object" && body !== null && "script" in body
            ? body.script
            : body;

    if (script == null || script === "") {
        throw new VisualizeError(
            "No visualization was generated. Try modifying your code and running it again."
        );
    }

    const result =
        typeof script === "string"
            ? script
            : JSON.stringify(script, null, 2);

    if (!result || result.trim() === "") {
        throw new VisualizeError(
            "The visualization service returned an empty response. Please try again."
        );
    }

    return result;
}

/**
 * Requests a visualization, compiles the generated script,
 * and loads it into the visualizer store.
 */
export function useVisualize(
    store: StoreApi<VisualizerStore> = visualizer
) {
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
        const { code, language } = readEditor();

        if (code.trim() === "") {
            setError(
                "Add some code to the editor before generating a visualization."
            );
            return;
        }

        // Cancel any previous visualization request.
        abort.current?.abort();

        const ctl = new AbortController();
        abort.current = ctl;

        setLoading(true);
        setError(null);

        try {
            // Generate visualization script.
            const text = await requestScript(
                code,
                language,
                ctl.signal
            );

            if (ctl.signal.aborted) return;

            // Compile and validate generated script.
            const compiled = compileScript(text);

            if (!compiled.ok) {
                const first = compiled.diagnostics.find(
                    (d) => d.severity === "error"
                );

                throw new VisualizeError(
                    first
                        ? `We couldn't generate a valid visualization: ${first.message}`
                        : "The generated visualization is invalid. Try modifying your code."
                );
            }

            if (ctl.signal.aborted) return;

            // Load visualization and persist generated script.
            store.getState().load(compiled);
            saveScript(text);

            setError(null);
        } catch (e) {
            if ((e as Error).name === "AbortError") {
                return;
            }

            setError(
                e instanceof Error
                    ? e.message
                    : "Something went wrong while generating your visualization. Please try again."
            );
        } finally {
            if (abort.current === ctl) {
                setLoading(false);
                abort.current = null;
            }
        }
    }, [store]);

    return {
        visualize,
        loading,
        error,
    };
}
