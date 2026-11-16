import { prisma, Prisma } from "@algoforge/db";

export interface DraftWrite {
  language: string;
  codes: { javascript: string; python: string };
  clientUpdatedAt: Date;
}

export const draftRepository = {
  findByUser(userId: string) {
    return prisma.workspaceDraft.findUnique({ where: { userId } });
  },

  /**
   * Stores the draft only when it is newer than the stored one. The comparison lives in the query,
   * so two tabs saving at the same moment cannot overwrite each other with older content.
   * Returns the draft that is stored afterwards.
   */
  async saveIfNewer(userId: string, data: DraftWrite) {
    const codes = data.codes as unknown as Prisma.InputJsonValue;
    const updated = await prisma.workspaceDraft.updateMany({
      where: { userId, clientUpdatedAt: { lt: data.clientUpdatedAt } },
      data: { language: data.language, codes, clientUpdatedAt: data.clientUpdatedAt },
    });
    if (updated.count === 0) {
      try {
        await prisma.workspaceDraft.create({ data: { userId, language: data.language, codes, clientUpdatedAt: data.clientUpdatedAt } });
      } catch (error) {
        // A row already exists and is as new or newer: keep it.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    const row = await prisma.workspaceDraft.findUnique({ where: { userId } });
    if (!row) throw new Error("Draft disappeared after saving.");
    return row;
  },
};
