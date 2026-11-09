import {
  CreateShareRequestSchema,
  ShareIdSchema,
  ShareListQuerySchema,
  parseShareTarget,
  type CreateShareRequest,
  type ShareType,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod } from "./common";

export function parseCreateShare(value: unknown): CreateShareRequest {
  const r = CreateShareRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid share request.");
  return r.data;
}

export function parseShareId(value: unknown): string {
  const r = ShareIdSchema.safeParse(value);
  if (!r.success) throw AppError.badRequest("Invalid share id.");
  return r.data;
}

export function parseShareTargetQuery(value: unknown): { type: ShareType; targetId: string } {
  const r = ShareListQuerySchema.safeParse({ target: typeof value === "string" ? value : undefined });
  if (!r.success) throw badRequestFromZod(r.error, "target must look like <type>:<id>.");
  const target = parseShareTarget(r.data.target);
  if (!target) throw AppError.badRequest("Invalid share target.");
  return target;
}
