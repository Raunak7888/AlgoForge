//# filename: apps/api/src/repositories/user.repository.ts

import { prisma } from "@algoforge/db";
import { Role } from "@algoforge/db";

const userSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  image: true,
  role: true,
} as const;

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: userSelect });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email }, select: userSelect });
  },

  findPublicById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, username: true, image: true },
    });
  },

  /** Keyset-style page over users, newest first. `take` should be limit + 1 to detect a next page. */
  findPage(opts: { take: number; cursor?: string }) {
    return prisma.user.findMany({
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  },

  create(data: {
    email: string | null;
    name: string | null;
    image: string | null;
    role: Role;
  }) {
    return prisma.user.create({ data, select: userSelect });
  },

  updateProfile(
    id: string,
    data: { email?: string | null; name?: string | null; image?: string | null },
  ) {
    return prisma.user.update({ where: { id }, data, select: userSelect });
  },

  setRole(id: string, role: Role) {
    return prisma.user.update({ where: { id }, data: { role }, select: userSelect });
  },
};
