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

  it('returns instructor analytics for an owned course', async () => {
    const fixture = await createAnalyticsFixture();

    const res = await request(app.getHttpServer())
      .get(`/api/courses/${fixture.course.id}/analytics`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      courseId: fixture.course.id,
      totalStudents: 2,
      activeStudents: 2,
      averageCompletionPercent: 25,
      completedStudents: 0,
      averageQuizScore: 15,
      quizParticipationRate: 100,
    });
    expect(res.body.data.lessonCompletions).toEqual([
      expect.objectContaining({
        lessonId: fixture.lessons[0].id,
        lessonTitle: 'Intro video',
        completedStudents: 1,
        totalStudents: 2,
        completionPercent: 50,
        averagePositionSeconds: 60,
      }),
      expect.objectContaining({
        lessonId: fixture.lessons[1].id,
        lessonTitle: 'Deep dive',
        completedStudents: 0,
        totalStudents: 2,
        completionPercent: 0,
        averagePositionSeconds: 0,
      }),
    ]);
    expect(res.body.data.questionPerformance).toEqual([
      expect.objectContaining({
        questionId: fixture.questions[0].id,
        answerCount: 2,
        correctCount: 2,
        correctPercent: 100,
      }),
      expect.objectContaining({
        questionId: fixture.questions[1].id,
        answerCount: 2,
        correctCount: 1,
        correctPercent: 50,
      }),
    ]);
    expect(res.body.data.studentSummaries).toEqual([
      expect.objectContaining({
        userId: fixture.student.userId,
        completionPercent: 50,
        completedLessons: 1,
        quizRunsTaken: 1,
        averageQuizScore: 10,
      }),
      expect.objectContaining({
        userId: fixture.peer.userId,
        completionPercent: 0,
        completedLessons: 0,
        quizRunsTaken: 1,
        averageQuizScore: 20,
      }),
    ]);
  });

  it('exports student analytics as csv for instructors', async () => {
    const fixture = await createAnalyticsFixture();

    const res = await request(app.getHttpServer())
      .get(`/api/courses/${fixture.course.id}/analytics/export?kind=students`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('course-analytics-students.csv');
    expect(res.text).toContain(
      'Name,Email,Completion %,Completed lessons,Quiz runs,Average quiz score,Last activity',
    );
    expect(res.text).toContain('STUDENT User');
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

    return { course, instructor, lessons, peer, questions, quizRun, student };
  }
});
