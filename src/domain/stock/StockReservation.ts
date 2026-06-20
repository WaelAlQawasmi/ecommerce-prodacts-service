export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONFIRMED';

export interface StockReservationProps {
  id: number;
  productId: number;
  orderId: string;
  quantity: number;
  expiresAt: Date;
  status: ReservationStatus;
  createdAt: Date;
}

export class StockReservation {
  private constructor(private readonly props: StockReservationProps) {}

  static create(props: StockReservationProps): StockReservation {
    return new StockReservation(props);
  }

  get id(): number {
    return this.props.id;
  }

  get productId(): number {
    return this.props.productId;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get status(): ReservationStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  toJSON() {
    return {
      id: this.id,
      productId: this.productId,
      orderId: this.orderId,
      quantity: this.quantity,
      expiresAt: this.expiresAt.toISOString(),
      status: this.status,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

export interface ReserveStockInput {
  productId: number;
  orderId: string;
  quantity: number;
  ttlSeconds?: number;
}

export interface StockAvailability {
  productId: number;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}
