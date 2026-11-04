"use client";

import dynamic from "next/dynamic";
import { FeatureGate, type FeatureCopy } from "@/components/auth/FeatureGate";
import AnalysisPanel from "./Analysis";
import AnalysisHistory from "./analysis-history";
import type { FeatureType } from "./DashBoard";
import { SAMPLE_HISTORY, SAMPLE_META } from "@/data/samples/analysisHistory";

// Loaded only when the Visualizer tab is opened: keeps Monaco, anime.js and the canvas out of the main bundle.
const VisualizerPanel = dynamic(() => import("../visualizers/ui/VisualizerPanel").then((m) => m.VisualizerPanel), {
    ssr: false,
    loading: () => <div aria-busy aria-label="Loading visualizer" className="h-full animate-pulse rounded-xl bg-primary-foreground/5" />,
});

const noop = () => {};

const HISTORY_COPY: FeatureCopy = {
    signInTitle: "Sign in to see your history",
    signInBody: "Your past analyses are saved to your account. The editor and the visualizer work without one.",
    unavailableTitle: "History isn't available yet",
    unavailableBody: "Saved analyses are not connected to this build. The Visualizer works today: pick it in the toolbar.",
};

export default function FeaturePanel({ activeFeature }: { activeFeature: FeatureType }) {
    return (
        <div className="h-full w-full overflow-hidden rounded-xl bg-primary-background shadow-inner">
            {activeFeature === "analysis" && <AnalysisPanel language="python" onComplete={noop} />}

            {activeFeature === "visualizer" && <VisualizerPanel />}

            {activeFeature === "history" && (
                <FeatureGate
                    feature="analysis"
                    copy={HISTORY_COPY}
                    preview={<AnalysisHistory items={SAMPLE_HISTORY} meta={SAMPLE_META} sample onLoadMore={noop} />}
                />
            )}
        </div>
    );
}
