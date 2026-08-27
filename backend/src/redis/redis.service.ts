import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  getClient(): Redis {
    return this.client;
  }

  duplicate(): Redis {
    return this.client.duplicate({ lazyConnect: true });
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
