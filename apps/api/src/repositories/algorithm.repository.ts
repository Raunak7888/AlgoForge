//# filename: apps/api/src/repositories/algorithm.repository.ts

import { prisma, Prisma } from "@algoforge/db";
import type { Difficulty } from "@algoforge/db";

const listSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  categoryId: true,
  category: { select: { label: true } },
  difficulty: true,
  timeBest: true,
  timeAverage: true,
  timeWorst: true,
  spaceComplexity: true,
  tags: { select: { tag: { select: { id: true, label: true } } } },
} as const;

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  difficulty: true,
  categoryId: true,
  category: { select: { label: true } },
  isPublished: true,
  publishedAt: true,
  timeBest: true,
  timeAverage: true,
  timeWorst: true,
  spaceComplexity: true,
  script: true,
  scriptVersion: true,
  displayCodes: { select: { language: true, code: true } },
  tags: { select: { tag: { select: { id: true, label: true } } } },
} as const;

export type AlgorithmListRow = Awaited<ReturnType<typeof algorithmRepository.findPage>>[number];
export type AlgorithmDetailRow = Awaited<ReturnType<typeof algorithmRepository.findById>>;

export const algorithmRepository = {
  /** Stable order (sortOrder, name, id). `take` should be limit + 1 to detect a next page. */
  findPage(where: Prisma.AlgorithmWhereInput, opts: { take: number; cursor?: string }) {
    return prisma.algorithm.findMany({
      where,
      select: listSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
  },

  /** Published algorithms matching a search term (name, description or tag). Used by GET /api/search. */
  searchPublished(term: string, take: number) {
    const mode = Prisma.QueryMode.insensitive;
    return prisma.algorithm.findMany({
      where: {
        isPublished: true,
        OR: [
          { name: { contains: term, mode } },
          { description: { contains: term, mode } },
          { tags: { some: { tag: { label: { contains: term, mode } } } } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take,
      select: { id: true, slug: true, name: true, description: true },
    });
  },

  findById(id: string) {
    return prisma.algorithm.findUnique({ where: { id }, select: detailSelect });
  },

  findBySlug(slug: string) {
    return prisma.algorithm.findUnique({ where: { slug }, select: detailSelect });
  },

  findBySlugExists(slug: string) {
    return prisma.algorithm.findUnique({ where: { slug }, select: { id: true } });
  },

  create(data: {
    slug: string;
    name: string;
    description: string;
    categoryId: string;
    difficulty: Difficulty;
    isPublished: boolean;
    publishedAt?: Date | null;
    createdById?: string | null;
    timeBest: string | null;
    timeAverage: string | null;
    timeWorst: string | null;
    spaceComplexity: string | null;
    displayCodes: { language: string; code: string }[];
    script: string | null;
    scriptVersion: number;
    tags: string[];
  }) {
    return prisma.algorithm.create({
      data: {
        slug: data.slug,
        publishedAt: data.publishedAt ?? null,
        createdById: data.createdById ?? null,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        difficulty: data.difficulty,
        isPublished: data.isPublished,
        timeBest: data.timeBest,
        timeAverage: data.timeAverage,
        timeWorst: data.timeWorst,
        spaceComplexity: data.spaceComplexity,
        script: data.script,
        scriptVersion: data.scriptVersion,
        displayCodes: { create: data.displayCodes },
        tags: {
          create: data.tags.map((label) => ({
            tag: { connectOrCreate: { where: { label }, create: { label } } },
          })),
        },
      },
      select: detailSelect,
    });
  },

  update(
    id: string,
    data: Prisma.AlgorithmUpdateInput & {
      displayCodes?: { language: string; code: string }[];
      tags?: string[];
    },
  ) {
    const { displayCodes, tags, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      if (displayCodes) {
        await tx.displayCode.deleteMany({ where: { algorithmId: id } });
        await tx.displayCode.createMany({
          data: displayCodes.map((dc) => ({ ...dc, algorithmId: id })),
        });
      }

      if (tags) {
        await tx.algorithmTag.deleteMany({ where: { algorithmId: id } });
        for (const label of tags) {
          const tag = await tx.tag.upsert({ where: { label }, create: { label }, update: {} });
          await tx.algorithmTag.create({ data: { algorithmId: id, tagId: tag.id } });
        }
      }

      return tx.algorithm.update({ where: { id }, data: rest, select: detailSelect });
    });
  },

  delete(id: string) {
    return prisma.algorithm.delete({ where: { id } });
  },
};
