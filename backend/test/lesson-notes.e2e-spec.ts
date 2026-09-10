import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Lesson notes (e2e)', () => {
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

  it('creates, updates, lists, and deletes learner-owned notes', async () => {
    const { lessonId, studentToken, studentUserId } = await createLessonNotesFixture();

    const createResponse = await request(app.getHttpServer())
      .post(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ body: 'Review socket heartbeat timing.', positionSeconds: 145 })
      .expect(201);

    expect(createResponse.body.data).toEqual({
      id: expect.any(String),
      userId: studentUserId,
      lessonId,
      body: 'Review socket heartbeat timing.',
      positionSeconds: 145,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const noteId = createResponse.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/me/lesson-notes/${noteId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ body: 'Review heartbeat and retry behavior.', positionSeconds: 150 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.body).toBe('Review heartbeat and retry behavior.');
        expect(body.data.positionSeconds).toBe(150);
      });

    await request(app.getHttpServer())
      .get(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(1);
        expect(body.data[0].body).toBe('Review heartbeat and retry behavior.');
      });

    await request(app.getHttpServer())
      .delete(`/api/me/lesson-notes/${noteId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(0);
      });
  });

  it('rejects notes for lessons outside a student enrollment', async () => {
    const { studentToken, unavailableLessonId } = await createLessonNotesFixture();

    await request(app.getHttpServer())
      .post(`/api/me/lessons/${unavailableLessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ body: 'Trying to peek into another course.', positionSeconds: 10 })
      .expect(403);
  });

  it('lets instructors create their own notes for lessons they manage', async () => {
    const { instructorToken, lessonId, instructorUserId } = await createLessonNotesFixture();

    await request(app.getHttpServer())
      .post(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ body: 'Mention retry timing in the live session.', positionSeconds: null })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.userId).toBe(instructorUserId);
        expect(body.data.lessonId).toBe(lessonId);
        expect(body.data.positionSeconds).toBeNull();
      });
  });

  it('rejects updates and deletes from users who do not own the note', async () => {
    const { lessonId, otherStudentToken, studentToken } = await createLessonNotesFixture();

    const createResponse = await request(app.getHttpServer())
      .post(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ body: 'Only the author should change this.', positionSeconds: 20 })
      .expect(201);

    const noteId = createResponse.body.data.id;

    await request(app.getHttpServer())
      .patch(`/api/me/lesson-notes/${noteId}`)
      .set('Authorization', `Bearer ${otherStudentToken}`)
      .send({ body: 'Overwritten by another learner.', positionSeconds: 25 })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/me/lesson-notes/${noteId}`)
      .set('Authorization', `Bearer ${otherStudentToken}`)
      .expect(403);
  });

  it('rejects blank and overlong note bodies', async () => {
    const { lessonId, studentToken } = await createLessonNotesFixture();

    await request(app.getHttpServer())
      .post(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ body: '   ', positionSeconds: 10 })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ body: 'x'.repeat(4001), positionSeconds: 10 })
      .expect(400);
  });

  it('rejects note positions outside the lesson duration', async () => {
    const { lessonId, studentToken } = await createLessonNotesFixture();

    await request(app.getHttpServer())
      .post(`/api/me/lessons/${lessonId}/notes`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ body: 'Position must stay on the timeline.', positionSeconds: 301 })
      .expect(400);
  });

  async function createLessonNotesFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const otherStudent = await registerAndLogin(app, 'STUDENT');
    const course = await prisma.course.create({
      data: {
        title: 'Lesson notes course',
        slug: `lesson-notes-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Lesson notes e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const unavailableCourse = await prisma.course.create({
      data: {
        title: 'Unavailable lesson notes course',
        slug: `unavailable-lesson-notes-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Unavailable lesson notes e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const [lesson, unavailableLesson] = await Promise.all([
      prisma.lesson.create({
        data: {
          courseId: course.id,
          title: 'Note-taking lesson',
          order: 1,
          durationSeconds: 300,
        },
      }),
      prisma.lesson.create({
        data: {
          courseId: unavailableCourse.id,
          title: 'Unavailable note-taking lesson',
          order: 1,
          durationSeconds: 90,
        },
      }),
    ]);

    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        userId: student.userId,
      },
    });
    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        userId: otherStudent.userId,
      },
    });

    return {
      instructorToken: instructor.accessToken,
      instructorUserId: instructor.userId,
      lessonId: lesson.id,
      otherStudentToken: otherStudent.accessToken,
      studentToken: student.accessToken,
      studentUserId: student.userId,
      unavailableLessonId: unavailableLesson.id,
    };
  }
});
