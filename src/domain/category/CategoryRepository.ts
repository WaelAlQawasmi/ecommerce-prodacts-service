import { Category, CreateCategoryInput, UpdateCategoryInput } from './Category';
import { PaginationParams, PaginatedResult } from '../shared/Pagination';

export interface CategoryRepository {
  findAll(params: PaginationParams): Promise<PaginatedResult<Category>>;
  findById(id: number): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  create(input: CreateCategoryInput, slug: string): Promise<Category>;
  update(id: number, input: UpdateCategoryInput, slug?: string): Promise<Category>;
  delete(id: number): Promise<void>;
  countProducts(categoryId: number): Promise<number>;
}
