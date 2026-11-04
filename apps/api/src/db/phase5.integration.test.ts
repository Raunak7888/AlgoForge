/* Runs only when PHASE5_TEST_DATABASE_URL points at a database that already has every migration applied.
   phase5.sh starts a throwaway Postgres for this. Without the variable, these tests are skipped. */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionMessage } from "../services/explanation-session.service";

const url = process.env.PHASE5_TEST_DATABASE_URL;
const sid = () => randomBytes(9).toString("base64url");

describe.skipIf(!url)("Phase 5 database behaviour", () => {
  let prisma: typeof import("@algoforge/db").prisma;
  let shareRepository: typeof import("../repositories/share.repository").shareRepository;
  let visualizationRepository: typeof import("../repositories/visualization.repository").visualizationRepository;
  let analysisRepository: typeof import("../repositories/analysis.repository").analysisRepository;
  let hashCode: typeof import("../repositories/analysis.repository").hashCode;
  let sessionRepository: typeof import("../repositories/explanation-session.repository").explanationSessionRepository;
  let categoryRepository: typeof import("../repositories/category.repository").categoryRepository;
  let aiUsageService: typeof import("../services/ai-usage.service").aiUsageService;
  let shareService: typeof import("../services/share.service").shareService;
  let auditService: typeof import("../services/audit.service").auditService;

  const userIds: string[] = [];
  const newUser = async () => {
    const u = await prisma.user.create({ data: { email: `p5-${randomUUID()}@example.invalid` }, select: { id: true } });
    userIds.push(u.id);
    return u.id;
  };
  const viz = (userId: string, title = "t") =>
    visualizationRepository.create(userId, { title, script: "[]", structures: [], stepCount: 0 });
  const msgs = (n: number): SessionMessage[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `c${i}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }));

  beforeAll(async () => {
    process.env.DATABASE_URL = url as string;
    ({ prisma } = await import("@algoforge/db"));
    ({ shareRepository } = await import("../repositories/share.repository"));
    ({ visualizationRepository } = await import("../repositories/visualization.repository"));
    ({ analysisRepository, hashCode } = await import("../repositories/analysis.repository"));
    ({ explanationSessionRepository: sessionRepository } = await import("../repositories/explanation-session.repository"));
    ({ categoryRepository } = await import("../repositories/category.repository"));
    ({ aiUsageService } = await import("../services/ai-usage.service"));
    ({ shareService } = await import("../services/share.service"));
    ({ auditService } = await import("../services/audit.service"));
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });

  it("visualizations: another user can neither read, change nor delete", async () => {
    const a = await newUser();
    const b = await newUser();
    const v = await viz(a);
    expect(await visualizationRepository.findOneByUser(v.id, b)).toBeNull();
    expect((await visualizationRepository.updateByUser(v.id, b, { title: "hijack" })).count).toBe(0);
    expect((await visualizationRepository.deleteByUser(v.id, b)).count).toBe(0);
    expect((await visualizationRepository.findOneByUser(v.id, a))?.title).toBe("t");
    expect((await visualizationRepository.updateByUser(v.id, a, { title: "mine" })).count).toBe(1);
    expect((await visualizationRepository.findPageByUser(b, { take: 10 })).map((r) => r.id)).not.toContain(v.id);
    expect((await visualizationRepository.deleteByUser(v.id, a)).count).toBe(1);
  });

  it("visualizations: deleting a parent keeps its forks (fork link is cleared)", async () => {
    const a = await newUser();
    const parent = await viz(a, "parent");
    const fork = await visualizationRepository.create(a, { title: "fork", script: "[]", structures: [], stepCount: 0, forkedFromId: parent.id });
    await visualizationRepository.deleteByUser(parent.id, a);
    expect((await visualizationRepository.findOneByUser(fork.id, a))?.forkedFromId).toBeNull();
  });

  it("visualizations: deleting one also deletes its share (no orphans)", async () => {
    const a = await newUser();
    const v = await viz(a);
    await shareService.create(a, "visualization", v.id);
    await visualizationRepository.deleteByUser(v.id, a);
    expect(await prisma.share.count({ where: { type: "visualization", targetId: v.id } })).toBe(0);
  });

  it("visualizations: the database rejects a negative step count", async () => {
    const a = await newUser();
    await expect(visualizationRepository.create(a, { title: "x", script: "[]", structures: [], stepCount: -1 })).rejects.toBeTruthy();
  });

  it("shares: only the owner can create, idempotent, revoke, and a revoked link stays dead", async () => {
    const a = await newUser();
    const b = await newUser();
    const v = await viz(a);
    expect(await shareRepository.createForOwnedTarget(b, "visualization", v.id, sid())).toBeNull();
    const first = await shareService.create(a, "visualization", v.id);
    const again = await shareService.create(a, "visualization", v.id);
    expect(again.shareId).toBe(first.shareId);
    expect((await shareRepository.findActiveByShareId(first.shareId))?.targetId).toBe(v.id);
    expect((await shareRepository.revokeByOwner(first.shareId, b)).count).toBe(0);
    expect((await shareRepository.revokeByOwner(first.shareId, a)).count).toBe(1);
    expect(await shareRepository.findActiveByShareId(first.shareId)).toBeNull();
    const reopened = await shareService.create(a, "visualization", v.id);
    expect(reopened.shareId).not.toBe(first.shareId);
    expect(await shareRepository.findActiveByShareId(first.shareId)).toBeNull();
    expect((await shareRepository.findActiveByShareId(reopened.shareId))?.revokedAt).toBeNull();
  });

  it("shares: one row per target and expired shares do not resolve", async () => {
    const a = await newUser();
    const v = await viz(a);
    const s = await shareService.create(a, "visualization", v.id);
    await expect(prisma.share.create({ data: { shareId: sid(), type: "visualization", targetId: v.id, ownerId: a } })).rejects.toBeTruthy();
    await prisma.share.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() + 60_000) } });
    expect(await shareRepository.findActiveByShareId(s.shareId)).not.toBeNull();
    expect(await shareRepository.findActiveByShareId(s.shareId, new Date(Date.now() + 120_000))).toBeNull();
  });

  it("shares: view counts only grow for active shares", async () => {
    const a = await newUser();
    const v = await viz(a);
    const s = await shareService.create(a, "visualization", v.id);
    await shareRepository.incrementViewCount(s.shareId);
    await shareRepository.incrementViewCount(s.shareId);
    await shareRepository.revokeByOwner(s.shareId, a);
    await shareRepository.incrementViewCount(s.shareId);
    expect((await prisma.share.findUniqueOrThrow({ where: { id: s.id } })).viewCount).toBe(2);
  });

  it("analyses: code hash is stored, and only the owner can make one public", async () => {
    const a = await newUser();
    const b = await newUser();
    const created = await analysisRepository.create({ userId: a, code: "let x = 1;", language: "javascript", complexity: null, suggestion: null, result: {} });
    const row = await prisma.analysis.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.codeHash).toBe(hashCode("let x = 1;"));
    await expect(analysisRepository.setPublic(created.id, b, sid())).rejects.toMatchObject({ statusCode: 404 });
    expect((await prisma.analysis.findUniqueOrThrow({ where: { id: created.id } })).isPublic).toBe(false);
    const shareId = sid();
    await analysisRepository.setPublic(created.id, a, shareId);
    const pub = await prisma.analysis.findUniqueOrThrow({ where: { id: created.id } });
    expect(pub.isPublic).toBe(true);
    expect((await prisma.share.findUniqueOrThrow({ where: { shareId } })).targetId).toBe(created.id);
  });

  it("chat: messages mirror into explanation_messages and only the owner can write", async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await sessionRepository.create(a, "chat");
    await expect(sessionRepository.appendMessages(s.id, b, msgs(2), "x")).rejects.toMatchObject({ statusCode: 404 });
    expect(await prisma.explanationMessage.count({ where: { sessionId: s.id } })).toBe(0);
    await sessionRepository.appendMessages(s.id, a, msgs(4), "x");
    await sessionRepository.appendMessages(s.id, a, msgs(6), "x");
    const rows = await prisma.explanationMessage.findMany({ where: { sessionId: s.id }, orderBy: { seq: "asc" } });
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows[0].role).toBe("user");
    await expect(prisma.explanationMessage.create({ data: { sessionId: s.id, seq: 1, role: "user", content: "dup" } })).rejects.toBeTruthy();
  });

  it("chat: sharing and deleting keep shares and messages consistent", async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await sessionRepository.create(a, "chat");
    await sessionRepository.appendMessages(s.id, a, msgs(2), "x");
    await expect(sessionRepository.share(s.id, b, sid())).rejects.toMatchObject({ statusCode: 404 });
    const shareId = sid();
    await sessionRepository.share(s.id, a, shareId);
    expect((await shareRepository.findActiveByShareId(shareId))?.type).toBe("explain");
    expect((await sessionRepository.delete(s.id, b)).count).toBe(0);
    expect((await sessionRepository.delete(s.id, a)).count).toBe(1);
    expect(await prisma.share.count({ where: { shareId } })).toBe(0);
    expect(await prisma.explanationMessage.count({ where: { sessionId: s.id } })).toBe(0);
  });

  it("ai usage: one row per user, feature and day, and parallel requests are all counted", async () => {
    const a = await newUser();
    await Promise.all(Array.from({ length: 10 }, () => aiUsageService.record(a, "analysis", { tokensIn: 1, tokensOut: 2 })));
    const rows = await prisma.aiUsage.findMany({ where: { userId: a } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ requests: 10, tokensIn: 10, tokensOut: 20 });
    await expect(prisma.aiUsage.create({ data: { userId: a, feature: "analysis", day: rows[0].day, requests: -1 } })).rejects.toBeTruthy();
  });

  it("audit log: rows are written, survive their actor, and a bad actor never throws", async () => {
    const actor = await newUser();
    expect(await auditService.record({ actorId: actor, action: "test.action", target: { type: "thing", id: "t1" }, meta: { token: "x", n: 1 } })).toBe(true);
    const row = await prisma.auditLog.findFirstOrThrow({ where: { actorId: actor, action: "test.action" } });
    expect(row.meta).toEqual({ token: "[redacted]", n: 1 });
    await prisma.user.delete({ where: { id: actor } });
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } })).actorId).toBeNull();
    expect(await auditService.record({ actorId: "no-such-user", action: "test.bad" })).toBe(false);
  });

  it("categories get slug = id, and algorithms keep their rows when the creator is deleted", async () => {
    const creator = await newUser();
    const id = `p5-${randomUUID().slice(0, 8)}`;
    const cat = await categoryRepository.create({ id, label: "P5", sortOrder: 0 });
    expect(cat.slug).toBe(id);
    const algo = await prisma.algorithm.create({ data: { slug: id, name: "A", description: "d", categoryId: id, createdById: creator } });
    await prisma.user.delete({ where: { id: creator } });
    expect((await prisma.algorithm.findUniqueOrThrow({ where: { id: algo.id } })).createdById).toBeNull();
    await prisma.algorithm.delete({ where: { id: algo.id } });
    await prisma.category.delete({ where: { id } });
  });
});
