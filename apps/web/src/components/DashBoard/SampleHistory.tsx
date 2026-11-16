"use client";

import { SAMPLE_HISTORY, SAMPLE_META } from "@/data/samples/analysisHistory";
import AnalysisHistory from "./analysis-history";

const noop = () => {};

/** Development-only sample rows (see FeaturePanel). */
export default function SampleHistory() {
    return <AnalysisHistory items={SAMPLE_HISTORY} meta={SAMPLE_META} sample onLoadMore={noop} />;
}
