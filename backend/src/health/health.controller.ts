import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@lms/shared';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
