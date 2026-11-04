import { z } from "zod";
import {
  AnalysisLanguageSchema,
  VisualizationStructureSchema,
  type Visualization,
  type VisualizationSummary,
} from "@algoforge/contracts";
import { toIso } from "./dates";

const StructuresSchema = z.array(VisualizationStructureSchema);

export interface VisualizationSummaryRow {
  id: string;
  title: string;
  description: string | null;
  language: string | null;
  structures: unknown;
  stepCount: number;
  schemaVersion: number;
  forkedFromId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
export interface VisualizationRow extends VisualizationSummaryRow {
  script: string;
  code: string | null;
}

/** Stored JSON is data, not trusted: anything unreadable degrades to an empty list or null. */
export function serializeVisualizationSummary(row: VisualizationSummaryRow): VisualizationSummary {
  const structures = StructuresSchema.safeParse(row.structures);
  const language = AnalysisLanguageSchema.safeParse(row.language);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    language: language.success ? language.data : null,
    structures: structures.success ? structures.data : [],
    stepCount: row.stepCount,
    schemaVersion: row.schemaVersion,
    forkedFromId: row.forkedFromId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

/** Never includes userId. */
export function serializeVisualization(row: VisualizationRow): Visualization {
  return { ...serializeVisualizationSummary(row), script: row.script, code: row.code };
}
