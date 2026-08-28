import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Socket } from 'socket.io-client';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';
import { connectSocket } from './helpers/socket';
import { createWsTestApp } from './helpers/ws-app';

describe('Quizzes realtime (e2e)', () => {
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

  it('allows an enrolled student to join a quiz run', async () => {
    const fixture = await createOpenQuizRunFixture();
    const socket = await connectSocket(url, '/quiz', fixture.student.accessToken);
    sockets.push(socket);

    const leaderboardPromise = once(socket, 'quiz:leaderboard');
    socket.emit('quiz:join', { quizRunId: fixture.run.id });

    await expect(leaderboardPromise).resolves.toEqual({ entries: [] });
  });

  it('accepts one answer, persists score, and broadcasts leaderboard', async () => {
    const fixture = await createOpenQuizRunFixture();
    const socket = await connectSocket(url, '/quiz', fixture.student.accessToken);
    sockets.push(socket);

    socket.emit('quiz:join', { quizRunId: fixture.run.id });
    await once(socket, 'quiz:leaderboard');

    const leaderboardPromise = once(socket, 'quiz:leaderboard');
    socket.emit('quiz:answer', {
      quizRunId: fixture.run.id,
      questionId: fixture.question.id,
      optionId: 'a',
    });

    await expect(leaderboardPromise).resolves.toMatchObject({
      entries: [{ userId: fixture.student.userId, name: 'STUDENT User', rank: 1 }],
    });

    const answer = await prisma.quizAnswer.findFirstOrThrow({
      where: { runId: fixture.run.id, userId: fixture.student.userId },
    });
    expect(answer.isCorrect).toBe(true);
    expect(answer.score).toBeGreaterThanOrEqual(100);
    expect(answer.score).toBeLessThanOrEqual(150);
  });

  it('rejects duplicate answers for the same question', async () => {
    const fixture = await createOpenQuizRunFixture();
    const socket = await connectSocket(url, '/quiz', fixture.student.accessToken);
    sockets.push(socket);

    socket.emit('quiz:join', { quizRunId: fixture.run.id });
    await once(socket, 'quiz:leaderboard');

    socket.emit('quiz:answer', {
      quizRunId: fixture.run.id,
      questionId: fixture.question.id,
      optionId: 'a',
    });
    await once(socket, 'quiz:leaderboard');

    const errorPromise = once(socket, 'error');
    socket.emit('quiz:answer', {
      quizRunId: fixture.run.id,
      questionId: fixture.question.id,
      optionId: 'a',
    });

    await expect(errorPromise).resolves.toMatchObject({
      message: expect.stringContaining('Da submit'),
    });
  });

  async function createOpenQuizRunFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await createCourse(instructor.accessToken);

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/publish`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/enroll`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(201);

    const lesson = await createLesson(instructor.accessToken, course.id);
    const session = await createSession(instructor.accessToken, course.id);
    const quiz = await createQuiz(instructor.accessToken, lesson.id);
    const run = await createQuizRun(instructor.accessToken, session.id, quiz.id);

    await request(app.getHttpServer())
      .post(`/api/quiz-runs/${run.id}/questions/next`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    return {
      instructor,
      student,
      course,
      lesson,
      session,
      quiz,
      run,
      question: quiz.questions[0],
    };
  }

  async function createCourse(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: `Realtime Quiz Course ${Date.now()} ${Math.random()}`,
        slug: `realtime-quiz-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      })
      .expect(201);

    return res.body.data;
  }

  async function createLesson(accessToken: string, courseId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Quiz lesson' })
      .expect(201);

    return res.body.data;
  }

  async function createSession(accessToken: string, courseId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/sessions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Live quiz session', startsAt: futureIsoDate() })
      .expect(201);

    return res.body.data;
  }

  async function createQuiz(accessToken: string, lessonId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/quizzes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Intro quiz',
        questions: [
          {
            text: 'Which service stores relational LMS data?',
            options: [
              { id: 'a', text: 'PostgreSQL' },
              { id: 'b', text: 'Redis' },
            ],
            correctOptionId: 'a',
          },
        ],
      })
      .expect(201);

    return res.body.data;
  }

  async function createQuizRun(accessToken: string, sessionId: string, quizId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/sessions/${sessionId}/quiz-runs`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quizId })
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
