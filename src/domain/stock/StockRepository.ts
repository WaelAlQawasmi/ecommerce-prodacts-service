import { StockReservation, ReserveStockInput, StockAvailability } from './StockReservation';

export interface StockRepository {
  reserve(input: ReserveStockInput, ttlSeconds: number): Promise<StockReservation>;
  release(orderId: string): Promise<StockReservation[]>;
  releaseByReservationId(reservationId: number): Promise<StockReservation | null>;
  getAvailability(productId: number): Promise<StockAvailability>;
  expireStaleReservations(): Promise<number>;
}
