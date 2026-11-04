import { visualizationRepository, type VisualizationWrite } from "../repositories/visualization.repository";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";

/**
 * Ownership-safe data access for saved visualizations. No HTTP routes and no script compilation here:
 * those arrive in Phase 6. Every method takes the acting user's id and passes it into the query.
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
}

export const visualizationService = new VisualizationService();
