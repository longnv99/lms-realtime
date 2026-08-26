import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@lms/shared';

export class AppError extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}
