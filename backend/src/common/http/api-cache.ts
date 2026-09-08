import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export function configureApiResponseCaching(app: INestApplication): void {
  const expressInstance = app.getHttpAdapter().getInstance();

  if (typeof expressInstance.disable === 'function') {
    expressInstance.disable('etag');
  }

  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
}
