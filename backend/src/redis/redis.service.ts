import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client = this.createClient();

  getClient(): Redis {
    return this.client;
  }

  duplicate(): Redis {
    return this.attachErrorHandler(this.client.duplicate({ lazyConnect: true }));
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeClient(this.client);
  }

  private createClient(): Redis {
    return this.attachErrorHandler(
      new Redis(env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      }),
    );
  }

  private attachErrorHandler(client: Redis): Redis {
    client.on('error', (error) => {
      if (error.message === 'Connection is closed.') {
        return;
      }

      this.logger.warn(error.message);
    });

    return client;
  }

  private async closeClient(client: Redis): Promise<void> {
    if (client.status === 'end') {
      return;
    }

    if (client.status === 'wait') {
      client.disconnect(false);
      return;
    }

    try {
      await client.quit();
    } catch {
      client.disconnect(false);
    }
  }
}
