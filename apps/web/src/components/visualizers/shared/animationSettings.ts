"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";

export interface AnimationSettings {
  /** Playback-rate multiplier. 2 = twice as fast. Authored durations are untouched. */
  speed: number;
  /** Base duration (ms) of one animation step at speed 1. */
  duration: number;
  /** Max frames/second the Anime.js engine renders. Smoothness only, never tempo. */
  fps: number;
  /** null = follow OS prefers-reduced-motion; true/false = user override. */
  reducedMotion: boolean | null;
}

export const DEFAULT_DURATION = 750;

export const ANIMATION_DEFAULTS: AnimationSettings = {
  speed: 1,
  duration: DEFAULT_DURATION,
  fps: 60,
  reducedMotion: null,
};

export const ANIMATION_LIMITS = {
  speed: { min: 0.25, max: 4, step: 0.25 },
  duration: { min: 150, max: 2250, step: 50 },
  fps: { min: 10, max: 120, step: 10 },
} as const;

interface SettingsStore extends AnimationSettings {
  update: (patch: Partial<AnimationSettings>) => void;
}

export const useAnimationSettings = create<SettingsStore>((set) => ({
  ...ANIMATION_DEFAULTS,
  update: (patch) => set(patch),
}));

export function useReducedMotion(): boolean {
  const override = useAnimationSettings((s) => s.reducedMotion);
  const [system, setSystem] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystem(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return override ?? system;
}
