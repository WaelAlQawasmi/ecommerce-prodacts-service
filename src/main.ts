import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { loadConfig } from './config';
import { JwtVerifier } from './infrastructure/auth/JwtVerifier';
import { PrismaCategoryRepository } from './infrastructure/persistence/PrismaCategoryRepository';
import { PrismaProductRepository } from './infrastructure/persistence/PrismaProductRepository';
import { PrismaStockRepository } from './infrastructure/persistence/PrismaStockRepository';
import { ElasticsearchProductSearchRepository } from './infrastructure/search/ElasticsearchProductSearchRepository';
import { PrismaProductSearchRepository } from './infrastructure/search/PrismaProductSearchRepository';
import { ProductSearchRepository } from './domain/product/ProductSearchRepository';
import { GrpcStockServer } from './infrastructure/grpc/GrpcStockServer';
import {
  createKafkaClient,
  StockReleaseConsumer,
} from './infrastructure/messaging/StockReleaseConsumer';
import {
  ListCategoriesUseCase,
  GetCategoryUseCase,
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
} from './application/category/CategoryUseCases';
import {
  ListProductsUseCase,
  ListProductsByCategoryUseCase,
  SearchProductsUseCase,
  GetProductUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
} from './application/product/ProductUseCases';
import { ExpireStaleReservationsUseCase } from './application/stock/StockUseCases';
import { createHttpApp } from './interfaces/http/app';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient();
  const redis = new Redis(config.redisUrl);

  const categoryRepository = new PrismaCategoryRepository(prisma);
  const productRepository = new PrismaProductRepository(prisma);
  const stockRepository = new PrismaStockRepository(prisma, redis);
  const searchRepository: ProductSearchRepository = config.elasticsearchEnabled
    ? new ElasticsearchProductSearchRepository(
        new ElasticsearchClient({ node: config.elasticsearchNode }),
        config.elasticsearchIndex,
        productRepository,
      )
    : new PrismaProductSearchRepository(prisma);

  await searchRepository.ensureIndex();

  if (!config.elasticsearchEnabled) {
    console.log('Elasticsearch disabled — product search uses PostgreSQL.');
  }

  const jwtVerifier = new JwtVerifier(config.passportPublicKey);

  const httpApp = createHttpApp({
    config,
    jwtVerifier,
    listProducts: new ListProductsUseCase(productRepository),
    listByCategory: new ListProductsByCategoryUseCase(productRepository, categoryRepository),
    searchProducts: new SearchProductsUseCase(searchRepository),
    getProduct: new GetProductUseCase(productRepository),
    createProduct: new CreateProductUseCase(
      productRepository,
      categoryRepository,
      searchRepository,
    ),
    updateProduct: new UpdateProductUseCase(
      productRepository,
      categoryRepository,
      searchRepository,
    ),
    deleteProduct: new DeleteProductUseCase(productRepository, searchRepository),
    listCategories: new ListCategoriesUseCase(categoryRepository),
    getCategory: new GetCategoryUseCase(categoryRepository),
    createCategory: new CreateCategoryUseCase(categoryRepository),
    updateCategory: new UpdateCategoryUseCase(categoryRepository),
    deleteCategory: new DeleteCategoryUseCase(categoryRepository),
  });

  const grpcServer = new GrpcStockServer(stockRepository, config.stockReservationTtlSeconds);
  await grpcServer.start(config.grpcPort);

  let stockReleaseConsumer: StockReleaseConsumer | null = null;
  if (config.kafkaEnabled) {
    const kafka = createKafkaClient(config.kafkaBrokers, config.kafkaClientId);
    stockReleaseConsumer = new StockReleaseConsumer(
      kafka,
      config.kafkaGroupId,
      config.kafkaStockReleaseTopic,
      stockRepository,
    );
    await stockReleaseConsumer.start();
  } else {
    console.log('Kafka disabled — stock release consumer not started.');
  }

  const expireReservations = new ExpireStaleReservationsUseCase(stockRepository);
  const expiryInterval = setInterval(async () => {
    try {
      const count = await expireReservations.execute();
      if (count > 0) {
        console.log(`Released ${count} expired stock reservations`);
      }
    } catch (error) {
      console.error('Failed to expire reservations:', error);
    }
  }, 60_000);

  const server = httpApp.listen(config.port, () => {
    console.log(`HTTP server listening on port ${config.port}`);
    if (config.swaggerEnabled) {
      console.log(`Swagger docs: http://localhost:${config.port}/api/docs`);
    }
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    clearInterval(expiryInterval);
    server.close();
    await grpcServer.stop();
    if (stockReleaseConsumer) {
      await stockReleaseConsumer.stop();
    }
    await redis.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start service:', error);
  process.exit(1);
});
