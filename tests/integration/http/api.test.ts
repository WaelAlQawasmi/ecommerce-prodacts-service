import request from 'supertest';
import { createHttpApp } from '../../../src/interfaces/http/app';
import { JwtVerifier } from '../../../src/infrastructure/auth/JwtVerifier';
import { loadConfig } from '../../../src/config';
import { testPublicKey } from '../../setup';
import { createTestToken, createAdminToken } from '../../helpers/tokens';
import {
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemorySearchRepository,
  makeCategory,
  makeProduct,
  resetTestIdSequences,
} from '../../helpers/repositories';
import {
  ListProductsUseCase,
  ListProductsByCategoryUseCase,
  SearchProductsUseCase,
  GetProductUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
} from '../../../src/application/product/ProductUseCases';
import {
  ListCategoriesUseCase,
  GetCategoryUseCase,
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from '../../../src/application/category/CategoryUseCases';

function buildApp() {
  resetTestIdSequences();
  const config = loadConfig();
  const categoryRepo = new InMemoryCategoryRepository();
  const productRepo = new InMemoryProductRepository();
  const searchRepo = new InMemorySearchRepository();
  categoryRepo.seed(makeCategory({ id: 1 }));
  productRepo.seed(makeProduct({ id: 1, categoryId: 1 }));

  return createHttpApp({
    config,
    jwtVerifier: new JwtVerifier(testPublicKey),
    listProducts: new ListProductsUseCase(productRepo),
    listByCategory: new ListProductsByCategoryUseCase(productRepo, categoryRepo),
    searchProducts: new SearchProductsUseCase(searchRepo),
    getProduct: new GetProductUseCase(productRepo),
    createProduct: new CreateProductUseCase(productRepo, categoryRepo, searchRepo),
    updateProduct: new UpdateProductUseCase(productRepo, categoryRepo, searchRepo),
    deleteProduct: new DeleteProductUseCase(productRepo, searchRepo),
    listCategories: new ListCategoriesUseCase(categoryRepo),
    getCategory: new GetCategoryUseCase(categoryRepo),
    createCategory: new CreateCategoryUseCase(categoryRepo),
    updateCategory: new UpdateCategoryUseCase(categoryRepo),
    deleteCategory: new DeleteCategoryUseCase(categoryRepo),
  });
}

describe('HTTP API', () => {
  const app = buildApp();
  const userToken = createTestToken();
  const adminToken = createAdminToken();

  describe('Health', () => {
    it('GET /health should return ok without auth', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('CORS', () => {
    const cloudfrontOrigin = 'https://d2qagfb46siin2.cloudfront.net';
    const originalCorsOrigins = process.env.CORS_ORIGINS;

    afterAll(() => {
      if (originalCorsOrigins === undefined) {
        delete process.env.CORS_ORIGINS;
      } else {
        process.env.CORS_ORIGINS = originalCorsOrigins;
      }
    });

    it('should allow preflight from configured origin', async () => {
      process.env.CORS_ORIGINS = cloudfrontOrigin;
      const corsApp = buildApp();

      const res = await request(corsApp)
        .options('/api/v1/products')
        .set('Origin', cloudfrontOrigin)
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(cloudfrontOrigin);
    });
  });

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const res = await request(app).get('/api/v1/products');
      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  describe('Products (authenticated user)', () => {
    it('GET /api/v1/products should return paginated products', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    });

    it('GET /api/v1/products/category/:id should filter by category', async () => {
      const res = await request(app)
        .get('/api/v1/products/category/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data[0].categoryId).toBe(1);
    });

    it('GET /api/v1/products/:id should return single product', async () => {
      const res = await request(app)
        .get('/api/v1/products/1')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Headphones');
    });
  });

  describe('Products (admin)', () => {
    it('POST /api/v1/products should require admin role', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New', price: 10, stock: 5, categoryId: 1 });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/products should create product for admin', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Tablet', price: 499, stock: 20, categoryId: 1 });
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Tablet');
    });
  });

  describe('Categories (admin)', () => {
    it('POST /api/v1/categories should create category for admin', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Books', description: 'Books category' });
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('books');
    });

    it('GET /api/v1/categories should list categories for any user', async () => {
      const res = await request(app)
        .get('/api/v1/categories')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
