import { ProductSearchDocument } from '../product/Product';
import { PaginationParams, PaginatedResult } from '../shared/Pagination';
import { Product } from '../product/Product';

export interface ProductSearchRepository {
  indexProduct(document: ProductSearchDocument): Promise<void>;
  removeProduct(productId: number): Promise<void>;
  searchByName(query: string, params: PaginationParams): Promise<PaginatedResult<Product>>;
  ensureIndex(): Promise<void>;
}
