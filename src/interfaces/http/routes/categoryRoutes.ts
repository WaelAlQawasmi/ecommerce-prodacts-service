import { Router, Request, Response, NextFunction } from 'express';
import {
  ListCategoriesUseCase,
  GetCategoryUseCase,
} from '../../../application/category/CategoryUseCases';
import {
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from '../../../application/category/CategoryUseCases';
import { parsePagination, parseIdParam } from '../middleware';

export function createPublicCategoryRoutes(deps: {
  listCategories: ListCategoriesUseCase;
  getCategory: GetCategoryUseCase;
}): Router {
  const router = Router();

  /**
   * @openapi
   * /api/v1/categories:
   *   get:
   *     tags: [Categories]
   *     summary: List categories (paginated)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200:
   *         description: Paginated category list
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await deps.listCategories.execute(parsePagination(req.query));
      res.json({
        data: result.data.map((c) => c.toJSON()),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/categories/{id}:
   *   get:
   *     tags: [Categories]
   *     summary: Get category by ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, format: int64 }
   *     responses:
   *       200:
   *         description: Category details
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await deps.getCategory.execute(parseIdParam(req.params.id));
      res.json({ data: category.toJSON() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAdminCategoryRoutes(deps: {
  createCategory: CreateCategoryUseCase;
  updateCategory: UpdateCategoryUseCase;
  deleteCategory: DeleteCategoryUseCase;
}): Router {
  const router = Router();

  /**
   * @openapi
   * /api/v1/categories:
   *   post:
   *     tags: [Categories - Admin]
   *     summary: Create category (admin only)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name: { type: string }
   *               description: { type: string }
   *     responses:
   *       201:
   *         description: Category created
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await deps.createCategory.execute(req.body);
      res.status(201).json({ data: category.toJSON() });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/categories/{id}:
   *   put:
   *     tags: [Categories - Admin]
   *     summary: Update category (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, format: int64 }
   *     responses:
   *       200:
   *         description: Category updated
   */
  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await deps.updateCategory.execute(parseIdParam(req.params.id), req.body);
      res.json({ data: category.toJSON() });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/categories/{id}:
   *   delete:
   *     tags: [Categories - Admin]
   *     summary: Delete category (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, format: int64 }
   *     responses:
   *       204:
   *         description: Category deleted
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deps.deleteCategory.execute(parseIdParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
