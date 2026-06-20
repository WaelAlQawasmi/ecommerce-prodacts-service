import { Category } from '../../src/domain/category/Category';
import { Product } from '../../src/domain/product/Product';
import { CategoryRepository } from '../../src/domain/category/CategoryRepository';
import { ProductRepository } from '../../src/domain/product/ProductRepository';
import { ProductSearchRepository } from '../../src/domain/product/ProductSearchRepository';
import { StockRepository } from '../../src/domain/stock/StockRepository';
import { PaginationParams, PaginatedResult, createPaginatedResult } from '../../src/domain/shared/Pagination';
import { CreateCategoryInput, UpdateCategoryInput } from '../../src/domain/category/Category';
import { CreateProductInput, UpdateProductInput } from '../../src/domain/product/Product';
import { StockReservation, ReserveStockInput, StockAvailability } from '../../src/domain/stock/StockReservation';

let categorySeq = 1;
let productSeq = 1;

export function makeCategory(overrides: Partial<{
  id: number;
  name: string;
  slug: string;
  description: string | null;
}> = {}): Category {
  return Category.create({
    id: overrides.id ?? categorySeq++,
    name: overrides.name ?? 'Electronics',
    slug: overrides.slug ?? 'electronics',
    description: overrides.description ?? 'Electronics category',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  });
}

export function makeProduct(overrides: Partial<{
  id: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
  categoryId: number;
  isActive: boolean;
}> = {}): Product {
  return Product.create({
    id: overrides.id ?? productSeq++,
    name: overrides.name ?? 'Headphones',
    slug: overrides.slug ?? 'headphones',
    description: 'Wireless headphones',
    price: overrides.price ?? 199.99,
    stock: overrides.stock ?? 50,
    categoryId: overrides.categoryId ?? 1,
    isActive: overrides.isActive ?? true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  });
}

export class InMemoryCategoryRepository implements CategoryRepository {
  private categories = new Map<number, Category>();

  seed(...items: Category[]): void {
    for (const item of items) {
      this.categories.set(item.id, item);
    }
  }

  findAll(params: PaginationParams): Promise<PaginatedResult<Category>> {
    const all = Array.from(this.categories.values());
    const skip = (params.page - 1) * params.limit;
    return Promise.resolve(createPaginatedResult(all.slice(skip, skip + params.limit), all.length, params));
  }

  findById(id: number): Promise<Category | null> {
    return Promise.resolve(this.categories.get(id) ?? null);
  }

  findBySlug(slug: string): Promise<Category | null> {
    return Promise.resolve(
      Array.from(this.categories.values()).find((c) => c.slug === slug) ?? null,
    );
  }

  async create(input: CreateCategoryInput, slug: string): Promise<Category> {
    const category = makeCategory({ name: input.name, slug, description: input.description ?? null });
    this.categories.set(category.id, category);
    return category;
  }

