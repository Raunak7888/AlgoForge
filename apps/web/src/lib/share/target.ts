import type { ShareType } from "@algoforge/contracts";

export interface ShareTarget {
  type: ShareType;
  id: string;
  title: string;
}
export type ShareFeature = "analysis" | "visualizer" | "history";

export interface WorkspaceShareState {
  run: { status: string; analysisId: string | null; title: string | null };
  selectedAnalysisId: string | null;
  savedVisualization: { id: string; title: string } | null;
}

/** What "Share" means on the active dashboard tab. Null = there is nothing saved to share yet. */
export function targetForFeature(feature: ShareFeature, ws: WorkspaceShareState): ShareTarget | null {
  switch (feature) {
    case "analysis":
      return ws.run.status === "completed" && ws.run.analysisId ? { type: "analysis", id: ws.run.analysisId, title: ws.run.title ?? "Analysis" } : null;
    case "history":
      return ws.selectedAnalysisId ? { type: "analysis", id: ws.selectedAnalysisId, title: "Analysis" } : null;
    case "visualizer":
      return ws.savedVisualization ? { type: "visualization", id: ws.savedVisualization.id, title: ws.savedVisualization.title } : null;
  }
}

export function shareHintFor(feature: ShareFeature): string {
  switch (feature) {
    case "analysis":
      return "Run an analysis first: only saved results can be shared.";
    case "history":
      return "Select an analysis in the list, then press Share.";
    case "visualizer":
      return "Save this visualization to your account first (Script, then Save to account), then share it.";
  }
}
