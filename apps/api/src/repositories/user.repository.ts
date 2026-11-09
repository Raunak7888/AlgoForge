//# filename: apps/api/src/repositories/user.repository.ts

import { prisma, Role } from "@algoforge/db";

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

  findByUsername(username: string) {
    return prisma.user.findUnique({ where: { username }, select: { id: true } });
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

  /** Name and username as edited by the person themselves. Only the keys present are written. */
  updateNameAndUsername(id: string, data: { name?: string; username?: string }) {
    return prisma.user.update({ where: { id }, data, select: userSelect });
  },

  touchLastLogin(id: string, at: Date) {
    return prisma.user.update({ where: { id }, data: { lastLoginAt: at }, select: { id: true } });
  },

  setRole(id: string, role: Role) {
    return prisma.user.update({ where: { id }, data: { role }, select: userSelect });
  },

  countAdmins() {
    return prisma.user.count({ where: { role: Role.ADMIN } });
  },

  /** Cascades to accounts, sessions, analyses and explanation sessions (onDelete: Cascade in the schema). */
  deleteById(id: string) {
    return prisma.user.delete({ where: { id }, select: { id: true } });
  },
  listShareIds(userId: string) {
    return prisma.share.findMany({ where: { ownerId: userId }, select: { shareId: true } });
  },
};
