import { LIMITS, type CreateVisualizationRequest, type UpdateVisualizationRequest } from "@algoforge/contracts";
import type { Prisma } from "@algoforge/db";
import { SCRIPT_SCHEMA_VERSION } from "@algoforge/visualizer-core";
import { visualizationRepository, type VisualizationWrite } from "../repositories/visualization.repository";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";
import { assertValidScript } from "./script.service";

const asJson = (value: unknown) => value as unknown as Prisma.InputJsonValue;

/**
 * Ownership-safe data access for saved visualizations.
 * Every method takes the acting user's id and passes it into the query, so another
 * person's row is simply "not found". Scripts are compiled with the shared compiler before they are stored.
 */
class VisualizationService {
  create(userId: string, data: VisualizationWrite) {
    return visualizationRepository.create(userId, data);
  }

  async get(userId: string, id: string) {
    const row = await visualizationRepository.findOneByUser(id, userId);
    if (!row) throw AppError.notFound("Visualization not found.");
    return row;
  }

  async list(userId: string, query: { limit: number; cursor?: string }) {
    const rows = await visualizationRepository.findPageByUser(userId, { take: query.limit + 1, cursor: query.cursor });
    return paginate(rows, query.limit, (row) => row.id);
  }

  async update(userId: string, id: string, patch: Partial<VisualizationWrite>) {
    const result = await visualizationRepository.updateByUser(id, userId, patch);
    if (result.count === 0) throw AppError.notFound("Visualization not found.");
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await visualizationRepository.deleteByUser(id, userId);
    if (result.count === 0) throw AppError.notFound("Visualization not found.");
  }

  /** Validate the script, enforce the per-user cap, then store it with the derived structures and step count. */
  async createFromRequest(userId: string, input: CreateVisualizationRequest) {
    const analysis = assertValidScript(input.script);
    const count = await visualizationRepository.countByUser(userId);
    if (count >= LIMITS.visualization.maxPerUser) {
      throw AppError.conflict(`You have reached the limit of ${LIMITS.visualization.maxPerUser} saved visualizations. Delete one first.`);
    }
    return this.create(userId, {
      title: input.title,
      description: input.description ?? null,
      script: input.script,
      code: input.code ?? null,
      language: input.language ?? null,
      structures: asJson(analysis.structures),
      stepCount: analysis.stepCount,
      schemaVersion: SCRIPT_SCHEMA_VERSION,
    });
  }

  async updateFromRequest(userId: string, id: string, input: UpdateVisualizationRequest) {
    const patch: Partial<VisualizationWrite> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.code !== undefined) patch.code = input.code;
    if (input.language !== undefined) patch.language = input.language;
    if (input.script !== undefined) {
      const analysis = assertValidScript(input.script);
      patch.script = input.script;
      patch.structures = asJson(analysis.structures);
      patch.stepCount = analysis.stepCount;
      patch.schemaVersion = SCRIPT_SCHEMA_VERSION;
    }
    return this.update(userId, id, patch);
  }
}

export const visualizationService = new VisualizationService();
