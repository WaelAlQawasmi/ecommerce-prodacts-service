import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { StockRepository } from '../../domain/stock/StockRepository';

export interface StockReleaseEvent {
  orderId: string;
  reservationId?: number;
}

export class StockReleaseConsumer {
  private consumer: Consumer | null = null;

  constructor(
    private readonly kafka: Kafka,
    private readonly groupId: string,
    private readonly topic: string,
    private readonly stockRepository: StockRepository,
  ) {}

  async start(): Promise<void> {
    this.consumer = this.kafka.consumer({ groupId: this.groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await this.handleMessage(payload);
      },
    });
  }

  async stop(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }

  private async handleMessage({ message }: EachMessagePayload): Promise<void> {
    if (!message.value) {
      return;
    }

    try {
      const event = JSON.parse(message.value.toString()) as StockReleaseEvent;

      if (event.reservationId) {
        await this.stockRepository.releaseByReservationId(event.reservationId);
      } else if (event.orderId) {
        await this.stockRepository.release(event.orderId);
      }
    } catch (error) {
      console.error('Failed to process stock release event:', error);
    }
  }
}

export function createKafkaClient(brokers: string[], clientId: string): Kafka {
  return new Kafka({
    clientId,
    brokers,
    retry: { retries: 5 },
  });
}
