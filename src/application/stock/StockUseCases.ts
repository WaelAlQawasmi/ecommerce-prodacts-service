import { StockRepository } from '../../domain/stock/StockRepository';
import { ReserveStockInput, StockReservation, StockAvailability } from '../../domain/stock/StockReservation';

export class ReserveStockUseCase {
  constructor(
    private readonly stockRepository: StockRepository,
    private readonly defaultTtlSeconds: number,
  ) {}

  execute(input: ReserveStockInput): Promise<StockReservation> {
    const ttl = input.ttlSeconds ?? this.defaultTtlSeconds;
    return this.stockRepository.reserve(input, ttl);
  }
}

export class ReleaseStockUseCase {
  constructor(private readonly stockRepository: StockRepository) {}

  execute(orderId: string): Promise<StockReservation[]> {
    return this.stockRepository.release(orderId);
  }
}

export class GetStockAvailabilityUseCase {
  constructor(private readonly stockRepository: StockRepository) {}

  execute(productId: number): Promise<StockAvailability> {
    return this.stockRepository.getAvailability(productId);
  }
}

export class ExpireStaleReservationsUseCase {
  constructor(private readonly stockRepository: StockRepository) {}

  execute(): Promise<number> {
    return this.stockRepository.expireStaleReservations();
  }
}
