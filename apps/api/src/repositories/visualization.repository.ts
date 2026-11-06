import { prisma, Prisma } from "@algoforge/db";

const summarySelect = {
  id: true,
  title: true,
  description: true,
  language: true,
  structures: true,
  stepCount: true,
  schemaVersion: true,
  forkedFromId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface VisualizationWrite {
  title: string;
  description?: string | null;
  script: string;
  code?: string | null;
  language?: string | null;
  structures: Prisma.InputJsonValue;
  stepCount: number;
  schemaVersion?: number;
  forkedFromId?: string | null;
}

/** Every read and write below is scoped by userId inside the query itself, so an IDOR cannot be reintroduced by a caller forgetting a check. */
export const visualizationRepository = {
  create(userId: string, data: VisualizationWrite) {
    return prisma.visualization.create({
      data: {
        userId,
        title: data.title,
        description: data.description ?? null,
        script: data.script,
        code: data.code ?? null,
        language: data.language ?? null,
        structures: data.structures,
        stepCount: data.stepCount,
        schemaVersion: data.schemaVersion ?? 1,
        forkedFromId: data.forkedFromId ?? null,
      },
    });
  },

  findOneByUser(id: string, userId: string) {
    return prisma.visualization.findFirst({ where: { id, userId } });
  },

  async existsByUser(id: string, userId: string): Promise<boolean> {
    return (await prisma.visualization.count({ where: { id, userId } })) > 0;
  },

  /** Newest first. `take` should be limit + 1 to detect a next page. */
  findPageByUser(userId: string, opts: { take: number; cursor?: string }) {
    return prisma.visualization.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: summarySelect,
    });
  },

  updateByUser(id: string, userId: string, patch: Partial<VisualizationWrite>) {
    const data: Prisma.VisualizationUncheckedUpdateManyInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.script !== undefined) data.script = patch.script;
    if (patch.code !== undefined) data.code = patch.code;
    if (patch.language !== undefined) data.language = patch.language;
    if (patch.structures !== undefined) data.structures = patch.structures;
    if (patch.stepCount !== undefined) data.stepCount = patch.stepCount;
    if (patch.schemaVersion !== undefined) data.schemaVersion = patch.schemaVersion;
    return prisma.visualization.updateMany({ where: { id, userId }, data });
  },

  deleteByUser(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const result = await tx.visualization.deleteMany({ where: { id, userId } });
      if (result.count > 0) await tx.share.deleteMany({ where: { type: "visualization", targetId: id } });
      return result;
    });
  },

  /** Title or description contains the term. Scoped to the owner inside the query. */
  searchByUser(userId: string, term: string, take: number) {
    const mode = Prisma.QueryMode.insensitive;
    return prisma.visualization.findMany({
      where: { userId, OR: [{ title: { contains: term, mode } }, { description: { contains: term, mode } }] },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take,
      select: { id: true, title: true, description: true },
    });
  },

  countByUser(userId: string) {
    return prisma.visualization.count({ where: { userId } });
  },
};
