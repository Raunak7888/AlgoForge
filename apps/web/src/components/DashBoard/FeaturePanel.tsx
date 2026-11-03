"use client";

import dynamic from "next/dynamic";
import AnalysisPanel from "./Analysis";
import AnalysisHistory, { type AnalysisHistoryMeta } from "./analysis-history";
import type { FeatureType } from "./DashBoard";
import { SAMPLE_HISTORY, SAMPLE_META } from "@/data/samples/analysisHistory";
import { MOCK_DATA_ENABLED } from "@/lib/featureFlags";

// Loaded only when the Visualizer tab is opened: keeps Monaco, anime.js and the canvas out of the main bundle.
const VisualizerPanel = dynamic(() => import("../visualizers/ui/VisualizerPanel").then((m) => m.VisualizerPanel), {
    ssr: false,
    loading: () => <div aria-busy aria-label="Loading visualizer" className="h-full animate-pulse rounded-xl bg-primary-foreground/5" />,
});

const EMPTY_META: AnalysisHistoryMeta = { nextCursor: null, hasMore: false };
const noop = () => {};

export default function FeaturePanel({ activeFeature }: { activeFeature: FeatureType }) {
    return (
        <div className="h-full w-full overflow-hidden rounded-xl bg-primary-background shadow-inner">
            {activeFeature === "analysis" && <AnalysisPanel language="python" onComplete={noop} />}

            {activeFeature === "visualizer" && <VisualizerPanel />}

            {activeFeature === "history" && (
                <AnalysisHistory
                    items={MOCK_DATA_ENABLED ? SAMPLE_HISTORY : []}
                    meta={MOCK_DATA_ENABLED ? SAMPLE_META : EMPTY_META}
                    sample={MOCK_DATA_ENABLED}
                    onLoadMore={noop}
                />
            )}
        </div>
    );
}
