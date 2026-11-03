"use client";
import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand/vanilla";
import { currentIndex } from "../engine/selectors";
import type { VisualizerStore } from "../engine/store";
import { commandFor, ignoresSpace, isTypingTarget, stepSpeed, type Command } from "./hotkeys";

export interface UiHandlers {
    messages: () => void;
    help: () => void;
}

/** Window-level shortcuts for the transport. Ignored while typing and inside the editor. */
export function useTransportHotkeys(store: StoreApi<VisualizerStore>, ui: UiHandlers): void {
    const uiRef = useRef(ui);
    useEffect(() => {
        uiRef.current = ui;
    });

    useEffect(() => {
        const run = (cmd: Command) => {
            const s = store.getState();
            const t = s.transport;
            switch (cmd) {
                case "toggle":
                    return s.toggle();
                case "stepBack":
                    return s.stepBack();
                case "stepForward":
                    return s.stepForward();
                case "back5":
                    return s.seek(currentIndex(t) - 5);
                case "forward5":
                    return s.seek(currentIndex(t) + 5);
                case "replay":
                    return s.replayStep();
                case "restart":
                    return s.restart();
                case "end":
                    return s.jumpToEnd();
                case "slower":
                    return s.setSpeed(stepSpeed(t.speed, -1));
                case "faster":
                    return s.setSpeed(stepSpeed(t.speed, 1));
                case "loop":
                    return s.setLoop(!t.loop);
                case "messages":
                    return uiRef.current.messages();
                case "help":
                    return uiRef.current.help();
            }
        };
        const onKey = (e: KeyboardEvent) => {
            const cmd = commandFor(e);
            if (!cmd) return;
            const target = e.target as HTMLElement | null;
            if (isTypingTarget(target)) return;
            if (cmd === "toggle" && ignoresSpace(target)) return;
            e.preventDefault();
            run(cmd);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [store]);
}
