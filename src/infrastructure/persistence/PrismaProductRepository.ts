import { Prisma, PrismaClient, Product as PrismaProduct } from '@prisma/client';
import { ProductRepository } from '../../domain/product/ProductRepository';
import { Product, CreateProductInput, UpdateProductInput } from '../../domain/product/Product';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../domain/shared/Pagination';
import { toBigIntId, toNumberId } from '../../domain/shared/Id';

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

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(
    params: PaginationParams,
    activeOnly = true,
  ): Promise<PaginatedResult<Product>> {
    const skip = (params.page - 1) * params.limit;
    const where = activeOnly ? { isActive: true } : {};
    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return createPaginatedResult(records.map(toDomain), total, params);
  }

  async findByCategory(
    categoryId: number,
    params: PaginationParams,
  ): Promise<PaginatedResult<Product>> {
    const skip = (params.page - 1) * params.limit;
    const where = { categoryId: toBigIntId(categoryId), isActive: true };
    const [records, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return createPaginatedResult(records.map(toDomain), total, params);
  }

  async findById(id: number): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({ where: { id: toBigIntId(id) } });
    return record ? toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({ where: { slug } });
    return record ? toDomain(record) : null;
  }

  async create(input: CreateProductInput, slug: string): Promise<Product> {
    const record = await this.prisma.product.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        price: new Prisma.Decimal(input.price),
        stock: input.stock,
        categoryId: toBigIntId(input.categoryId),
        isActive: input.isActive ?? true,
      },
    });
    return toDomain(record);
  }

  async update(id: number, input: UpdateProductInput, slug?: string): Promise<Product> {
    const record = await this.prisma.product.update({
      where: { id: toBigIntId(id) },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(slug !== undefined && { slug }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.price !== undefined && { price: new Prisma.Decimal(input.price) }),
        ...(input.stock !== undefined && { stock: input.stock }),
        ...(input.categoryId !== undefined && { categoryId: toBigIntId(input.categoryId) }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return toDomain(record);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.product.delete({ where: { id: toBigIntId(id) } });
  }

  async decrementStock(productId: number, quantity: number): Promise<Product> {
    const record = await this.prisma.product.update({
      where: { id: toBigIntId(productId) },
      data: { stock: { decrement: quantity } },
    });
    return toDomain(record);
  }

  async incrementStock(productId: number, quantity: number): Promise<Product> {
    const record = await this.prisma.product.update({
      where: { id: toBigIntId(productId) },
      data: { stock: { increment: quantity } },
    });
    return toDomain(record);
  }

  async getReservedQuantity(productId: number): Promise<number> {
    const result = await this.prisma.stockReservation.aggregate({
      where: {
        productId: toBigIntId(productId),
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  }
}
