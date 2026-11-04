import { Request, Response } from "express";
import type { CategoryListResponse } from "@algoforge/contracts";
import { categoryService } from "../services/category.service";
import { AUDIT_ACTIONS, auditService } from "../services/audit.service";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseCreateCategory, parseUpdateCategory } from "../validation/category";

class CategoryController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const categories = await categoryService.listCategories();
    const body: CategoryListResponse = { data: categories };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    const category = await categoryService.getCategoryById(id);
    res.json(category);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateCategory(req.body);
    const category = await categoryService.createCategory(input);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.CATEGORY_CREATE, { type: "category", id: category.id }, { label: input.label });
    res.status(201).json(category);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    const input = parseUpdateCategory(req.body);
    const category = await categoryService.updateCategory(id, input);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.CATEGORY_UPDATE, { type: "category", id }, { fields: Object.keys(input) });
    res.json(category);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    await categoryService.deleteCategory(id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.CATEGORY_DELETE, { type: "category", id });
    res.status(204).send();
  });
}

export const categoryController = new CategoryController();
