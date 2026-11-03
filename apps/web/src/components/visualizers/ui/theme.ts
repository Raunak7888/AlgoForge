"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export const THEME_KEY = "algoforge:theme";

/** Anything that is not exactly "light" is dark, so dark is always the default. */
export const resolveTheme = (stored: string | null | undefined): Theme => (stored === "light" ? "light" : "dark");

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
    root.classList.toggle("dark", theme === "dark");
}

function readStored(): string | null {
    try {
        return window.localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
}
function writeStored(theme: Theme): void {
    try {
        window.localStorage.setItem(THEME_KEY, theme);
    } catch {
        /* storage unavailable: the choice just lasts for this visit */
    }
}

export function useTheme(): readonly [Theme, () => void] {
    const [theme, setTheme] = useState<Theme>("dark");
    useEffect(() => {
        const t = resolveTheme(readStored());
        // eslint-disable-next-line react-hooks/set-state-in-effect -- the stored theme can only be read after mount
        setTheme(t);
        applyTheme(t);
    }, []);
    const toggle = useCallback(() => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setTheme(next);
        applyTheme(next);
        writeStored(next);
    }, [theme]);
    return [theme, toggle] as const;
}
