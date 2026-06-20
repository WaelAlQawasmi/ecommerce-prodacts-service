import { CategoryRepository } from '../../domain/category/CategoryRepository';
import { CreateCategoryInput, UpdateCategoryInput } from '../../domain/category/Category';
import { PaginationParams, PaginatedResult, slugify } from '../../domain/shared/Pagination';
import { Category } from '../../domain/category/Category';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/shared/DomainError';

export class ListCategoriesUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  execute(params: PaginationParams): Promise<PaginatedResult<Category>> {
    return this.categoryRepository.findAll(params);
  }
}

export class GetCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Category', id);
    }
    return category;
  }
}

export class CreateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<Category> {
    if (!input.name?.trim()) {
      throw new ValidationError('Category name is required');
    }
    const slug = slugify(input.name);
    const existing = await this.categoryRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictError(`Category with name '${input.name}' already exists`);
    }
    return this.categoryRepository.create(input, slug);
  }
}

export class UpdateCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number, input: UpdateCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Category', id);
    }

    let slug: string | undefined;
    if (input.name) {
      slug = slugify(input.name);
      const existing = await this.categoryRepository.findBySlug(slug);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Category with name '${input.name}' already exists`);
      }
    }

    return this.categoryRepository.update(id, input, slug);
  }
}

export class DeleteCategoryUseCase {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(id: number): Promise<void> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError('Category', id);
    }
    const productCount = await this.categoryRepository.countProducts(id);
    if (productCount > 0) {
      throw new ConflictError('Cannot delete category with associated products');
    }
    await this.categoryRepository.delete(id);
  }
}
