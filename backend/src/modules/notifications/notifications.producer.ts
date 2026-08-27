import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { COURSE_PUBLISHED_JOB, NOTIFICATIONS_QUEUE } from '../../queue/queue.constants';

@Injectable()
export class NotificationsProducer {
  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async enqueueCoursePublished(courseId: string, publishedAt: Date): Promise<void> {
    await this.queue.add(
      COURSE_PUBLISHED_JOB,
      { courseId },
      { jobId: `course-published:${courseId}:${publishedAt.getTime()}` },
    );
  }
}
