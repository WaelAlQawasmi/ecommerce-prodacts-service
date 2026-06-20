import {
  CreateCategoryUseCase,
  DeleteCategoryUseCase,
  UpdateCategoryUseCase,
} from '../../../src/application/category/CategoryUseCases';
import {
  CreateProductUseCase,
  SearchProductsUseCase,
  ListProductsByCategoryUseCase,
} from '../../../src/application/product/ProductUseCases';
import {
  InMemoryCategoryRepository,
  InMemoryProductRepository,
  InMemorySearchRepository,
  makeCategory,
  makeProduct,
  resetTestIdSequences,
} from '../../helpers/repositories';
import { ConflictError, NotFoundError, ValidationError } from '../../../src/domain/shared/DomainError';

describe('CategoryUseCases', () => {
  let categoryRepo: InMemoryCategoryRepository;

  beforeEach(() => {
    resetTestIdSequences();
    categoryRepo = new InMemoryCategoryRepository();
    categoryRepo.seed(makeCategory({ id: 1 }));
  });

  describe('CreateCategoryUseCase', () => {
    it('should create a category with slugified name', async () => {
      const useCase = new CreateCategoryUseCase(categoryRepo);
      const result = await useCase.execute({ name: 'Home & Garden', description: 'Home items' });
      expect(result.name).toBe('Home & Garden');
      expect(result.slug).toBe('home-garden');
    });

    it('should reject empty name', async () => {
      const useCase = new CreateCategoryUseCase(categoryRepo);
      await expect(useCase.execute({ name: '  ' })).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate category names', async () => {
      const useCase = new CreateCategoryUseCase(categoryRepo);
      await expect(useCase.execute({ name: 'Electronics' })).rejects.toThrow(ConflictError);
    });
  });

  describe('DeleteCategoryUseCase', () => {
    it('should throw when category not found', async () => {
      const useCase = new DeleteCategoryUseCase(categoryRepo);
      await expect(useCase.execute(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('UpdateCategoryUseCase', () => {
    it('should update category name and slug', async () => {
      const useCase = new UpdateCategoryUseCase(categoryRepo);
      const result = await useCase.execute(1, { name: 'Gadgets' });
      expect(result.name).toBe('Gadgets');
      expect(result.slug).toBe('gadgets');
    });
  });
});

describe('ProductUseCases', () => {
  let categoryRepo: InMemoryCategoryRepository;
  let productRepo: InMemoryProductRepository;
  let searchRepo: InMemorySearchRepository;

  beforeEach(() => {
    resetTestIdSequences();
    categoryRepo = new InMemoryCategoryRepository();
    productRepo = new InMemoryProductRepository();
    searchRepo = new InMemorySearchRepository();
    categoryRepo.seed(makeCategory({ id: 1 }));
    productRepo.seed(makeProduct({ id: 1, categoryId: 1 }));
  });

  describe('CreateProductUseCase', () => {
    it('should create product and index in search', async () => {
      const useCase = new CreateProductUseCase(productRepo, categoryRepo, searchRepo);
      const result = await useCase.execute({
        name: 'Smart Watch',
        price: 299.99,
        stock: 30,
        categoryId: 1,
      });
      expect(result.name).toBe('Smart Watch');
      expect(result.slug).toBe('smart-watch');

      const search = new SearchProductsUseCase(searchRepo);
      const found = await search.execute('Smart', { page: 1, limit: 10 });
      expect(found.data).toHaveLength(1);
    });

    it('should reject invalid price', async () => {
      const useCase = new CreateProductUseCase(productRepo, categoryRepo, searchRepo);
      await expect(
        useCase.execute({ name: 'Bad', price: 0, stock: 1, categoryId: 1 }),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject unknown category', async () => {
      const useCase = new CreateProductUseCase(productRepo, categoryRepo, searchRepo);
      await expect(
        useCase.execute({ name: 'Item', price: 10, stock: 1, categoryId: 999 }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('ListProductsByCategoryUseCase', () => {
    it('should return products for valid category', async () => {
      const useCase = new ListProductsByCategoryUseCase(productRepo, categoryRepo);
      const result = await useCase.execute(1, { page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
    });

    it('should throw for unknown category', async () => {
      const useCase = new ListProductsByCategoryUseCase(productRepo, categoryRepo);
      await expect(useCase.execute(999, { page: 1, limit: 10 })).rejects.toThrow(NotFoundError);
    });
  });

  describe('SearchProductsUseCase', () => {
    it('should require search query', async () => {
      const useCase = new SearchProductsUseCase(searchRepo);
      await expect(useCase.execute('', { page: 1, limit: 10 })).rejects.toThrow(ValidationError);
    });
  });
});
