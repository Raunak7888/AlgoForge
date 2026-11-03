"use client";
import { btn } from "../shared/styles";
import { useTheme } from "./theme";

export function ThemeToggle() {
    const [theme, toggle] = useTheme();
    const next = theme === "dark" ? "light" : "dark";
    const current = theme === "dark" ? "Dark" : "Light";
    return (
        <button type="button" className={btn} onClick={toggle} aria-label={`${current} theme. Switch to ${next} theme`} title={`Switch to ${next} theme`}>
            {current}
        </button>
    );
}