import { z } from "zod";
import { IsoDateTimeSchema, listResponse } from "./common";

export const CategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  iconName: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CategoryDto = z.infer<typeof CategorySchema>;

export const CategoryListResponseSchema = listResponse(CategorySchema);
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;

export const CreateCategoryRequestSchema = z.object({
  id: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  iconName: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
});
export const UpdateCategoryRequestSchema = CreateCategoryRequestSchema.partial().omit({ id: true });
export type CreateCategoryRequest = z.infer<typeof CreateCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof UpdateCategoryRequestSchema>;
