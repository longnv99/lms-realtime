import { ValidationPipe } from '@nestjs/common';

export const wsValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
