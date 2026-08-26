import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { API_ERROR_CODES } from '@lms/shared';
import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const appError = exception instanceof AppError ? exception : null;
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const code = appError?.code ?? this.mapHttpStatusToCode(status);
    const message = exception instanceof HttpException ? exception.message : 'Loi may chu noi bo';
    const details = appError?.details;

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      data: null,
      error: details ? { code, message, details } : { code, message },
      meta: null,
    });
  }

  private mapHttpStatusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return API_ERROR_CODES.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return API_ERROR_CODES.AUTH_UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return API_ERROR_CODES.AUTH_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return API_ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return API_ERROR_CODES.CONFLICT;
      default:
        return status >= 500 ? API_ERROR_CODES.INTERNAL_ERROR : `HTTP_${status}`;
    }
  }
}
