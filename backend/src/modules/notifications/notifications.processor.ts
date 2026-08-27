import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { COURSE_PUBLISHED_JOB, NOTIFICATIONS_QUEUE } from '../../queue/queue.constants';
import { NotificationsService } from './notifications.service';

@Injectable()
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ courseId: string }>): Promise<void> {
    if (job.name !== COURSE_PUBLISHED_JOB) {
      return;
    }

    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: job.data.courseId },
      include: { enrollments: { include: { user: true } } },
    });

    for (const enrollment of course.enrollments) {
      if (env.NOTIFICATIONS_MOCK_MODE || !env.BREVO_API_KEY) {
        this.logger.debug(`Mock email to ${enrollment.user.email}: ${course.title}`);
      }

      await this.notificationsService.createAndEmit({
        userId: enrollment.userId,
        type: 'COURSE_PUBLISHED',
        title: 'Course published',
        body: `${course.title} is now available`,
      });
    }
  }
}
