"use client";
import { useStore } from "zustand";
import { createVisualizer, type VisualizerStore } from "./store";

/** The app-wide visualizer. One canvas, one transport. */
export const visualizer = createVisualizer();

export function useVisualizer<T>(selector: (s: VisualizerStore) => T): T {
    return useStore(visualizer, selector);
}
