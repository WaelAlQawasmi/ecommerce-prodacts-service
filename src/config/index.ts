function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

export interface AppConfig {
  port: number;
  grpcPort: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  stockReservationTtlSeconds: number;
  elasticsearchEnabled: boolean;
  elasticsearchNode: string;
  elasticsearchIndex: string;
  kafkaEnabled: boolean;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaGroupId: string;
  kafkaStockReleaseTopic: string;
  passportPublicKey: string;
  swaggerEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function parsePublicKey(raw: string): string {
  return raw.replace(/\\n/g, '\n');
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const elasticsearchEnabled = parseBoolean(process.env.ELASTICSEARCH_ENABLED, true);
  const kafkaEnabled = parseBoolean(process.env.KAFKA_ENABLED, true);

  return {
    port: parseInt(process.env.PORT ?? '3001', 10),
    grpcPort: parseInt(process.env.GRPC_PORT ?? '50051', 10),
    nodeEnv,
    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: requireEnv('REDIS_URL'),
    stockReservationTtlSeconds: parseInt(
      process.env.STOCK_RESERVATION_TTL_SECONDS ?? '900',
      10,
    ),
    elasticsearchEnabled,
    elasticsearchNode: elasticsearchEnabled
      ? requireEnv('ELASTICSEARCH_NODE')
      : (process.env.ELASTICSEARCH_NODE ?? 'http://localhost:9200'),
    elasticsearchIndex: process.env.ELASTICSEARCH_INDEX ?? 'products',
    kafkaEnabled,
    kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
    kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'products-service',
    kafkaGroupId: process.env.KAFKA_GROUP_ID ?? 'products-service-group',
    kafkaStockReleaseTopic: process.env.KAFKA_STOCK_RELEASE_TOPIC ?? 'stock.release',
    passportPublicKey: parsePublicKey(requireEnv('PASSPORT_PUBLIC_KEY')),
    swaggerEnabled: parseBoolean(
      process.env.SWAGGER_ENABLED,
      nodeEnv !== 'production',
    ),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  };
}
