import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@lms/shared';

@ApiTags('Health')
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
