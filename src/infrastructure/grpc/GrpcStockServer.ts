import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { StockRepository } from '../../domain/stock/StockRepository';
import { DomainError } from '../../domain/shared/DomainError';

const PROTO_PATH = path.join(__dirname, 'proto', 'stock.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const stockProto = grpc.loadPackageDefinition(packageDefinition).products as grpc.GrpcObject;

interface ReserveStockRequest {
  product_id: string;
  order_id: string;
  quantity: number;
  ttl_seconds?: number;
}

interface StockAvailabilityRequest {
  product_id: string;
}

export class GrpcStockServer {
  private server: grpc.Server;

  constructor(
    private readonly stockRepository: StockRepository,
    private readonly defaultTtlSeconds: number,
  ) {
    this.server = new grpc.Server();
  }

  start(port: number): Promise<void> {
    const StockService = stockProto.StockService as grpc.ServiceClientConstructor;

    this.server.addService(StockService.service, {
      ReserveStock: this.reserveStock.bind(this),
      GetStockAvailability: this.getStockAvailability.bind(this),
    });

    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        (err, boundPort) => {
          if (err) {
            reject(err);
            return;
          }
          this.server.start();
          console.log(`gRPC server listening on port ${boundPort}`);
          resolve();
        },
      );
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.tryShutdown(() => resolve());
    });
  }

  private async reserveStock(
    call: grpc.ServerUnaryCall<ReserveStockRequest, unknown>,
    callback: grpc.sendUnaryData<unknown>,
  ): Promise<void> {
    try {
      const { product_id, order_id, quantity, ttl_seconds } = call.request;
      const reservation = await this.stockRepository.reserve(
        {
          productId: Number(product_id),
          orderId: order_id,
          quantity,
          ttlSeconds: ttl_seconds,
        },
        ttl_seconds ?? this.defaultTtlSeconds,
      );

      callback(null, {
        reservation_id: String(reservation.id),
        product_id: String(reservation.productId),
        order_id: reservation.orderId,
        quantity: reservation.quantity,
        expires_at: reservation.expiresAt.toISOString(),
        status: reservation.status,
      });
    } catch (error) {
      callback(this.toGrpcError(error), null);
    }
  }

  private async getStockAvailability(
    call: grpc.ServerUnaryCall<StockAvailabilityRequest, unknown>,
    callback: grpc.sendUnaryData<unknown>,
  ): Promise<void> {
    try {
      const availability = await this.stockRepository.getAvailability(
        Number(call.request.product_id),
      );
      callback(null, {
        product_id: String(availability.productId),
        total_stock: availability.totalStock,
        reserved_stock: availability.reservedStock,
        available_stock: availability.availableStock,
      });
    } catch (error) {
      callback(this.toGrpcError(error), null);
    }
  }

  private toGrpcError(error: unknown): grpc.ServiceError {
    if (error instanceof DomainError) {
      const code =
        error.statusCode === 404
          ? grpc.status.NOT_FOUND
          : error.statusCode === 409
            ? grpc.status.FAILED_PRECONDITION
            : grpc.status.INVALID_ARGUMENT;
      return { code, message: error.message } as grpc.ServiceError;
    }
    return {
      code: grpc.status.INTERNAL,
      message: error instanceof Error ? error.message : 'Internal error',
    } as grpc.ServiceError;
  }
}
