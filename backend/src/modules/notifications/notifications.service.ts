import { HttpStatus, Injectable } from '@nestjs/common';
import type { NotificationPayload } from '@lms/shared';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!notification) {
      throw new AppError('NOT_FOUND', 'Khong tim thay notification', HttpStatus.NOT_FOUND);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async createAndEmit(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
  }): Promise<NotificationPayload> {
    const notification = await this.prisma.notification.create({ data: input });
    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt.toISOString(),
    };

    this.gateway.emitNewNotification(input.userId, payload);

    return payload;
  }
}