  async update(id: number, input: UpdateCategoryInput, slug?: string): Promise<Category> {
    const existing = this.categories.get(id)!;
    const updated = Category.create({
      id: existing.id,
      name: input.name ?? existing.name,
      slug: slug ?? existing.slug,
      description: input.description ?? existing.description,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.categories.set(id, updated);
    return updated;
  }

  delete(id: number): Promise<void> {
    this.categories.delete(id);
    return Promise.resolve();
  }

  countProducts(_categoryId: number): Promise<number> {
    return Promise.resolve(0);
  }
}

export class InMemoryProductRepository implements ProductRepository {
  private products = new Map<number, Product>();

  seed(...items: Product[]): void {
    for (const item of items) {
      this.products.set(item.id, item);
    }
  }

  findAll(params: PaginationParams, activeOnly = true): Promise<PaginatedResult<Product>> {
    let all = Array.from(this.products.values());
    if (activeOnly) {
      all = all.filter((p) => p.isActive);
    }
    const skip = (params.page - 1) * params.limit;
    return Promise.resolve(createPaginatedResult(all.slice(skip, skip + params.limit), all.length, params));
  }

  findByCategory(categoryId: number, params: PaginationParams): Promise<PaginatedResult<Product>> {
    const all = Array.from(this.products.values()).filter(
      (p) => p.categoryId === categoryId && p.isActive,
    );
    const skip = (params.page - 1) * params.limit;
    return Promise.resolve(createPaginatedResult(all.slice(skip, skip + params.limit), all.length, params));
  }

  findById(id: number): Promise<Product | null> {
    return Promise.resolve(this.products.get(id) ?? null);
  }

  findBySlug(slug: string): Promise<Product | null> {
    return Promise.resolve(
      Array.from(this.products.values()).find((p) => p.slug === slug) ?? null,
    );
  }

  async create(input: CreateProductInput, slug: string): Promise<Product> {
    const product = makeProduct({
      name: input.name,
      slug,
      price: input.price,
      stock: input.stock,
      categoryId: input.categoryId,
      isActive: input.isActive ?? true,
    });
    this.products.set(product.id, product);
    return product;
  }

  async update(id: number, input: UpdateProductInput, slug?: string): Promise<Product> {
    const existing = this.products.get(id)!;
    const updated = Product.create({
      id: existing.id,
      name: input.name ?? existing.name,
      slug: slug ?? existing.slug,
      description: input.description ?? existing.description,
      price: input.price ?? existing.price,
      stock: input.stock ?? existing.stock,
      categoryId: input.categoryId ?? existing.categoryId,
      isActive: input.isActive ?? existing.isActive,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });
    this.products.set(id, updated);
    return updated;
  }

  delete(id: number): Promise<void> {
    this.products.delete(id);
    return Promise.resolve();
  }

  async decrementStock(productId: number, quantity: number): Promise<Product> {
    const product = this.products.get(productId)!;
    return this.update(productId, { stock: product.stock - quantity });
  }

  async incrementStock(productId: number, quantity: number): Promise<Product> {
    const product = this.products.get(productId)!;
    return this.update(productId, { stock: product.stock + quantity });
  }

  getReservedQuantity(): Promise<number> {
    return Promise.resolve(0);
  }
}

export class InMemorySearchRepository implements ProductSearchRepository {
  private indexed = new Map<number, ReturnType<Product['toJSON']>>();

  indexProduct(document: Parameters<ProductSearchRepository['indexProduct']>[0]): Promise<void> {
    this.indexed.set(document.id, document as ReturnType<Product['toJSON']>);
    return Promise.resolve();
  }

  removeProduct(productId: number): Promise<void> {
    this.indexed.delete(productId);
    return Promise.resolve();
  }

  searchByName(query: string, params: PaginationParams): Promise<PaginatedResult<Product>> {
    const all = Array.from(this.indexed.values())
      .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      .map((d) => makeProduct({ id: d.id, name: d.name, slug: d.slug, categoryId: d.categoryId }));
    const skip = (params.page - 1) * params.limit;
    return Promise.resolve(createPaginatedResult(all.slice(skip, skip + params.limit), all.length, params));
  }

  ensureIndex(): Promise<void> {
    return Promise.resolve();
  }
}

export class InMemoryStockRepository implements StockRepository {
  private reservations = new Map<number, StockReservation>();
  private reservationSeq = 1;
  private products: InMemoryProductRepository;

  constructor(products: InMemoryProductRepository) {
    this.products = products;
  }

  async reserve(input: ReserveStockInput, ttlSeconds: number): Promise<StockReservation> {
    const product = await this.products.findById(input.productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const reservation = StockReservation.create({
      id: this.reservationSeq++,
      productId: input.productId,
      orderId: input.orderId,
      quantity: input.quantity,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  async release(orderId: string): Promise<StockReservation[]> {
    const released: StockReservation[] = [];
    for (const [id, reservation] of this.reservations) {
      if (reservation.orderId === orderId && reservation.status === 'ACTIVE') {
        const updated = StockReservation.create({
          id: reservation.id,
          productId: reservation.productId,
          orderId: reservation.orderId,
          quantity: reservation.quantity,
          expiresAt: reservation.expiresAt,
          status: 'RELEASED',
          createdAt: reservation.createdAt,
        });
        this.reservations.set(id, updated);
        released.push(updated);
      }
    }
    return released;
  }

  releaseByReservationId(reservationId: number): Promise<StockReservation | null> {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.status !== 'ACTIVE') {
      return Promise.resolve(null);
    }
    const updated = StockReservation.create({
      id: reservation.id,
      productId: reservation.productId,
      orderId: reservation.orderId,
      quantity: reservation.quantity,
      expiresAt: reservation.expiresAt,
      status: 'RELEASED',
      createdAt: reservation.createdAt,
    });
    this.reservations.set(reservationId, updated);
    return Promise.resolve(updated);
  }

  async getAvailability(productId: number): Promise<StockAvailability> {
    const product = await this.products.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const reserved = Array.from(this.reservations.values())
      .filter((r) => r.productId === productId && r.status === 'ACTIVE')
      .reduce((sum, r) => sum + r.quantity, 0);
    return {
      productId,
      totalStock: product.stock,
      reservedStock: reserved,
      availableStock: product.stock - reserved,
    };
  }

  expireStaleReservations(): Promise<number> {
    return Promise.resolve(0);
  }
}

export function resetTestIdSequences(): void {
  categorySeq = 1;
  productSeq = 1;
}
