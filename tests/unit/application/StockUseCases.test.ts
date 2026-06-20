import { ReserveStockUseCase, ReleaseStockUseCase, GetStockAvailabilityUseCase } from '../../../src/application/stock/StockUseCases';
import {
  InMemoryProductRepository,
  InMemoryStockRepository,
  makeProduct,
  resetTestIdSequences,
} from '../../helpers/repositories';

describe('StockUseCases', () => {
  let productRepo: InMemoryProductRepository;
  let stockRepo: InMemoryStockRepository;

  beforeEach(() => {
    resetTestIdSequences();
    productRepo = new InMemoryProductRepository();
    productRepo.seed(makeProduct({ id: 1, stock: 10 }));
    stockRepo = new InMemoryStockRepository(productRepo);
  });

  describe('ReserveStockUseCase', () => {
    it('should reserve stock with TTL', async () => {
      const useCase = new ReserveStockUseCase(stockRepo, 900);
      const reservation = await useCase.execute({
        productId: 1,
        orderId: 'order-123',
        quantity: 2,
      });
      expect(reservation.status).toBe('ACTIVE');
      expect(reservation.quantity).toBe(2);
    });
  });

  describe('GetStockAvailabilityUseCase', () => {
    it('should return available stock after reservation', async () => {
      await new ReserveStockUseCase(stockRepo, 900).execute({
        productId: 1,
        orderId: 'order-456',
        quantity: 3,
      });

      const availability = await new GetStockAvailabilityUseCase(stockRepo).execute(1);
      expect(availability.totalStock).toBe(10);
      expect(availability.reservedStock).toBe(3);
      expect(availability.availableStock).toBe(7);
    });
  });

  describe('ReleaseStockUseCase', () => {
    it('should release reserved stock by order id', async () => {
      await new ReserveStockUseCase(stockRepo, 900).execute({
        productId: 1,
        orderId: 'order-789',
        quantity: 4,
      });

      const released = await new ReleaseStockUseCase(stockRepo).execute('order-789');
      expect(released).toHaveLength(1);
      expect(released[0].status).toBe('RELEASED');

      const availability = await new GetStockAvailabilityUseCase(stockRepo).execute(1);
      expect(availability.availableStock).toBe(10);
    });
  });
});
