import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import { registerAndLogin } from './helpers/auth';
import { cleanDatabase, prisma } from './helpers/db';

describe('Courses and enrollments (e2e)', () => {
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

  it('allows instructor to create a draft course', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');

    const res = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({
        title: 'Realtime LMS Foundations',
        slug: 'realtime-lms-foundations',
        description: 'Course draft',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      title: 'Realtime LMS Foundations',
      slug: 'realtime-lms-foundations',
      status: 'DRAFT',
      instructorId: instructor.userId,
    });
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('rejects duplicate slug with COURSE_SLUG_TAKEN', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const payload = {
      title: 'Slug Course',
      slug: 'slug-course',
      description: 'First version',
    };

    await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .send({ ...payload, title: 'Duplicate Slug Course' })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('COURSE_SLUG_TAKEN');
      });
  });

  it('publishes and unpublishes a course', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const created = await createCourse(instructor.accessToken);

    const published = await request(app.getHttpServer())
      .post(`/api/courses/${created.id}/publish`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    expect(published.body.data).toMatchObject({
      id: created.id,
      status: 'PUBLISHED',
    });
    expect(published.body.data.publishedAt).toEqual(expect.any(String));

    const unpublished = await request(app.getHttpServer())
      .post(`/api/courses/${created.id}/unpublish`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    expect(unpublished.body.data).toMatchObject({
      id: created.id,
      status: 'DRAFT',
      publishedAt: null,
    });
  });

  it('allows student to enroll only in published courses', async () => {
    const instructor = await registerAndLogin(app, 'INSTRUCTOR');
    const student = await registerAndLogin(app, 'STUDENT');
    const course = await createCourse(instructor.accessToken);

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/enroll`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('COURSE_NOT_PUBLISHED');
      });

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/publish`)
      .set('Authorization', `Bearer ${instructor.accessToken}`)
      .expect(201);

    const enrolled = await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/enroll`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(201);

    expect(enrolled.body.data).toMatchObject({
      courseId: course.id,
      userId: student.userId,
    });
  });

  it('rejects duplicate enrollment with ENROLL_ALREADY', async () => {
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

    await request(app.getHttpServer())
      .post(`/api/courses/${course.id}/enroll`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('ENROLL_ALREADY');
      });
  });

  async function createCourse(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: `Course ${Date.now()} ${Math.random()}`,
        slug: `course-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        description: 'Draft course',
      })
      .expect(201);

    return res.body.data;
  }
});
