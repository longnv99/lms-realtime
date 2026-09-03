import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { env } from '../config/env';
import { NOTIFICATIONS_QUEUE, PROGRESS_QUEUE } from './queue.constants';

const redisUrl = new URL(env.REDIS_URL);

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port || 6379),
        password: redisUrl.password || undefined,
        maxRetriesPerRequest: null,
      },
    }),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
    BullModule.registerQueue({
      name: PROGRESS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
