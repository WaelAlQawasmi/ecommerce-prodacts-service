import { Product, CreateProductInput, UpdateProductInput } from './Product';
import { PaginationParams, PaginatedResult } from '../shared/Pagination';

export interface ProductRepository {
  findAll(params: PaginationParams, activeOnly?: boolean): Promise<PaginatedResult<Product>>;
  findByCategory(categoryId: number, params: PaginationParams): Promise<PaginatedResult<Product>>;
  findById(id: number): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  create(input: CreateProductInput, slug: string): Promise<Product>;
  update(id: number, input: UpdateProductInput, slug?: string): Promise<Product>;
  delete(id: number): Promise<void>;
  decrementStock(productId: number, quantity: number): Promise<Product>;
  incrementStock(productId: number, quantity: number): Promise<Product>;
  getReservedQuantity(productId: number): Promise<number>;
}
