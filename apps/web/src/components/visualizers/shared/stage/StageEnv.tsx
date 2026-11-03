"use client";
import { createContext, useContext } from "react";
import type { createTimeline } from "animejs";

type Timeline = ReturnType<typeof createTimeline>;

/**
 * Where a stage registers the timeline it is running, so playback can pause, resume and speed it up.
 * Every structure on the shared canvas gets its own sink, so several can animate together under one set of controls.
 */
export interface TimelineSink {
    set(tl: Timeline): void;
    clear(tl?: Timeline): void;
}

/** Outside a canvas group there is nothing to control, so stages run with a do-nothing sink. */
const noopSink: TimelineSink = { set() {}, clear() {} };

const Ctx = createContext<TimelineSink>(noopSink);

export const TimelineSinkProvider = Ctx.Provider;
export const useTimelineSink = (): TimelineSink => useContext(Ctx);
