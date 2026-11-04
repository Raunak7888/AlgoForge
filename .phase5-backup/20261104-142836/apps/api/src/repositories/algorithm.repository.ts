//# filename: apps/api/src/repositories/algorithm.repository.ts

import { prisma, Prisma } from "@algoforge/db";
import type { Difficulty } from "@algoforge/db";

const listSelect = {
  id: true,
  slug: true,
  name: true,
  categoryId: true,
  difficulty: true,
  timeBest: true,
  timeAverage: true,
  timeWorst: true,
  spaceComplexity: true,
} as const;

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  difficulty: true,
  categoryId: true,
  isPublished: true,
  timeBest: true,
  timeAverage: true,
  timeWorst: true,
  spaceComplexity: true,
  displayCodes: { select: { language: true, code: true } },
  forge: {
    select: {
      forgeCode: true,
      inputSchema: true,
      guardRanges: true,
      version: true,
    },
  },
  tags: { select: { tag: { select: { id: true, label: true } } } },
} as const;

export type AlgorithmListRow = Awaited<
  ReturnType<typeof algorithmRepository.findMany>
>[number];

export type AlgorithmDetailRow = Awaited<
  ReturnType<typeof algorithmRepository.findById>
>;

export const algorithmRepository = {
  findMany(where: Prisma.AlgorithmWhereInput) {
    return prisma.algorithm.findMany({
      where,
      select: listSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.algorithm.findUnique({ where: { id }, select: detailSelect });
  },

  findBySlug(slug: string) {
    return prisma.algorithm.findUnique({ where: { slug }, select: detailSelect });
  },

  findBySlugExists(slug: string) {
    return prisma.algorithm.findUnique({
      where: { slug },
      select: { id: true },
    });
  },

  findByIdWithForge(id: string) {
    return prisma.algorithm.findUnique({
      where: { id },
      include: { forge: true },
    });
  },

  create(data: {
    slug: string;
    name: string;
    description: string;
    categoryId: string;
    difficulty: Difficulty;
    isPublished: boolean;
    timeBest: string | null;
    timeAverage: string | null;
    timeWorst: string | null;
    spaceComplexity: string | null;
    displayCodes: { language: string; code: string }[];
    forge: {
      forgeCode: Prisma.InputJsonValue;
      inputSchema: Prisma.InputJsonValue;
      guardRanges: Prisma.InputJsonValue;
    };
    tags: string[];
  }) {
    return prisma.algorithm.create({
      data: {
        slug: data.slug,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        difficulty: data.difficulty,
        isPublished: data.isPublished,
        timeBest: data.timeBest,
        timeAverage: data.timeAverage,
        timeWorst: data.timeWorst,
        spaceComplexity: data.spaceComplexity,
        displayCodes: { create: data.displayCodes },
        forge: { create: data.forge },
        tags: {
          create: data.tags.map((label) => ({
            tag: {
              connectOrCreate: {
                where: { label },
                create: { label },
              },
            },
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
          const tag = await tx.tag.upsert({
            where: { label },
            create: { label },
            update: {},
          });
          await tx.algorithmTag.create({
            data: { algorithmId: id, tagId: tag.id },
          });
        }
      }

      return tx.algorithm.update({
        where: { id },
        data: rest,
        select: detailSelect,
      });
    });
  },

  delete(id: string) {
    return prisma.algorithm.delete({ where: { id } });
  },

  upsertForge(
    algorithmId: string,
    forge: {
      forgeCode: Prisma.InputJsonValue;
      inputSchema: Prisma.InputJsonValue;
      guardRanges: Prisma.InputJsonValue;
    },
  ) {
    return prisma.forgeConfig.upsert({
      where: { algorithmId },
      create: { algorithmId, ...forge },
      update: forge,
    });
  },
};