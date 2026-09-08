import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { configureApiResponseCaching } from '../../src/common/http/api-cache';
import { EnvelopeInterceptor } from '../../src/common/interceptors/envelope.interceptor';
import { RedisIoAdapter } from '../../src/common/realtime/redis-io.adapter';

export async function createWsTestApp(): Promise<{ app: INestApplication; url: string }> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApiResponseCaching(app);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const closeApp = app.close.bind(app);
  app.close = async () => {
    await redisIoAdapter.close();
    await closeApp();
  };

  await app.listen(0);
  const address = app.getHttpServer().address() as AddressInfo;
  return { app, url: `http://127.0.0.1:${address.port}` };
}
