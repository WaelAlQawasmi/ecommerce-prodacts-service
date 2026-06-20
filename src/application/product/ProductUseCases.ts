import { ProductRepository } from '../../domain/product/ProductRepository';
import { ProductSearchRepository } from '../../domain/product/ProductSearchRepository';
import { CategoryRepository } from '../../domain/category/CategoryRepository';
import { CreateProductInput, UpdateProductInput, Product } from '../../domain/product/Product';
import { PaginationParams, PaginatedResult, slugify } from '../../domain/shared/Pagination';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/shared/DomainError';

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  execute(params: PaginationParams): Promise<PaginatedResult<Product>> {
    return this.productRepository.findAll(params, true);
  }
}

export class ListProductsByCategoryUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(categoryId: number, params: PaginationParams): Promise<PaginatedResult<Product>> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundError('Category', categoryId);
    }
    return this.productRepository.findByCategory(categoryId, params);
  }
}

export class SearchProductsUseCase {
  constructor(private readonly searchRepository: ProductSearchRepository) {}

  async execute(query: string, params: PaginationParams): Promise<PaginatedResult<Product>> {
    if (!query?.trim()) {
      throw new ValidationError('Search query is required');
    }
    return this.searchRepository.searchByName(query.trim(), params);
  }
}

export class GetProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(id: number): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }
    return product;
  }
}

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly searchRepository: ProductSearchRepository,
  ) {}

  async execute(input: CreateProductInput): Promise<Product> {
    this.validateInput(input);
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new NotFoundError('Category', input.categoryId);
    }

    const slug = slugify(input.name);
    const existing = await this.productRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictError(`Product with name '${input.name}' already exists`);
    }

    const product = await this.productRepository.create(input, slug);
    await this.searchRepository.indexProduct({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      categoryId: product.categoryId,
      isActive: product.isActive,
    });
    return product;
  }

  private validateInput(input: CreateProductInput): void {
    if (!input.name?.trim()) {
      throw new ValidationError('Product name is required');
    }
    if (input.price <= 0) {
      throw new ValidationError('Price must be greater than 0');
    }
    if (input.stock < 0) {
      throw new ValidationError('Stock cannot be negative');
    }
  }
}

export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly searchRepository: ProductSearchRepository,
  ) {}

  async execute(id: number, input: UpdateProductInput): Promise<Product> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }

    if (input.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        throw new NotFoundError('Category', input.categoryId);
      }
    }

    if (input.price !== undefined && input.price <= 0) {
      throw new ValidationError('Price must be greater than 0');
    }
    if (input.stock !== undefined && input.stock < 0) {
      throw new ValidationError('Stock cannot be negative');
    }

    let slug: string | undefined;
    if (input.name) {
      slug = slugify(input.name);
      const existing = await this.productRepository.findBySlug(slug);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Product with name '${input.name}' already exists`);
      }
    }

    const updated = await this.productRepository.update(id, input, slug);
    await this.searchRepository.indexProduct({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      price: updated.price,
      categoryId: updated.categoryId,
      isActive: updated.isActive,
    });
    return updated;
  }
}

export class DeleteProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly searchRepository: ProductSearchRepository,
  ) {}

  async execute(id: number): Promise<void> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError('Product', id);
    }
    await this.productRepository.delete(id);
    await this.searchRepository.removeProduct(id);
  }
}
