import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import fs from 'fs';

const bearerSecurity = [{ bearerAuth: [] }];

function buildDefinition(port: number) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'E-Commerce Products Service API',
      version: '1.0.0',
      description:
        'Products microservice with REST APIs, gRPC stock reservation, Kafka events, and Elasticsearch search. All endpoints require a valid JWT from the Auth Service (except /health).',
    },
    servers: [{ url: `http://localhost:${port}`, description: 'Local development' }],
    tags: [
      { name: 'Health', description: 'Service health checks' },
      { name: 'Products', description: 'Product endpoints (authenticated users)' },
      { name: 'Products - Admin', description: 'Admin-only product management' },
      { name: 'Categories', description: 'Category endpoints (authenticated users)' },
      { name: 'Categories - Admin', description: 'Admin-only category management' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'RS256 JWT from Auth Service. Example: Bearer eyJhbGci...',
        },
      },
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer', format: 'int64', example: 1 },
            name: { type: 'string', example: 'Wireless Headphones' },
            slug: { type: 'string', example: 'wireless-headphones' },
            description: { type: 'string', nullable: true, example: 'Premium noise-cancelling headphones' },
            price: { type: 'number', format: 'float', example: 199.99 },
            stock: { type: 'integer', example: 50 },
            categoryId: { type: 'integer', format: 'int64', example: 1 },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', format: 'int64', example: 1 },
            name: { type: 'string', example: 'Electronics' },
            slug: { type: 'string', example: 'electronics' },
            description: { type: 'string', nullable: true, example: 'Electronic devices' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
        ProductListResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },
        CategoryListResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        },
        ProductResponse: {
          type: 'object',
          properties: {
            data: { $ref: '#/components/schemas/Product' },
          },
        },
        CategoryResponse: {
          type: 'object',
          properties: {
            data: { $ref: '#/components/schemas/Category' },
          },
        },
        CreateProductRequest: {
          type: 'object',
          required: ['name', 'price', 'stock', 'categoryId'],
          properties: {
            name: { type: 'string', example: 'Smart Watch' },
            description: { type: 'string', example: 'Fitness tracking smart watch' },
            price: { type: 'number', format: 'float', example: 299.99 },
            stock: { type: 'integer', minimum: 0, example: 30 },
            categoryId: { type: 'integer', format: 'int64', example: 1 },
            isActive: { type: 'boolean', default: true, example: true },
          },
        },
        UpdateProductRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Smart Watch Pro' },
            description: { type: 'string', example: 'Updated description' },
            price: { type: 'number', format: 'float', example: 349.99 },
            stock: { type: 'integer', minimum: 0, example: 25 },
            categoryId: { type: 'integer', format: 'int64', example: 1 },
            isActive: { type: 'boolean', example: true },
          },
        },
        CreateCategoryRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Books' },
            description: { type: 'string', example: 'Books and literature' },
          },
        },
        UpdateCategoryRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Books & Media' },
            description: { type: 'string', example: 'Books, ebooks, and audiobooks' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Product name is required' },
              },
            },
          },
        },
      },
      parameters: {
        PageParam: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number',
        },
        LimitParam: {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Items per page',
        },
        ProductIdParam: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer', format: 'int64' },
          description: 'Product ID',
        },
        CategoryIdParam: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'integer', format: 'int64' },
          description: 'Category ID',
        },
        CategoryIdPathParam: {
          in: 'path',
          name: 'categoryId',
          required: true,
          schema: { type: 'integer', format: 'int64' },
          description: 'Category ID to filter products',
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid JWT',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        Forbidden: {
          description: 'Admin role required',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Resource not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        ValidationError: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          security: [],
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      service: { type: 'string', example: 'products-service' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/v1/products': {
        get: {
          tags: ['Products'],
          summary: 'List all active products',
          description: 'Returns paginated list of active products.',
          security: bearerSecurity,
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            '200': {
              description: 'Paginated product list',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ProductListResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Products - Admin'],
          summary: 'Create product',
          description: 'Admin only. Creates a product and indexes it in Elasticsearch.',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateProductRequest' },
                example: {
                  name: 'Smart Watch',
                  description: 'Fitness tracking smart watch',
                  price: 299.99,
                  stock: 30,
                  categoryId: 1,
                  isActive: true,
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Product created',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ProductResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Product or category conflict' },
            '422': { $ref: '#/components/responses/ValidationError' },
          },
        },
      },
      '/api/v1/products/search': {
        get: {
          tags: ['Products'],
          summary: 'Search products by name',
          description: 'Full-text search via Elasticsearch (name and description).',
          security: bearerSecurity,
          parameters: [
            {
              in: 'query',
              name: 'q',
              required: true,
              schema: { type: 'string' },
              description: 'Search query',
              example: 'headphones',
            },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            '200': {
              description: 'Search results',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ProductListResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '422': { $ref: '#/components/responses/ValidationError' },
          },
        },
      },
      '/api/v1/products/category/{categoryId}': {
        get: {
          tags: ['Products'],
          summary: 'List products by category',
          security: bearerSecurity,
          parameters: [
            { $ref: '#/components/parameters/CategoryIdPathParam' },
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            '200': {
              description: 'Products in category',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ProductListResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/products/{id}': {
        get: {
          tags: ['Products'],
          summary: 'Get product by ID',
          security: bearerSecurity,
          parameters: [{ $ref: '#/components/parameters/ProductIdParam' }],
          responses: {
            '200': {
              description: 'Product details',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ProductResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        put: {
          tags: ['Products - Admin'],
          summary: 'Update product',
          description: 'Admin only. Partial update — send only fields to change.',
          security: bearerSecurity,
          parameters: [{ $ref: '#/components/parameters/ProductIdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateProductRequest' },
                example: {
                  name: 'Smart Watch Pro',
                  price: 349.99,
                  stock: 25,
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Product updated',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ProductResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '422': { $ref: '#/components/responses/ValidationError' },
          },
        },
        delete: {
          tags: ['Products - Admin'],
          summary: 'Delete product',
          description: 'Admin only. Removes product from database and Elasticsearch.',
          security: bearerSecurity,
          parameters: [{ $ref: '#/components/parameters/ProductIdParam' }],
          responses: {
            '204': { description: 'Product deleted' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/api/v1/categories': {
        get: {
          tags: ['Categories'],
          summary: 'List categories',
          security: bearerSecurity,
          parameters: [
            { $ref: '#/components/parameters/PageParam' },
            { $ref: '#/components/parameters/LimitParam' },
          ],
          responses: {
            '200': {
              description: 'Paginated category list',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CategoryListResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
          },
        },
        post: {
          tags: ['Categories - Admin'],
          summary: 'Create category',
          description: 'Admin only.',
          security: bearerSecurity,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateCategoryRequest' },
                example: { name: 'Books', description: 'Books and literature' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Category created',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CategoryResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '409': { description: 'Category already exists' },
            '422': { $ref: '#/components/responses/ValidationError' },
          },
        },
      },
      '/api/v1/categories/{id}': {
        get: {
          tags: ['Categories'],
          summary: 'Get category by ID',
          security: bearerSecurity,
          parameters: [{ $ref: '#/components/parameters/CategoryIdParam' }],
          responses: {
            '200': {
              description: 'Category details',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CategoryResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
        put: {
          tags: ['Categories - Admin'],
          summary: 'Update category',
          description: 'Admin only. Partial update — send only fields to change.',
          security: bearerSecurity,
          parameters: [{ $ref: '#/components/parameters/CategoryIdParam' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateCategoryRequest' },
                example: { name: 'Books & Media', description: 'Books, ebooks, and audiobooks' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Category updated',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CategoryResponse' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '422': { $ref: '#/components/responses/ValidationError' },
          },
        },
        delete: {
          tags: ['Categories - Admin'],
          summary: 'Delete category',
          description: 'Admin only. Fails if category has products.',
          security: bearerSecurity,
          parameters: [{ $ref: '#/components/parameters/CategoryIdParam' }],
          responses: {
            '204': { description: 'Category deleted' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
            '404': { $ref: '#/components/responses/NotFound' },
            '409': { description: 'Category has associated products' },
          },
        },
      },
    },
    security: bearerSecurity,
  };
}

export function createSwaggerSpec(port: number) {
  const bundledPath = path.join(__dirname, 'openapi.json');
  if (fs.existsSync(bundledPath)) {
    const spec = JSON.parse(fs.readFileSync(bundledPath, 'utf8')) as ReturnType<typeof buildDefinition>;
    if (spec.servers?.[0]) {
      spec.servers[0].url = `http://localhost:${port}`;
    }
    return spec;
  }

  return swaggerJsdoc({
    definition: buildDefinition(port),
    apis: [],
  });
}

export function generateOpenApiSpec(port: number, outputPath: string): void {
  const spec = swaggerJsdoc({
    definition: buildDefinition(port),
    apis: [],
  });
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
}
