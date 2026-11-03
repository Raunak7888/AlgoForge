import { Request, Response } from "express";
import { categoryService } from "../services/category.service";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import {
  parseCreateCategory,
  parseUpdateCategory,
} from "../validation/category";

class CategoryController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const categories = await categoryService.listCategories();
    res.json(categories);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    const category = await categoryService.getCategoryById(id);
    res.json(category);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateCategory(req.body);
    const category = await categoryService.createCategory(input);
    res.status(201).json(category);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    const input = parseUpdateCategory(req.body);
    const category = await categoryService.updateCategory(id, input);
    res.json(category);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    await categoryService.deleteCategory(id);
    res.status(204).send();
  });
}

export const categoryController = new CategoryController();