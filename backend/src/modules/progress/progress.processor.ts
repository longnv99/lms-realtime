import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PROGRESS_FLUSH_JOB, PROGRESS_QUEUE } from '../../queue/queue.constants';
import { ProgressService } from './progress.service';

@Injectable()
@Processor(PROGRESS_QUEUE)
export class ProgressProcessor extends WorkerHost {
  private readonly logger = new Logger(ProgressProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly progressService: ProgressService,
  ) {
    super();
  }

  async process(job: Job<{ userId: string; lessonId: string }>): Promise<void> {
    if (job.name !== PROGRESS_FLUSH_JOB) {
      return;
    }

    const key = this.progressKey(job.data.userId, job.data.lessonId);
    const progress = await this.redis.getClient().hgetall(key);
    const positionSeconds = Number(progress.positionSeconds ?? 0);

    if (!progress.positionSeconds || !Number.isFinite(positionSeconds)) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: job.data.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      await this.redis.getClient().del(key);
      return;
    }

    await this.progressService.recordHeartbeat(user as AuthenticatedUser, job.data.lessonId, positionSeconds);
    await this.redis.getClient().del(key);
  }

  @OnWorkerEvent('error')
  onError(error: Error): void {
    if (error.message === 'Connection is closed.') {
      return;
    }

    this.logger.error(error.message, error.stack);
  }

  private progressKey(userId: string, lessonId: string): string {
    return `progress:${userId}:${lessonId}`;
  }
}
