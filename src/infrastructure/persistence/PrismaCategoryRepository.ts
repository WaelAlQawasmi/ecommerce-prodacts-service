import { PrismaClient, Category as PrismaCategory } from '@prisma/client';
import { CategoryRepository } from '../../domain/category/CategoryRepository';
import { Category, CreateCategoryInput, UpdateCategoryInput } from '../../domain/category/Category';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../domain/shared/Pagination';
import { toBigIntId, toNumberId } from '../../domain/shared/Id';

function toDomain(record: PrismaCategory): Category {
  return Category.create({
    id: toNumberId(record.id),
    name: record.name,
    slug: record.slug,
    description: record.description,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(params: PaginationParams): Promise<PaginatedResult<Category>> {
    const skip = (params.page - 1) * params.limit;
    const [records, total] = await Promise.all([
      this.prisma.category.findMany({
        skip,
        take: params.limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.count(),
    ]);
    return createPaginatedResult(records.map(toDomain), total, params);
  }

  async findById(id: number): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { id: toBigIntId(id) } });
    return record ? toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { slug } });
    return record ? toDomain(record) : null;
  }

  async create(input: CreateCategoryInput, slug: string): Promise<Category> {
    const record = await this.prisma.category.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
      },
    });
    return toDomain(record);
  }

  async update(id: number, input: UpdateCategoryInput, slug?: string): Promise<Category> {
    const record = await this.prisma.category.update({
      where: { id: toBigIntId(id) },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(slug !== undefined && { slug }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
    return toDomain(record);
  }

  async delete(id: number): Promise<void> {
    await this.prisma.category.delete({ where: { id: toBigIntId(id) } });
  }

  async countProducts(categoryId: number): Promise<number> {
    return this.prisma.product.count({ where: { categoryId: toBigIntId(categoryId) } });
  }
}
