import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Socket } from 'socket.io-client';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';
import { connectSocket } from './helpers/socket';
import { createWsTestApp } from './helpers/ws-app';

describe('Sessions realtime (e2e)', () => {
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

  it('allows an enrolled student to join a live session and receives participant count', async () => {
    const fixture = await createLiveSessionFixture();
    const socket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    sockets.push(socket);

    const statePromise = once(socket, 'session:state');
    socket.emit('session:join', { sessionId: fixture.session.id });

    await expect(statePromise).resolves.toMatchObject({
      id: fixture.session.id,
      status: 'LIVE',
      participantCount: 1,
    });
  });

  it('rejects a non-enrolled student joining a live session', async () => {
    const fixture = await createLiveSessionFixture({ enrollStudent: false });
    const socket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    sockets.push(socket);

    const errorPromise = once(socket, 'error');
    socket.emit('session:join', { sessionId: fixture.session.id });

    await expect(errorPromise).resolves.toMatchObject({
      message: expect.stringContaining('Khong co quyen'),
    });
  });

  it('persists and broadcasts chat messages to the session room', async () => {
    const fixture = await createLiveSessionFixture();
    const studentSocket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    const instructorSocket = await connectSocket(url, '/sessions', fixture.instructor.accessToken);
    sockets.push(studentSocket, instructorSocket);

    const studentStatePromise = once(studentSocket, 'session:state');
    studentSocket.emit('session:join', { sessionId: fixture.session.id });
    await studentStatePromise;

    const instructorStatePromise = once(instructorSocket, 'session:state');
    instructorSocket.emit('session:join', { sessionId: fixture.session.id });
    await instructorStatePromise;

    const messagePromise = once(instructorSocket, 'chat:message');
    studentSocket.emit('chat:send', {
      sessionId: fixture.session.id,
      content: 'Hello live class',
    });

    await expect(messagePromise).resolves.toMatchObject({
      sessionId: fixture.session.id,
      userId: fixture.student.userId,
      name: 'STUDENT User',
      content: 'Hello live class',
    });

    await expect(prisma.chatMessage.count()).resolves.toBe(1);
  });

  async function createLiveSessionFixture(options: { enrollStudent?: boolean } = {}) {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');

    const course = await createCourse(instructor.accessToken);

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/publish`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    if (options.enrollStudent !== false) {
      await request(app.getHttpServer())
        .post(`/api/courses/${course.id}/enroll`)
        .set('Authorization', `Bearer ${student.accessToken}`)
        .expect(201);
    }

    const session = await createSession(instructor.accessToken, course.id);

    await request(app.getHttpServer())
      .post(`/api/sessions/${session.id}/start`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    return {
      instructor,
      student,
      course,
      session: { ...session, status: 'LIVE' },
    };
  }

  async function createCourse(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: `Realtime Course ${Date.now()} ${Math.random()}`,
        slug: `realtime-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      })
      .expect(201);

    return res.body.data;
  }

  async function createSession(accessToken: string, courseId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/sessions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Live demo', startsAt: futureIsoDate() })
      .expect(201);

    return res.body.data;
  }
});

function once<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function futureIsoDate(): string {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}
