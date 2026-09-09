import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Quiz review (e2e)', () => {
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

  it('returns a revealed and completed learner quiz review with a stable finish time', async () => {
    const { courseId, instructorToken, runId, studentToken } =
      await createRevealedQuizReviewFixture();

    await request(app.getHttpServer())
      .post(`/api/quiz-runs/${runId}/finish`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(201);

    const firstReview = await request(app.getHttpServer())
      .get(`/api/me/courses/${courseId}/quiz-reviews`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.courseId).toBe(courseId);
        expect(body.data.reviews[0]).toMatchObject({
          quizRunId: expect.any(String),
          quizTitle: expect.any(String),
          lessonId: expect.any(String),
          totalScore: expect.any(Number),
          questionCount: expect.any(Number),
          correctCount: expect.any(Number),
          finishedAt: expect.any(String),
        });
        expect(body.data.reviews[0].questions[0]).toMatchObject({
          correctOptionId: expect.any(String),
          explanation: expect.any(String),
        });
      });

    await new Promise((resolve) => setTimeout(resolve, 20));
    await request(app.getHttpServer())
      .post(`/api/quiz-runs/${runId}/finish`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/me/courses/${courseId}/quiz-reviews`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.reviews[0].finishedAt).toBe(firstReview.body.data.reviews[0].finishedAt);
      });
  });

  it('does not expose answer feedback for finished runs that were never revealed', async () => {
    const { courseId, studentToken } = await createUnrevealedFinishedQuizReviewFixture();

    await request(app.getHttpServer())
      .get(`/api/me/courses/${courseId}/quiz-reviews`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.courseId).toBe(courseId);
        expect(body.data.reviews).toEqual([]);
      });
  });

  async function createRevealedQuizReviewFixture() {
    const fixture = await createQuizReviewFixture();

    await request(app.getHttpServer())
      .post(`/api/quiz-runs/${fixture.runId}/reveal`)
      .set('Authorization', `Bearer ${fixture.instructorToken}`)
      .expect(201);

    return fixture;
  }

  async function createUnrevealedFinishedQuizReviewFixture() {
    const fixture = await createQuizReviewFixture();

    await prisma.quizRun.update({
      where: { id: fixture.runId },
      data: { status: 'FINISHED' },
    });

    return fixture;
  }

  async function createQuizReviewFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await prisma.course.create({
      data: {
        title: 'Quiz review course',
        slug: `quiz-review-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Quiz review e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const lesson = await prisma.lesson.create({
      data: {
        courseId: course.id,
        title: 'Review lesson',
        order: 1,
        durationSeconds: 180,
      },
    });
    const quiz = await prisma.quiz.create({
      data: {
        lessonId: lesson.id,
        title: 'Review quiz',
      },
    });
    const question = await prisma.question.create({
      data: {
        quizId: quiz.id,
        text: 'Which answer should be reviewed?',
        options: [
          { id: 'a', text: 'The correct answer' },
          { id: 'b', text: 'A tempting distractor' },
        ],
        correctOptionId: 'a',
        explanation: 'The review explains why the selected concept is correct.',
        order: 1,
      },
    });
    const session = await prisma.session.create({
      data: {
        courseId: course.id,
        title: 'Review session',
        startsAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const run = await prisma.quizRun.create({
      data: {
        quizId: quiz.id,
        sessionId: session.id,
        currentQuestionIndex: 1,
        status: 'CLOSED',
        questionOpenedAt: new Date(Date.now() - 10_000),
      },
    });

    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        userId: student.userId,
      },
    });
    await prisma.quizAnswer.create({
      data: {
        runId: run.id,
        questionId: question.id,
        userId: student.userId,
        selectedOptionId: 'a',
        isCorrect: true,
        score: 100,
      },
    });

    return {
      courseId: course.id,
      instructorToken: instructor.accessToken,
      runId: run.id,
      studentToken: student.accessToken,
    };
  }
});
