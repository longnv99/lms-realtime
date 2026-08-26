import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = env.PORT;
  const corsOrigin = env.CORS_ORIGIN;

  app.enableCors({
    origin: corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.setGlobalPrefix('api');

  await app.listen(port);
  Logger.log(`Backend listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
