import {
  CreateCategoryRequestSchema,
  UpdateCategoryRequestSchema,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from "@algoforge/contracts";
import { badRequestFromZod } from "./common";

export function parseCreateCategory(value: unknown): CreateCategoryRequest {
  const result = CreateCategoryRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid category data.");
  return result.data;
}

export function parseUpdateCategory(value: unknown): UpdateCategoryRequest {
  const result = UpdateCategoryRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid category data.");
  return result.data;
}
