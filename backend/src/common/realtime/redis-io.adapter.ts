import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { env } from '../../config/env';
import { RedisService } from '../../redis/redis.service';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;
  private readonly servers = new Set<any>();

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

    this.servers.add(server);
    return server;
  }

  async close(server?: Parameters<IoAdapter['close']>[0]): Promise<void> {
    if (server) {
      if (!this.servers.has(server)) {
        return;
      }

      await super.close(server);
      this.servers.delete(server);
    } else {
      await Promise.all(
        [...this.servers].map(async (createdServer) => {
          await super.close(createdServer);
          this.servers.delete(createdServer);
        }),
      );
    }

    if (this.servers.size > 0) {
      return;
    }

    await Promise.all([this.closeClient(this.pubClient), this.closeClient(this.subClient)]);
  }

  private async closeClient(client?: Redis): Promise<void> {
    if (!client || client.status === 'end') {
      return;
    }

    client.on('error', (error) => {
      if (error.message === 'Connection is closed.') {
        return;
      }

      this.logger.warn(error.message);
    });

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
