import { PrismaClient, StockReservation as PrismaReservation } from '@prisma/client';
import Redis from 'ioredis';
import { StockRepository } from '../../domain/stock/StockRepository';
import {
  StockReservation,
  ReserveStockInput,
  StockAvailability,
} from '../../domain/stock/StockReservation';
import {
  NotFoundError,
  InsufficientStockError,
  ConflictError,
} from '../../domain/shared/DomainError';
import { toBigIntId, toNumberId } from '../../domain/shared/Id';

function toDomain(record: PrismaReservation): StockReservation {
  return StockReservation.create({
    id: toNumberId(record.id),
    productId: toNumberId(record.productId),
    orderId: record.orderId,
    quantity: record.quantity,
    expiresAt: record.expiresAt,
    status: record.status,
    createdAt: record.createdAt,
  });
}

export class PrismaStockRepository implements StockRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  private reservationKey(reservationId: number): string {
    return `stock:reservation:${reservationId}`;
  }

  async reserve(input: ReserveStockInput, ttlSeconds: number): Promise<StockReservation> {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: toBigIntId(input.productId) },
      });
      if (!product || !product.isActive) {
        throw new NotFoundError('Product', input.productId);
      }

      const existing = await tx.stockReservation.findFirst({
        where: { orderId: input.orderId, status: 'ACTIVE' },
      });
      if (existing) {
        throw new ConflictError(`Stock already reserved for order '${input.orderId}'`);
      }

      const reservedAgg = await tx.stockReservation.aggregate({
        where: {
          productId: toBigIntId(input.productId),
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        _sum: { quantity: true },
      });
      const reserved = reservedAgg._sum.quantity ?? 0;
      const available = product.stock - reserved;

      if (available < input.quantity) {
        throw new InsufficientStockError(input.productId, input.quantity, available);
      }

      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const record = await tx.stockReservation.create({
        data: {
          productId: toBigIntId(input.productId),
          orderId: input.orderId,
          quantity: input.quantity,
          expiresAt,
          status: 'ACTIVE',
        },
      });

      const reservationId = toNumberId(record.id);
      await this.redis.setex(
        this.reservationKey(reservationId),
        ttlSeconds,
        JSON.stringify({ orderId: input.orderId, productId: input.productId }),
      );

      return toDomain(record);
    });
  }

  async release(orderId: string): Promise<StockReservation[]> {
    return this.prisma.$transaction(async (tx) => {
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' },
      });

      if (reservations.length === 0) {
        return [];
      }

      const released: StockReservation[] = [];
      for (const reservation of reservations) {
        const updated = await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { status: 'RELEASED' },
        });
        await this.redis.del(this.reservationKey(toNumberId(reservation.id)));
        released.push(toDomain(updated));
      }

      return released;
    });
  }

  async releaseByReservationId(reservationId: number): Promise<StockReservation | null> {
    const reservation = await this.prisma.stockReservation.findUnique({
      where: { id: toBigIntId(reservationId) },
    });
    if (!reservation || reservation.status !== 'ACTIVE') {
      return null;
    }

    const updated = await this.prisma.stockReservation.update({
      where: { id: toBigIntId(reservationId) },
      data: { status: 'RELEASED' },
    });
    await this.redis.del(this.reservationKey(reservationId));
    return toDomain(updated);
  }

  async getAvailability(productId: number): Promise<StockAvailability> {
    const product = await this.prisma.product.findUnique({
      where: { id: toBigIntId(productId) },
    });
    if (!product) {
      throw new NotFoundError('Product', productId);
    }

    const reservedAgg = await this.prisma.stockReservation.aggregate({
      where: {
        productId: toBigIntId(productId),
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      _sum: { quantity: true },
    });
    const reservedStock = reservedAgg._sum.quantity ?? 0;

    return {
      productId,
      totalStock: product.stock,
      reservedStock,
      availableStock: Math.max(0, product.stock - reservedStock),
    };
  }

  async expireStaleReservations(): Promise<number> {
    const stale = await this.prisma.stockReservation.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: new Date() },
      },
    });

    if (stale.length === 0) {
      return 0;
    }

    await this.prisma.stockReservation.updateMany({
      where: {
        id: { in: stale.map((r) => r.id) },
      },
      data: { status: 'RELEASED' },
    });

    for (const reservation of stale) {
      await this.redis.del(this.reservationKey(toNumberId(reservation.id)));
    }

    return stale.length;
  }
}
