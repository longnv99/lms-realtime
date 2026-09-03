import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ProgressService } from '../src/modules/progress/progress.service';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Lesson progress (e2e)', () => {
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

  it('returns enrolled student course progress computed from completed lessons', async () => {
    const fixture = await createProgressFixture();
    await prisma.lessonProgress.create({
      data: {
        userId: fixture.student.userId,
        lessonId: fixture.lessons[0].id,
        positionSeconds: 120,
        completedAt: new Date('2026-08-28T10:00:00.000Z'),
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/me/courses/${fixture.course.id}/progress`)
      .set('Authorization', `Bearer ${fixture.student.accessToken}`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      courseId: fixture.course.id,
      totalLessons: 2,
      completedLessons: 1,
      percent: 50,
      lessons: [
        {
          lessonId: fixture.lessons[0].id,
          title: 'Intro video',
          positionSeconds: 120,
          completedAt: '2026-08-28T10:00:00.000Z',
        },
        {
          lessonId: fixture.lessons[1].id,
          title: 'Deep dive',
          positionSeconds: 0,
          completedAt: null,
        },
      ],
    });
  });

  it('rejects course progress reads for unenrolled students', async () => {
    const fixture = await createProgressFixture();
    const outsider = await registerAndLogin(app, 'STUDENT');

    await request(app.getHttpServer())
      .get(`/api/me/courses/${fixture.course.id}/progress`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
      });
  });

  it('returns instructor progress grouped by enrolled student', async () => {
    const fixture = await createProgressFixture();
    await prisma.lessonProgress.create({
      data: {
        userId: fixture.student.userId,
        lessonId: fixture.lessons[0].id,
        positionSeconds: 120,
        completedAt: new Date('2026-08-28T10:00:00.000Z'),
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/courses/${fixture.course.id}/progress`)
      .set('Authorization', `Bearer ${fixture.instructor.accessToken}`)
      .expect(200);

    expect(res.body.data).toEqual({
      courseId: fixture.course.id,
      totalLessons: 2,
      students: [
        expect.objectContaining({
          userId: fixture.student.userId,
          completedLessons: 1,
          percent: 50,
        }),
      ],
    });
  });

  it('records heartbeat progress without moving position backwards', async () => {
    const fixture = await createProgressFixture();
    const progressService = app.get(ProgressService);
    const user = {
      id: fixture.student.userId,
      email: 'student@example.com',
      role: 'STUDENT' as const,
    };

    await progressService.recordHeartbeat(user, fixture.lessons[0].id, 90);
    const progress = await progressService.recordHeartbeat(user, fixture.lessons[0].id, 30);

    expect(progress).toMatchObject({
      lessonId: fixture.lessons[0].id,
      positionSeconds: 90,
      completedAt: null,
    });
  });

  it('sets completedAt only once when heartbeat reaches lesson duration', async () => {
    const fixture = await createProgressFixture();
    const progressService = app.get(ProgressService);
    const user = {
      id: fixture.student.userId,
      email: 'student@example.com',
      role: 'STUDENT' as const,
    };

    const completed = await progressService.recordHeartbeat(user, fixture.lessons[0].id, 120);
    const afterRepeat = await progressService.recordHeartbeat(user, fixture.lessons[0].id, 150);

    expect(completed.completedAt).toEqual(expect.any(String));
    expect(afterRepeat.completedAt).toBe(completed.completedAt);
    expect(afterRepeat.positionSeconds).toBe(150);
  });

  async function createProgressFixture() {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await prisma.course.create({
      data: {
        title: 'Progress course',
        slug: `progress-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Progress e2e fixture',
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
          title: 'Deep dive',
          order: 2,
          durationSeconds: 300,
        },
      }),
    ]);
    await prisma.enrollment.create({
      data: {
        courseId: course.id,
        userId: student.userId,
      },
    });

    return { course, instructor, lessons, student };
  }
});
