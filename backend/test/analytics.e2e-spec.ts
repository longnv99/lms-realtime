import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Analytics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('returns learner course analytics for an enrolled student', async () => {
    const fixture = await createAnalyticsFixture();

    const res = await request(app.getHttpServer())
      .get(`/api/me/courses/${fixture.course.id}/analytics`)
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      courseId: fixture.course.id,
      completedLessons: 1,
      totalLessons: 2,
      completionPercent: 50,
      quizRunsTaken: 1,
      averageQuizScore: 10,
      bestQuizScore: 10,
      lastActivityAt: '2026-09-01T09:45:00.000Z',
      quizAttempts: [
        {
          quizRunId: fixture.quizRun.id,
          quizTitle: 'Frontend basics check',
          lessonId: fixture.lessons[0].id,
          lessonTitle: 'Intro video',
          finishedAt: '2026-09-01T09:45:00.000Z',
          totalScore: 10,
          correctCount: 1,
          questionCount: 2,
          percentCorrect: 50,
          rank: 2,
          participantCount: 2,
        },
      ],
    });
  });

  it('rejects learner analytics reads for unenrolled students', async () => {
    const fixture = await createAnalyticsFixture();
    const outsider = await registerAndLogin(app, 'STUDENT');

    await request(app.getHttpServer())
      .get(`/api/me/courses/${fixture.course.id}/analytics`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
      });
  });

  async function createAnalyticsFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const peer = await registerAndLogin(app, 'STUDENT');
    const course = await prisma.course.create({
      data: {
        title: 'Analytics course',
        slug: `analytics-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Analytics e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date('2026-09-01T08:00:00.000Z'),
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
          title: 'Deep dive',
          order: 2,
          durationSeconds: 300,
        },
      }),
    ]);

    await prisma.enrollment.createMany({
      data: [
        { courseId: course.id, userId: student.userId },
        { courseId: course.id, userId: peer.userId },
      ],
    });
    await prisma.lessonProgress.create({
      data: {
        userId: student.userId,
        lessonId: lessons[0].id,
        positionSeconds: 120,
        completedAt: new Date('2026-09-01T09:00:00.000Z'),
        lastWatchedAt: new Date('2026-09-01T09:30:00.000Z'),
      },
    });

    const session = await prisma.session.create({
      data: {
        courseId: course.id,
        title: 'Analytics live session',
        startsAt: new Date('2026-09-01T09:15:00.000Z'),
        status: 'ENDED',
      },
    });
    const quiz = await prisma.quiz.create({
      data: {
        lessonId: lessons[0].id,
        title: 'Frontend basics check',
      },
    });
    const questions = await Promise.all([
      prisma.question.create({
        data: {
          quizId: quiz.id,
          text: 'Which tool renders React apps?',
          options: [{ id: 'react', text: 'React' }],
          correctOptionId: 'react',
          order: 1,
        },
      }),
      prisma.question.create({
        data: {
          quizId: quiz.id,
          text: 'Which command starts Vite?',
          options: [{ id: 'npm-run-dev', text: 'npm run dev' }],
          correctOptionId: 'npm-run-dev',
          order: 2,
        },
      }),
    ]);
    const quizRun = await prisma.quizRun.create({
      data: {
        quizId: quiz.id,
        sessionId: session.id,
        status: 'FINISHED',
        finishedAt: new Date('2026-09-01T09:45:00.000Z'),
      },
    });

    await prisma.quizAnswer.createMany({
      data: [
        {
          runId: quizRun.id,
          questionId: questions[0].id,
          userId: student.userId,
          selectedOptionId: 'react',
          isCorrect: true,
          score: 10,
          answeredAt: new Date('2026-09-01T09:40:00.000Z'),
        },
        {
          runId: quizRun.id,
          questionId: questions[1].id,
          userId: student.userId,
          selectedOptionId: 'vite',
          isCorrect: false,
          score: 0,
          answeredAt: new Date('2026-09-01T09:41:00.000Z'),
        },
        {
          runId: quizRun.id,
          questionId: questions[0].id,
          userId: peer.userId,
          selectedOptionId: 'react',
          isCorrect: true,
          score: 10,
          answeredAt: new Date('2026-09-01T09:42:00.000Z'),
        },
        {
          runId: quizRun.id,
          questionId: questions[1].id,
          userId: peer.userId,
          selectedOptionId: 'npm-run-dev',
          isCorrect: true,
          score: 10,
          answeredAt: new Date('2026-09-01T09:43:00.000Z'),
        },
      ],
    });

    return { course, lessons, quizRun, student };
  }
});
