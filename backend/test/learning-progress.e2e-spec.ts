import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Manual lesson progress (e2e)', () => {
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

  it('lets a student mark an enrolled lesson complete', async () => {
    const { lessonId, studentToken } = await createLearningProgressFixture();

    await request(app.getHttpServer())
      .patch(`/api/me/lessons/${lessonId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ completed: true })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.lessonId).toBe(lessonId);
        expect(body.data.completedAt).toEqual(expect.any(String));
      });
  });

  it('rejects progress updates for lessons outside the learner enrollment', async () => {
    const { studentToken, unavailableLessonId } = await createLearningProgressFixture();

    await request(app.getHttpServer())
      .patch(`/api/me/lessons/${unavailableLessonId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ completed: true })
      .expect(403);
  });

  it('rejects progress updates from non-enrolled instructors', async () => {
    const { instructorToken, lessonId } = await createLearningProgressFixture();

    await request(app.getHttpServer())
      .patch(`/api/me/lessons/${lessonId}/progress`)
      .set('Authorization', `Bearer ${instructorToken}`)
      .send({ completed: true })
      .expect(403);
  });

  it('rejects invalid progress payloads before persistence', async () => {
    const { lessonId, studentToken } = await createLearningProgressFixture();

    await request(app.getHttpServer())
      .patch(`/api/me/lessons/${lessonId}/progress`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ completed: 'yes', positionSeconds: 'near the end' })
      .expect(400);
  });

  async function createLearningProgressFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await prisma.course.create({
      data: {
        title: 'Manual progress course',
        slug: `manual-progress-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Manual progress e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const unavailableCourse = await prisma.course.create({
      data: {
        title: 'Unavailable manual progress course',
        slug: `unavailable-manual-progress-course-${Date.now()}-${Math.floor(
          Math.random() * 100000,
        )}`,
        description: 'Unavailable manual progress e2e fixture',
        instructorId: instructor.userId,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
    const [lesson, unavailableLesson] = await Promise.all([
      prisma.lesson.create({
        data: {
          courseId: course.id,
          title: 'Enrolled lesson',
          order: 1,
          durationSeconds: 120,
        },
      }),
      prisma.lesson.create({
        data: {
          courseId: unavailableCourse.id,
          title: 'Unavailable lesson',
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

    return {
      instructorToken: instructor.accessToken,
      lessonId: lesson.id,
      studentToken: student.accessToken,
      unavailableLessonId: unavailableLesson.id,
    };
  }
});
