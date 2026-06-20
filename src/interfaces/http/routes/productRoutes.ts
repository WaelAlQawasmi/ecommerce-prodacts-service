import { Router, Request, Response, NextFunction } from 'express';
import {
  ListProductsUseCase,
  ListProductsByCategoryUseCase,
  SearchProductsUseCase,
  GetProductUseCase,
} from '../../../application/product/ProductUseCases';
import { parsePagination, parseIdParam } from '../middleware';

export function createPublicProductRoutes(deps: {
  listProducts: ListProductsUseCase;
  listByCategory: ListProductsByCategoryUseCase;
  searchProducts: SearchProductsUseCase;
  getProduct: GetProductUseCase;
}): Router {
  const router = Router();

  /**
   * @openapi
   * /api/v1/products:
   *   get:
   *     tags: [Products]
   *     summary: List all active products (paginated)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20, maximum: 100 }
   *     responses:
   *       200:
   *         description: Paginated product list
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await deps.listProducts.execute(parsePagination(req.query));
      res.json({
        data: result.data.map((p) => p.toJSON()),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/products/search:
   *   get:
   *     tags: [Products]
   *     summary: Search products by name (Elasticsearch)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 20 }
   *     responses:
   *       200:
   *         description: Search results
   */
  router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await deps.searchProducts.execute(
        String(req.query.q ?? ''),
        parsePagination(req.query),
      );
      res.json({
        data: result.data.map((p) => p.toJSON()),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/products/category/{categoryId}:
   *   get:
   *     tags: [Products]
   *     summary: List products by category
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: categoryId
   *         required: true
   *         schema: { type: integer, format: int64 }
   *     responses:
   *       200:
   *         description: Products in category
   */
  router.get('/category/:categoryId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await deps.listByCategory.execute(
        parseIdParam(req.params.categoryId),
        parsePagination(req.query),
      );
      res.json({
        data: result.data.map((p) => p.toJSON()),
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/products/{id}:
   *   get:
   *     tags: [Products]
   *     summary: Get product by ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, format: int64 }
   *     responses:
   *       200:
   *         description: Product details
   *       404:
   *         description: Product not found
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await deps.getProduct.execute(parseIdParam(req.params.id));
      res.json({ data: product.toJSON() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

import {
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
} from '../../../application/product/ProductUseCases';

export function createAdminProductRoutes(deps: {
  createProduct: CreateProductUseCase;
  updateProduct: UpdateProductUseCase;
  deleteProduct: DeleteProductUseCase;
}): Router {
  const router = Router();

  /**
   * @openapi
   * /api/v1/products:
   *   post:
   *     tags: [Products - Admin]
   *     summary: Create product (admin only)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, price, stock, categoryId]
   *             properties:
   *               name: { type: string }
   *               description: { type: string }
   *               price: { type: number }
   *               stock: { type: integer }
   *               categoryId: { type: integer, format: int64 }
   *               isActive: { type: boolean }
   *     responses:
   *       201:
   *         description: Product created
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await deps.createProduct.execute(req.body);
      res.status(201).json({ data: product.toJSON() });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/products/{id}:
   *   put:
   *     tags: [Products - Admin]
   *     summary: Update product (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, format: int64 }
   *     responses:
   *       200:
   *         description: Product updated
   */
  router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await deps.updateProduct.execute(parseIdParam(req.params.id), req.body);
      res.json({ data: product.toJSON() });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @openapi
   * /api/v1/products/{id}:
   *   delete:
   *     tags: [Products - Admin]
   *     summary: Delete product (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: integer, format: int64 }
   *     responses:
   *       204:
   *         description: Product deleted
   */
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deps.deleteProduct.execute(parseIdParam(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
