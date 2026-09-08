import { INestApplication } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { RedisService } from '../src/redis/redis.service';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';
import { connectSocket } from './helpers/socket';
import { createWsTestApp } from './helpers/ws-app';

describe('Progress realtime (e2e)', () => {
  let app: INestApplication;
  let url: string;
  let redis: RedisService;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    const created = await createWsTestApp();
    app = created.app;
    url = created.url;
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    sockets = [];
    await deleteProgressKeys();
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

  it('stores latest heartbeat progress in Redis for an enrolled student', async () => {
    const fixture = await createLiveProgressFixture();
    const socket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    sockets.push(socket);
    await joinSession(socket, fixture.session.id);

    socket.emit('progress:heartbeat', {
      lessonId: fixture.lessons[0].id,
      positionSeconds: 45,
    });

    await waitFor(async () => {
      const progress = await redis.getClient().hgetall(progressKey(fixture.student.userId, fixture.lessons[0].id));
      expect(progress).toMatchObject({
        courseId: fixture.course.id,
        sessionId: fixture.session.id,
        positionSeconds: '45',
      });
    });
  });

  it('does not move Redis progress backwards', async () => {
    const fixture = await createLiveProgressFixture();
    const socket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    sockets.push(socket);
    await joinSession(socket, fixture.session.id);

    socket.emit('progress:heartbeat', {
      lessonId: fixture.lessons[0].id,
      positionSeconds: 90,
    });
    await waitFor(async () => {
      await expect(
        redis.getClient().hget(progressKey(fixture.student.userId, fixture.lessons[0].id), 'positionSeconds'),
      ).resolves.toBe('90');
    });

    socket.emit('progress:heartbeat', {
      lessonId: fixture.lessons[0].id,
      positionSeconds: 30,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(
      redis.getClient().hget(progressKey(fixture.student.userId, fixture.lessons[0].id), 'positionSeconds'),
    ).resolves.toBe('90');
  });

  it('emits progress updates to instructors when a lesson is newly completed', async () => {
    const fixture = await createLiveProgressFixture();
    const instructorSocket = await connectSocket(url, '/sessions', fixture.instructor.accessToken);
    const studentSocket = await connectSocket(url, '/sessions', fixture.student.accessToken);
    sockets.push(instructorSocket, studentSocket);
    await joinSession(instructorSocket, fixture.session.id);
    await joinSession(studentSocket, fixture.session.id);

    const progressPromise = once(instructorSocket, 'progress:updated');
    studentSocket.emit('progress:heartbeat', {
      lessonId: fixture.lessons[0].id,
      positionSeconds: 120,
    });

    await expect(progressPromise).resolves.toMatchObject({
      courseId: fixture.course.id,
      lessonId: fixture.lessons[0].id,
      userId: fixture.student.userId,
      percent: 50,
    });
  });

  async function createLiveProgressFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await prisma.course.create({
      data: {
        title: 'Realtime progress course',
        slug: `realtime-progress-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const lessons = await Promise.all([
      prisma.lesson.create({
        data: {
          courseId: course.id,
          title: 'Intro video',
          order: 1,
          durationSeconds: 120,
        },
      }),
      prisma.lesson.create({
        data: {
          courseId: course.id,
          title: 'Practice',
          order: 2,
          durationSeconds: 180,
        },
      }),
    ]);
    const session = await prisma.session.create({
      data: {
        courseId: course.id,
        title: 'Live progress session',
        startsAt: new Date(),
        status: 'LIVE',
      },
    });
    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        userId: student.userId,
      },
    });

    return { course, instructor, lessons, session, student };
  }

  async function deleteProgressKeys(): Promise<void> {
    const client = redis.getClient();
    const keys = [
      ...(await client.keys('progress:*')),
      ...(await client.keys('session:*:participants')),
    ];

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }
});

function progressKey(userId: string, lessonId: string): string {
  return `progress:${userId}:${lessonId}`;
}

async function joinSession(socket: Socket, sessionId: string): Promise<void> {
  const statePromise = once(socket, 'session:state');
  socket.emit('session:join', { sessionId });
  await statePromise;
}

function once<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function waitFor(assertion: () => Promise<void>, timeoutMs = 1500): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw lastError;
}
