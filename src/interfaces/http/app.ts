import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { AppConfig } from '../../config';
import { JwtVerifier } from '../../infrastructure/auth/JwtVerifier';
import { createAuthMiddleware, requireAdmin, errorHandler } from './middleware';
import { createSwaggerSpec } from './swagger';
import {
  createPublicProductRoutes,
  createAdminProductRoutes,
} from './routes/productRoutes';
import {
  createPublicCategoryRoutes,
  createAdminCategoryRoutes,
} from './routes/categoryRoutes';
import {
  ListProductsUseCase,
  ListProductsByCategoryUseCase,
  SearchProductsUseCase,
  GetProductUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
} from '../../application/product/ProductUseCases';
import {
  ListCategoriesUseCase,
  GetCategoryUseCase,
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from '../../application/category/CategoryUseCases';

export interface HttpDependencies {
  config: AppConfig;
  jwtVerifier: JwtVerifier;
  listProducts: ListProductsUseCase;
  listByCategory: ListProductsByCategoryUseCase;
  searchProducts: SearchProductsUseCase;
  getProduct: GetProductUseCase;
  createProduct: CreateProductUseCase;
  updateProduct: UpdateProductUseCase;
  deleteProduct: DeleteProductUseCase;
  listCategories: ListCategoriesUseCase;
  getCategory: GetCategoryUseCase;
  createCategory: CreateCategoryUseCase;
  updateCategory: UpdateCategoryUseCase;
  deleteCategory: DeleteCategoryUseCase;
}

export function createHttpApp(deps: HttpDependencies): express.Application {
  const app = express();
  const auth = createAuthMiddleware(deps.jwtVerifier);

  if (deps.config.corsOrigins.length > 0) {
    app.use(
      cors({
        origin: deps.config.corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      }),
    );
  }

  // Disable upgrade-insecure-requests so Swagger UI assets load over plain HTTP
  // (e.g. EC2 on port 3001 without TLS). Helmet enables it by default and breaks /api/docs.
  const corsEnabled = deps.config.corsOrigins.length > 0;
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          upgradeInsecureRequests: null,
        },
      },
      // Allow cross-origin API reads when CORS is configured (Helmet defaults to same-origin).
      crossOriginResourcePolicy: corsEnabled ? { policy: 'cross-origin' } : undefined,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    rateLimit({
      windowMs: deps.config.rateLimitWindowMs,
      max: deps.config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'products-service' });
  });

  if (deps.config.swaggerEnabled) {
    const swaggerSpec = createSwaggerSpec(deps.config.port);
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/api/docs.json', (_req, res) => {
      res.json(swaggerSpec);
    });
  }

  app.use(
    '/api/v1/products',
    auth,
    createPublicProductRoutes({
      listProducts: deps.listProducts,
      listByCategory: deps.listByCategory,
      searchProducts: deps.searchProducts,
      getProduct: deps.getProduct,
    }),
  );

  app.use(
    '/api/v1/products',
    auth,
    requireAdmin,
    createAdminProductRoutes({
      createProduct: deps.createProduct,
      updateProduct: deps.updateProduct,
      deleteProduct: deps.deleteProduct,
    }),
  );

  app.use(
    '/api/v1/categories',
    auth,
    createPublicCategoryRoutes({
      listCategories: deps.listCategories,
      getCategory: deps.getCategory,
    }),
  );

  app.use(
    '/api/v1/categories',
    auth,
    requireAdmin,
    createAdminCategoryRoutes({
      createCategory: deps.createCategory,
      updateCategory: deps.updateCategory,
      deleteCategory: deps.deleteCategory,
    }),
  );

  app.use(errorHandler);
  return app;
}
