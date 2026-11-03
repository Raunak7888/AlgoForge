//# filename: apps/api/src/services/category.service.ts

import {
  CategoryResponseSchema,
  type CreateCategory,
  type UpdateCategory,
  type CategoryResponse,
} from "@algoforge/forge";
import { categoryRepository } from "../repositories/category.repository";
import { AppError } from "../utils/app-error";

function serialize(category: {
  id: string;
  label: string;
  description: string | null;
  iconName: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): CategoryResponse {
  return CategoryResponseSchema.parse({
    id: category.id,
    label: category.label,
    description: category.description,
    iconName: category.iconName,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  });
}

class CategoryService {
  async listCategories(): Promise<CategoryResponse[]> {
    const rows = await categoryRepository.findAll();
    return rows.map(serialize);
  }

  async getCategoryById(id: string): Promise<CategoryResponse> {
    const row = await categoryRepository.findByIdentifier(id);
    if (!row) throw AppError.notFound("Category not found.");
    return serialize(row);
  }

  async createCategory(input: CreateCategory): Promise<CategoryResponse> {

    
    const normalizedId = normalizeCategoryId(input.id ?? input.label);

    const existing = await categoryRepository.findByIdentifier(normalizedId);
    if (existing) throw AppError.badRequest("Category already exists.");

    const row = await categoryRepository.create({
      id: normalizedId,
      label: input.label,
      description: input.description,
      iconName: input.iconName,
      sortOrder: input.sortOrder,
    });
    return serialize(row);
  }

  async updateCategory(id: string, input: UpdateCategory): Promise<CategoryResponse> {
    const existing = await categoryRepository.findByIdentifier(id);
    if (!existing) throw AppError.notFound("Category not found.");

    const row = await categoryRepository.update(existing.id, {
      label: input.label,
      description: input.description,
      iconName: input.iconName,
      sortOrder: input.sortOrder,
    });
    return serialize(row);
  }

  async deleteCategory(id: string): Promise<void> {
    const existing = await categoryRepository.findByIdentifier(id);
    if (!existing) throw AppError.notFound("Category not found.");

    const count = await categoryRepository.countAlgorithmsInCategory(existing.id);
    if (count > 0) {
      throw AppError.badRequest(
        "Cannot delete category with associated algorithms.",
      );
    }
    await categoryRepository.delete(existing.id);
  }
}

export const categoryService = new CategoryService();

function normalizeCategoryId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}


/*


*/