import { PrismaClient, Product as PrismaProduct } from '@prisma/client';
import { ProductSearchRepository } from '../../domain/product/ProductSearchRepository';
import { ProductSearchDocument } from '../../domain/product/Product';
import { Product } from '../../domain/product/Product';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../domain/shared/Pagination';
import { toNumberId } from '../../domain/shared/Id';

function toDomain(record: PrismaProduct): Product {
  return Product.create({
    id: toNumberId(record.id),
    name: record.name,
    slug: record.slug,
    description: record.description,
    price: Number(record.price),
    stock: record.stock,
    categoryId: toNumberId(record.categoryId),
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

/** PostgreSQL ILIKE search — used when Elasticsearch is disabled (small servers). */
export class PrismaProductSearchRepository implements ProductSearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureIndex(): Promise<void> {
    // No index setup required — search queries PostgreSQL directly.
  }

  async indexProduct(_document: ProductSearchDocument): Promise<void> {
    // Search reads live from PostgreSQL.
  }

  async removeProduct(_productId: number): Promise<void> {
    // Search reads live from PostgreSQL.
  }

  async searchByName(
    query: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<Product>> {
    const skip = (params.page - 1) * params.limit;
    const where = {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' as const } },
        { description: { contains: query, mode: 'insensitive' as const } },
      ],
    };

    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return createPaginatedResult(records.map(toDomain), total, params);
  }
}
