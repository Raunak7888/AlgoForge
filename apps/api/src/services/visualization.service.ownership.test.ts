import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";

vi.mock("../repositories/visualization.repository", () => ({
  visualizationRepository: {
    create: vi.fn(),
    findOneByUser: vi.fn(),
    findPageByUser: vi.fn(),
    updateByUser: vi.fn(),
    deleteByUser: vi.fn(),
    countByUser: vi.fn(),
    searchByUser: vi.fn(),
  },
}));

import { visualizationRepository as repo } from "../repositories/visualization.repository";
import { visualizationService } from "./visualization.service";

const good = JSON.stringify([{ step: 1, id: "A", ds: "array", op: "initialize", values: [1, 2] }]);
const m = <T extends (...a: never[]) => unknown>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

describe("visualization ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get passes the acting user into the query and hides other people's rows", async () => {
    m(repo.findOneByUser).mockResolvedValue(null);
    await expect(visualizationService.get("me", "v1")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findOneByUser).toHaveBeenCalledWith("v1", "me");
  });

  it("update and delete are 404 when the owner does not match", async () => {
    m(repo.updateByUser).mockResolvedValue({ count: 0 });
    m(repo.deleteByUser).mockResolvedValue({ count: 0 });
    await expect(visualizationService.update("me", "v1", { title: "x" })).rejects.toBeInstanceOf(AppError);
    await expect(visualizationService.remove("me", "v1")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.updateByUser).toHaveBeenCalledWith("v1", "me", { title: "x" });
    expect(repo.deleteByUser).toHaveBeenCalledWith("v1", "me");
  });

  it("create validates the script, stores derived fields, and respects the per-user cap", async () => {
    m(repo.countByUser).mockResolvedValue(0);
    m(repo.create).mockResolvedValue({ id: "new" });
    await visualizationService.createFromRequest("me", { title: "t", script: good });
    expect(repo.create).toHaveBeenCalledWith("me", expect.objectContaining({ stepCount: 1, structures: [{ id: "A", ds: "array", label: "Array" }] }));

    m(repo.countByUser).mockResolvedValue(LIMITS.visualization.maxPerUser);
    await expect(visualizationService.createFromRequest("me", { title: "t", script: good })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("create refuses a script with errors, before touching the database", async () => {
    await expect(visualizationService.createFromRequest("me", { title: "t", script: "{ bad" })).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("an update with a script recomputes structures and step count", async () => {
    m(repo.updateByUser).mockResolvedValue({ count: 1 });
    m(repo.findOneByUser).mockResolvedValue({ id: "v1" });
    await visualizationService.updateFromRequest("me", "v1", { script: good });
    expect(repo.updateByUser).toHaveBeenCalledWith("v1", "me", expect.objectContaining({ stepCount: 1 }));
  });
});
