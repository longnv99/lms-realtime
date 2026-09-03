import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PROGRESS_FLUSH_JOB, PROGRESS_QUEUE } from '../../queue/queue.constants';

const PROGRESS_FLUSH_DELAY_MS = 60_000;

@Injectable()
export class ProgressProducer {
  constructor(@InjectQueue(PROGRESS_QUEUE) private readonly queue: Queue) {}

  async enqueueProgressFlush(userId: string, lessonId: string): Promise<void> {
    const jobId = this.jobId(userId, lessonId);
    const existingJob = await this.queue.getJob(jobId);

    if (existingJob) {
      await existingJob.remove();
    }

    await this.queue.add(
      PROGRESS_FLUSH_JOB,
      { userId, lessonId },
      { jobId, delay: PROGRESS_FLUSH_DELAY_MS },
    );
  }

  private jobId(userId: string, lessonId: string): string {
    return `progress:flush:${userId}:${lessonId}`;
  }
}
