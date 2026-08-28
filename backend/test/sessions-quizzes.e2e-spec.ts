import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Sessions and quizzes (e2e)', () => {
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

  it('allows instructor to create a scheduled session', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const startsAt = futureIsoDate();

    const res = await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/sessions`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({ title: 'Live intro session', startsAt })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      courseId: course.id,
      title: 'Live intro session',
      startsAt,
      status: 'SCHEDULED',
      endsAt: null,
    });
  });

  it('starts a scheduled session and returns LIVE status', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const session = await createSession(instructor.accessToken, course.id);

    const res = await request(app.getHttpServer())
      .post(`/api/sessions/${session.id}/start`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    expect(res.body.data).toMatchObject({
      id: session.id,
      status: 'LIVE',
    });
  });

  it('ends a live session and returns ENDED status with endsAt', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const session = await createSession(instructor.accessToken, course.id);

    await request(app.getHttpServer())
      .post(`/api/sessions/${session.id}/start`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/sessions/${session.id}/end`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    expect(res.body.data).toMatchObject({
      id: session.id,
      status: 'ENDED',
    });
    expect(res.body.data.endsAt).toEqual(expect.any(String));
  });

  it('returns session state with participantCount 0 in P2', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const session = await createSession(instructor.accessToken, course.id);

    const res = await request(app.getHttpServer())
      .get(`/api/sessions/${session.id}/state`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(200);

    expect(res.body.data).toEqual({
      id: session.id,
      status: 'SCHEDULED',
      participantCount: 0,
    });
  });

  it('lists course sessions for enrolled students', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await createCourse(instructor.accessToken);
    const session = await createSession(instructor.accessToken, course.id);

    await publishCourse(instructor.accessToken, course.id);
    await enrollStudent(student.accessToken, course.id);

    const res = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/sessions`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: session.id,
        courseId: course.id,
        title: session.title,
        status: 'SCHEDULED',
      }),
    ]);
  });

  it('allows instructor to create a quiz with questions', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const lesson = await createLesson(instructor.accessToken, course.id);

    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lesson.id}/quizzes`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send(sampleQuizPayload())
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      lessonId: lesson.id,
      title: 'Intro quiz',
    });
    expect(res.body.data.questions).toHaveLength(1);
    expect(res.body.data.questions[0]).toMatchObject({
      text: 'Which service stores relational LMS data?',
      correctOptionId: 'a',
      order: 1,
    });
  });

  it('lists lesson quizzes with questions without exposing correctOptionId', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await createCourse(instructor.accessToken);
    const lesson = await createLesson(instructor.accessToken, course.id);
    const quiz = await createQuiz(instructor.accessToken, lesson.id);

    await publishCourse(instructor.accessToken, course.id);
    await enrollStudent(student.accessToken, course.id);

    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lesson.id}/quizzes`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: quiz.id,
        lessonId: lesson.id,
        title: 'Intro quiz',
        questions: [
          expect.objectContaining({
            id: expect.any(String),
            text: 'Which service stores relational LMS data?',
            options: [
              { id: 'a', text: 'PostgreSQL' },
              { id: 'b', text: 'Redis' },
            ],
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(res.body.data)).not.toContain('correctOptionId');
  });

  it('creates a quiz run for a session in PENDING status', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const lesson = await createLesson(instructor.accessToken, course.id);
    const session = await createSession(instructor.accessToken, course.id);
    const quiz = await createQuiz(instructor.accessToken, lesson.id);

    const res = await request(app.getHttpServer())
      .post(`/api/sessions/${session.id}/quiz-runs`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({ quizId: quiz.id })
      .expect(201);

    expect(res.body.data).toMatchObject({
      quizId: quiz.id,
      sessionId: session.id,
      status: 'PENDING',
      currentQuestionIndex: null,
    });
  });

  it('lists session quiz runs with linked quiz title', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const lesson = await createLesson(instructor.accessToken, course.id);
    const session = await createSession(instructor.accessToken, course.id);
    const quiz = await createQuiz(instructor.accessToken, lesson.id);
    const run = await createQuizRun(instructor.accessToken, session.id, quiz.id);

    const res = await request(app.getHttpServer())
      .get(`/api/sessions/${session.id}/quiz-runs`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        id: run.id,
        quizId: quiz.id,
        sessionId: session.id,
        status: 'PENDING',
        quiz: {
          id: quiz.id,
          title: 'Intro quiz',
        },
      }),
    ]);
  });

  it('returns quiz run state without correctOptionId', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const lesson = await createLesson(instructor.accessToken, course.id);
    const session = await createSession(instructor.accessToken, course.id);
    const quiz = await createQuiz(instructor.accessToken, lesson.id);
    const run = await createQuizRun(instructor.accessToken, session.id, quiz.id);

    await prisma.quizRun.update({
      where: { id: run.id },
      data: { status: 'OPEN', currentQuestionIndex: 1, questionOpenedAt: new Date() },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/quiz-runs/${run.id}/state`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      id: run.id,
      status: 'OPEN',
      currentQuestionIndex: 1,
      question: {
        text: 'Which service stores relational LMS data?',
        options: [
          { id: 'a', text: 'PostgreSQL' },
          { id: 'b', text: 'Redis' },
        ],
      },
    });
    expect(JSON.stringify(res.body.data)).not.toContain('correctOptionId');
  });

  it('opens the next quiz question without exposing correctOptionId', async () => {
    const fixture = await createSessionQuizFixture();

    const res = await request(app.getHttpServer())
      .post(`/api/quiz-runs/${fixture.run.id}/questions/next`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(201);

    expect(res.body.data).toMatchObject({
      status: 'OPEN',
      currentQuestionIndex: 1,
      question: {
        text: 'Which service stores relational LMS data?',
        options: [
          { id: 'a', text: 'PostgreSQL' },
          { id: 'b', text: 'Redis' },
        ],
      },
    });
    expect(JSON.stringify(res.body.data)).not.toContain('correctOptionId');
  });

  it('closes, reveals, and finishes a quiz run', async () => {
    const fixture = await createSessionQuizFixture();

    await request(app.getHttpServer())
      .post(`/api/quiz-runs/${fixture.run.id}/questions/next`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(201);

    const closeRes = await request(app.getHttpServer())
      .post(`/api/quiz-runs/${fixture.run.id}/questions/close`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(201);
    expect(closeRes.body.data).toMatchObject({
      status: 'CLOSED',
      answerCount: 0,
    });

    const revealRes = await request(app.getHttpServer())
      .post(`/api/quiz-runs/${fixture.run.id}/reveal`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(201);
    expect(revealRes.body.data).toMatchObject({
      status: 'REVEALED',
      correctOptionId: 'a',
      correctCount: 0,
    });

    const finishRes = await request(app.getHttpServer())
      .post(`/api/quiz-runs/${fixture.run.id}/finish`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(201);
    expect(finishRes.body.data).toMatchObject({ status: 'FINISHED' });
  });

  async function createCourse(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: `Session Course ${Date.now()} ${Math.random()}`,
        slug: `session-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Course for sessions',
      })
      .expect(201);

    return res.body.data;
  }

  async function createSession(accessToken: string, courseId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/sessions`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Live class', startsAt: futureIsoDate() })
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

  async function createQuiz(accessToken: string, lessonId: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/quizzes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(sampleQuizPayload())
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

  async function publishCourse(accessToken: string, courseId: string) {
    await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  }

  async function enrollStudent(accessToken: string, courseId: string) {
    await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/enroll`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  }

  async function createSessionQuizFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const lesson = await createLesson(instructor.accessToken, course.id);
    const session = await createSession(instructor.accessToken, course.id);
    const quiz = await createQuiz(instructor.accessToken, lesson.id);
    const run = await createQuizRun(instructor.accessToken, session.id, quiz.id);

    return { instructor, course, lesson, session, quiz, run };
  }

  function futureIsoDate(): string {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  function sampleQuizPayload() {
    return {
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
    };
  }
});
