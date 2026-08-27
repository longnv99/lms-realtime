import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { PaginatedData, PaginationMeta } from '../utils/pagination';

export interface Envelope<T> {
  success: boolean;
  data: T;
  error: null;
  meta: null | PaginationMeta;
}

@Injectable()
export class EnvelopeInterceptor<T> implements NestInterceptor<T, Envelope<unknown>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Envelope<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        if (this.hasMeta(payload)) {
          return {
            success: true,
            data: payload.data,
            error: null,
            meta: payload.meta,
          };
        }

        return {
          success: true,
          data: payload,
          error: null,
          meta: null,
        };
      }),
    );
  }

  private hasMeta(payload: T | PaginatedData<unknown>): payload is PaginatedData<unknown> {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'data' in payload &&
      'meta' in payload &&
      typeof payload.meta === 'object' &&
      payload.meta !== null
    );
  }
}
