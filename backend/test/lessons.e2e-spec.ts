import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Lessons (e2e)', () => {
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

  it('allows course instructor to create lessons with sequential order', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);

    const first = await createLesson(instructor.accessToken, course.id, 'Intro lesson');
    const second = await createLesson(instructor.accessToken, course.id, 'Deep dive lesson');

    expect(first).toMatchObject({
      courseId: course.id,
      title: 'Intro lesson',
      order: 1,
      durationSeconds: 0,
    });
    expect(second).toMatchObject({
      courseId: course.id,
      title: 'Deep dive lesson',
      order: 2,
    });
  });

  it('lists lessons ordered by order asc', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const first = await createLesson(instructor.accessToken, course.id, 'First lesson');
    const second = await createLesson(instructor.accessToken, course.id, 'Second lesson');

    const res = await request(app.getHttpServer())
      .get(`/api/courses/${course.id}/lessons`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.map((lesson: { id: string }) => lesson.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('reorders lessons atomically', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(instructor.accessToken);
    const first = await createLesson(instructor.accessToken, course.id, 'First lesson');
    const second = await createLesson(instructor.accessToken, course.id, 'Second lesson');

    const res = await request(app.getHttpServer())
      .patch(`/api/courses/${course.id}/lessons/reorder`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({
        items: [
          { id: first.id, order: 2 },
          { id: second.id, order: 1 },
        ],
      })
      .expect(200);

    expect(res.body.data.map((lesson: { id: string }) => lesson.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(res.body.data.map((lesson: { order: number }) => lesson.order)).toEqual([1, 2]);
  });

  it('forbids another instructor from editing a lesson', async () => {
    const owner = await registerAndLogin(app, 'INSTRUCTOR');
    const other = await registerAndLogin(app, 'INSTRUCTOR');
    const course = await createCourse(owner.accessToken);
    const lesson = await createLesson(owner.accessToken, course.id, 'Owned lesson');

    await request(app.getHttpServer())
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ title: 'Edited by someone else' })
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
      });
  });

  async function createCourse(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: `Course ${Date.now()} ${Math.random()}`,
        slug: `lesson-course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Course for lessons',
      })
      .expect(201);

    return res.body.data;
  }

  async function createLesson(accessToken: string, courseId: string, title: string) {
    const res = await request(app.getHttpServer())
      .post(`/api/courses/${courseId}/lessons`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title })
      .expect(201);

    return res.body.data;
  }
});
