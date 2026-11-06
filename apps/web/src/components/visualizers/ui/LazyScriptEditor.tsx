"use client";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ScriptEditorProps } from "./ScriptEditor";

/** Monaco loads only when the drawer is opened. */
export const LazyScriptEditor: ComponentType<ScriptEditorProps> = dynamic(() => import("./ScriptEditor").then((m) => m.ScriptEditor), {
    ssr: false,
    loading: () => <div aria-busy aria-label="Loading editor" className="h-full animate-pulse rounded-lg bg-primary-foreground/5" />,
});
