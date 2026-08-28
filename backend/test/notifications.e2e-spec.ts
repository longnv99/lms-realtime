import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Socket } from 'socket.io-client';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';
import { connectSocket } from './helpers/socket';
import { createWsTestApp } from './helpers/ws-app';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    const created = await createWsTestApp();
    app = created.app;
    url = created.url;
  });

  beforeEach(async () => {
    sockets = [];
    await cleanDatabase();
  });

  afterEach(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('lists and marks my notifications as read', async () => {
    const student = await registerAndLogin(app, 'STUDENT');
    const notification = await prisma.notification.create({
      data: {
        userId: student.userId,
        type: 'COURSE_PUBLISHED',
        title: 'Course published',
        body: 'Realtime LMS is live',
      },
    });

    const listRes = await request(app.getHttpServer())
      .get('/api/me/notifications')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);
    expect(listRes.body.data).toHaveLength(1);

    const readRes = await request(app.getHttpServer())
      .patch(`/api/me/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);
    expect(readRes.body.data.readAt).toEqual(expect.any(String));
  });

  it('emits notification:new to the authenticated user room', async () => {
    const student = await registerAndLogin(app, 'STUDENT');
    const socket = await connectSocket(url, '/notifications', student.accessToken);
    sockets.push(socket);

    const notificationPromise = once(socket, 'notification:new');
    await app.get(NotificationsService).createAndEmit({
      userId: student.userId,
      type: 'COURSE_PUBLISHED',
      title: 'Course published',
      body: 'Realtime LMS is live',
    });

    await expect(notificationPromise).resolves.toMatchObject({
      type: 'COURSE_PUBLISHED',
      title: 'Course published',
    });
  });
});

function once<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}
