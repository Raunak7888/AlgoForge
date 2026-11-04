//# filename: apps/api/src/repositories/category.repository.ts

import { prisma } from "@algoforge/db";

export const categoryRepository = {
  findAll() {
    return prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  },

  findByIdentifier(identifier: string) {
    return prisma.category.findFirst({
      where: {
        OR: [
          { id: identifier },
          { label: { equals: identifier.replace(/-/g, " "), mode: "insensitive" } },
        ],
      },
    });
  },

  findById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  create(data: {
    id: string;
    label: string;
    description?: string;
    iconName?: string;
    sortOrder: number;
  }) {
    return prisma.category.create({ data });
  },

  update(
    id: string,
    data: {
      label?: string;
      description?: string;
      iconName?: string;
      sortOrder?: number;
    },
  ) {
    return prisma.category.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },

  countAlgorithmsInCategory(id: string) {
    return prisma.algorithm.count({ where: { categoryId: id } });
  },
};
