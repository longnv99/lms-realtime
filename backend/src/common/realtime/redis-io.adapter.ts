import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../../config/env';
import { RedisService } from '../../redis/redis.service';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redis = this.app.get(RedisService);
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.pubClient = pubClient;
    this.subClient = subClient;
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any) {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: env.CORS_ORIGIN,
        credentials: true,
      },
    });

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }

  async close(server?: Parameters<IoAdapter['close']>[0]): Promise<void> {
    if (server) {
      await super.close(server);
    }
    await Promise.all([this.quitClient(this.pubClient), this.quitClient(this.subClient)]);
  }

  private async quitClient(client?: Redis): Promise<void> {
    if (!client || client.status === 'end') {
      return;
    }

    await client.quit();
  }
}
