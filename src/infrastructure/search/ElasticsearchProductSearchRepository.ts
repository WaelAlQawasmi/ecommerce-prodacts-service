import { Client } from '@elastic/elasticsearch';
import { ProductSearchRepository } from '../../domain/product/ProductSearchRepository';
import { ProductSearchDocument } from '../../domain/product/Product';
import { ProductRepository } from '../../domain/product/ProductRepository';
import {
  PaginationParams,
  PaginatedResult,
  createPaginatedResult,
} from '../../domain/shared/Pagination';
import { Product } from '../../domain/product/Product';

export class ElasticsearchProductSearchRepository implements ProductSearchRepository {
  constructor(
    private readonly client: Client,
    private readonly index: string,
    private readonly productRepository: ProductRepository,
  ) {}

  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.index });
    if (!exists) {
      await this.client.indices.create({
        index: this.index,
        body: {
          mappings: {
            properties: {
              id: { type: 'long' },
              name: { type: 'text', analyzer: 'standard' },
              slug: { type: 'keyword' },
              description: { type: 'text' },
              price: { type: 'float' },
              categoryId: { type: 'long' },
              isActive: { type: 'boolean' },
            },
          },
        },
      });
    }
  }

  async indexProduct(document: ProductSearchDocument): Promise<void> {
    await this.client.index({
      index: this.index,
      id: String(document.id),
      document,
      refresh: true,
    });
  }

  async removeProduct(productId: number): Promise<void> {
    try {
      await this.client.delete({ index: this.index, id: String(productId), refresh: true });
    } catch {
      // ignore if not found in index
    }
  }

  async searchByName(
    query: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<Product>> {
    const from = (params.page - 1) * params.limit;
    const response = await this.client.search<{ id: number }>({
      index: this.index,
      from,
      size: params.limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ['name^3', 'description'],
                fuzziness: 'AUTO',
              },
            },
          ],
          filter: [{ term: { isActive: true } }],
        },
      },
    });

    const hits = response.hits.hits;
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    const products: Product[] = [];
    for (const hit of hits) {
      if (hit._source?.id !== undefined) {
        const product = await this.productRepository.findById(Number(hit._source.id));
        if (product?.isActive) {
          products.push(product);
        }
      }
    }

    return createPaginatedResult(products, total, params);
  }
}
