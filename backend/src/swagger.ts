import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('LMS Realtime API')
    .setDescription('REST API documentation for LMS Realtime backend')
    .setVersion('0.3.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste accessToken from /api/auth/login',
      },
      'access-token',
    )
    .addTag('Auth')
    .addTag('Courses')
    .addTag('Enrollments')
    .addTag('Health')
    .addTag('Lessons')
    .addTag('Quizzes')
    .addTag('Sessions')
    .addTag('Users')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace('Controller', '')}_${methodKey}`,
  });

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: '/api/docs-json',
    swaggerOptions: {
      displayRequestDuration: true,
      operationsSorter: 'alpha',
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });
}
